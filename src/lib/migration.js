'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatterFile, updateFrontmatterFile } = require('./frontmatter');
const { openRuntimeIndex, syncRuntimeFiles } = require('./runtime-index');
const { recordPathAlias, recordTaxonomyAlias } = require('./alias');
const { listMarkdownFiles, normalizePath } = require('./utils');

const MIGRATIONS_DIR = 'migrations';
const MIGRATION_LOG_FILE = 'migrations/MIGRATION_LOG.md';

// Supported operation types for structural migration
const OPERATION_TYPES = [
  'reclassify',    // change domain / subtype / primary_type for matching pages
  'relocate',      // move pages from one collection/path to another (placement change)
  'rename-domain', // rename a domain id, update all pages + alias
  'merge-subtype', // merge two subtypes into one
  'deprecate',     // deprecate a set of pages (sets status=archived)
  'merge-pages',   // merge N source pages into 1 target page; sources are archived
];

function getMigrationsDir(repoRoot) {
  return path.join(repoRoot, '.wiki', MIGRATIONS_DIR);
}

function getMigrationLogPath(repoRoot) {
  return path.join(repoRoot, '.wiki', MIGRATION_LOG_FILE);
}

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function slugifyId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function generatePlanId(operationType, scope) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  const suffix = slugifyId(scope || operationType);
  return `mig_${timestamp}${random}_${suffix}`;
}

function wikiRelative(repoRoot, absolutePath) {
  return normalizePath(path.relative(path.join(repoRoot, '.wiki'), absolutePath));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getPlanPath(repoRoot, planId) {
  return path.join(getMigrationsDir(repoRoot), `${planId}.json`);
}

function loadPlan(repoRoot, planId) {
  const planPath = getPlanPath(repoRoot, planId);
  if (!fs.existsSync(planPath)) {
    throw new Error(`migration plan not found: ${planId}`);
  }
  return readJsonFile(planPath);
}

function savePlan(repoRoot, plan) {
  writeJsonFile(getPlanPath(repoRoot, plan.plan_id), plan);
  return plan;
}

// Compute the risk level for a plan based on affected page count and operation type.
function computeRiskLevel(operationType, affectedPageCount) {
  if (operationType === 'rename-domain' || affectedPageCount > 20) {
    return 'high';
  }
  if (affectedPageCount > 3) {
    return 'medium';
  }
  return 'low';
}

// Find all canon pages matching a filter spec.
// filter: {
//   domain?, collection?, subtype?, primary_type?,
//   confidence?,         — match pages with this confidence level
//   subtype_is_null?,    — when true, match pages with no subtype (unclassified)
//   page_ids?,           — array of page_id strings for precise page selection
// }
function findMatchingPages(repoRoot, filter) {
  const db = openRuntimeIndex(repoRoot);
  const conditions = ["status != 'archived'"];
  const params = [];
  if (filter.domain) {
    conditions.push('domain = ?');
    params.push(filter.domain);
  }
  if (filter.collection) {
    conditions.push('collection = ?');
    params.push(filter.collection);
  }
  if (filter.subtype) {
    conditions.push('subtype = ?');
    params.push(filter.subtype);
  }
  if (filter.subtype_is_null === true) {
    conditions.push("(subtype IS NULL OR subtype = '')");
  }
  if (filter.primary_type) {
    conditions.push('primary_type = ?');
    params.push(filter.primary_type);
  }
  if (filter.confidence) {
    conditions.push('confidence = ?');
    params.push(filter.confidence);
  }
  if (Array.isArray(filter.page_ids) && filter.page_ids.length > 0) {
    const placeholders = filter.page_ids.map(() => '?').join(', ');
    conditions.push(`page_id IN (${placeholders})`);
    params.push(...filter.page_ids);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT path, title, domain, collection, subtype, primary_type, page_id FROM pages ${where}`).all(...params);
}

// Create a new migration plan (does NOT execute anything).
// options:
//   operation_type: one of OPERATION_TYPES
//   scope: short human label for this plan (e.g. "rag → retrieval")
//   from: { domain?, collection?, subtype?, primary_type?, page_paths? }  — filter or explicit paths
//   to:   { domain?, collection?, subtype?, primary_type?, target_path? }  — what to change them to
//   reason: why this migration is happening
function createMigrationPlan(repoRoot, options) {
  const operationType = options.operation_type || '';
  if (!OPERATION_TYPES.includes(operationType)) {
    throw new Error(`migration: operation_type must be one of: ${OPERATION_TYPES.join(', ')}`);
  }
  const from = options.from || {};
  const to = options.to || {};

  // merge-pages has special from/to structure
  if (operationType === 'merge-pages') {
    if (!Array.isArray(from.page_paths) || from.page_paths.length < 2) {
      throw new Error('migration merge-pages: from.page_paths must be an array of at least 2 source page paths');
    }
    if (!to.target_path) {
      throw new Error('migration merge-pages: to.target_path is required (the destination page wiki-relative path)');
    }
    const planId = generatePlanId(operationType, options.scope);
    const plan = {
      plan_id: planId,
      operation_type: operationType,
      scope: options.scope || 'merge-pages',
      reason: options.reason || null,
      from,
      to,
      affected_page_ids: [],
      affected_page_paths: from.page_paths,
      risk_level: 'medium', // merge always requires human review
      status: 'draft',
      created_at: formatTimestamp(),
      dry_run_report: null,
      rollback_plan: null,
      applied_at: null,
      rolled_back_at: null,
    };
    savePlan(repoRoot, plan);
    return plan;
  }

  if (!Object.keys(from).length) {
    throw new Error('migration: from filter is required');
  }
  // deprecate only needs a from-filter (it just archives pages, no reclassify required)
  if (!Object.keys(to).length && operationType !== 'deprecate') {
    throw new Error('migration: to spec is required');
  }

  const affectedPages = findMatchingPages(repoRoot, from);
  const planId = generatePlanId(operationType, options.scope);
  const riskLevel = computeRiskLevel(operationType, affectedPages.length);

  const plan = {
    plan_id: planId,
    operation_type: operationType,
    scope: options.scope || operationType,
    reason: options.reason || null,
    from,
    to,
    affected_page_ids: affectedPages.map((row) => row.page_id).filter(Boolean),
    affected_page_paths: affectedPages.map((row) => row.path),
    risk_level: riskLevel,
    status: 'draft',
    created_at: formatTimestamp(),
    dry_run_report: null,
    rollback_plan: null,
    applied_at: null,
    rolled_back_at: null,
  };

  savePlan(repoRoot, plan);
  return plan;
}

// Simulate a migration plan: compute all changes without writing anything.
// Returns a dry-run report.
function dryRunMigrationPlan(repoRoot, planId) {
  const plan = loadPlan(repoRoot, planId);

  // Special dry-run for merge-pages
  if (plan.operation_type === 'merge-pages') {
    const sourcePaths = plan.from.page_paths;
    const targetPath = plan.to.target_path;
    const aliasesNeeded = sourcePaths.map((p) => ({ old_path: p, redirects_to: targetPath }));
    const report = {
      plan_id: planId,
      operation_type: 'merge-pages',
      scope: plan.scope,
      risk_level: plan.risk_level,
      affected_count: sourcePaths.length,
      source_pages: sourcePaths,
      target_page: targetPath,
      aliases_needed: aliasesNeeded,
      archive_sources: true,
      simulated_at: formatTimestamp(),
    };
    plan.dry_run_report = report;
    plan.status = 'reviewed';
    savePlan(repoRoot, plan);
    return report;
  }

  const affectedPages = findMatchingPages(repoRoot, plan.from);

  const pathChanges = [];
  const taxonomyChanges = [];
  const aliasesNeeded = [];
  const crossRefImpact = [];

  for (const page of affectedPages) {
    const change = { path: page.path, page_id: page.page_id || null, before: {}, after: {} };

    // Domain-level (big classification) changes
    if (plan.to.domain && plan.to.domain !== page.domain) {
      change.before.domain = page.domain;
      change.after.domain = plan.to.domain;
      taxonomyChanges.push({ kind: 'domain', old: page.domain, new: plan.to.domain });
    }

    // Collection-level (navigation bucket) changes
    if (plan.to.collection !== undefined && plan.to.collection !== page.collection) {
      change.before.collection = page.collection;
      change.after.collection = plan.to.collection;
    }

    // Subtype-level (small classification) changes
    if (plan.to.subtype !== undefined && plan.to.subtype !== page.subtype) {
      change.before.subtype = page.subtype;
      change.after.subtype = plan.to.subtype;
      taxonomyChanges.push({ kind: 'subtype', old: page.subtype, new: plan.to.subtype });
    }

    // Primary type changes
    if (plan.to.primary_type && plan.to.primary_type !== page.primary_type) {
      change.before.primary_type = page.primary_type;
      change.after.primary_type = plan.to.primary_type;
    }

    // Compute new path if domain or collection changes
    const oldRelPath = page.path.replace(/^canon\/domains\//, '').replace(/\.md$/, '');
    const pathParts = oldRelPath.split('/');
    const oldDomain = pathParts[0];
    const oldSlug = pathParts[pathParts.length - 1];
    const newDomain = plan.to.domain || oldDomain;
    const newCollection = plan.to.collection !== undefined
      ? plan.to.collection
      : (pathParts.length >= 3 ? pathParts.slice(1, -1).join('/') : '');
    const newRelPath = newCollection
      ? `${newDomain}/${newCollection}/${oldSlug}`
      : `${newDomain}/${oldSlug}`;
    const newPath = `canon/domains/${newRelPath}.md`;

    if (newPath !== page.path) {
      pathChanges.push({ old_path: page.path, new_path: newPath });
      if (page.page_id) {
        aliasesNeeded.push({ old_path: page.path, page_id: page.page_id });
      }
    }

    change.new_path = newPath !== page.path ? newPath : null;
    pathChanges.push && (change.path_change = newPath !== page.path);
    crossRefImpact.push(...(page.cross_refs || []));
  }

  const report = {
    plan_id: planId,
    operation_type: plan.operation_type,
    scope: plan.scope,
    risk_level: plan.risk_level,
    affected_count: affectedPages.length,
    path_changes: pathChanges.filter((item) => item.old_path !== item.new_path),
    taxonomy_changes: Array.from(new Map(taxonomyChanges.map((item) => [`${item.kind}:${item.old}`, item])).values()),
    aliases_needed: aliasesNeeded,
    cross_ref_impact_count: crossRefImpact.length,
    simulated_at: formatTimestamp(),
  };

  // Update plan with dry_run_report
  plan.dry_run_report = report;
  plan.status = 'reviewed';
  savePlan(repoRoot, plan);

  return report;
}

// Apply a merge-pages plan: archive source pages, record aliases, update target typed_refs.
function applyMergePages(repoRoot, plan, planId) {
  const sourcePaths = plan.from.page_paths;
  const targetWikiPath = plan.to.target_path; // wiki-relative, e.g. canon/domains/ai/rag/merged-guide.md
  const targetAbsPath = path.join(repoRoot, '.wiki', targetWikiPath);
  const archivedSources = [];
  const rollbackEntries = [];

  for (const srcPath of sourcePaths) {
    const srcAbsPath = path.join(repoRoot, '.wiki', srcPath);
    if (!fs.existsSync(srcAbsPath)) {
      continue;
    }
    const { frontmatter } = parseFrontmatterFile(srcAbsPath);

    // Capture full rollback state before mutating.
    // Keys absent before (not in frontmatter) go into delete_keys so rollback removes them cleanly.
    const rollback = {
      path: srcPath,
      original: { status: frontmatter.status || null },
      delete_keys: [],
      page_id: frontmatter.page_id || null,
    };
    if ('merged_into' in frontmatter) {
      rollback.original.merged_into = frontmatter.merged_into || null;
    } else {
      rollback.delete_keys.push('merged_into');
    }
    updateFrontmatterFile(srcAbsPath, { status: 'archived', merged_into: targetWikiPath });

    // Record alias: source path → source page_id (callers resolve target via merged_into field)
    if (frontmatter.page_id) {
      recordPathAlias(repoRoot, srcPath, frontmatter.page_id);
    }

    syncRuntimeFiles(repoRoot, [srcAbsPath]);
    rollbackEntries.push(rollback);
    archivedSources.push({ path: srcPath, page_id: frontmatter.page_id || null });
  }

  // Capture target's original typed_refs BEFORE modifying (needed for rollback)
  let targetOriginalTypedRefs = [];
  if (fs.existsSync(targetAbsPath)) {
    const { frontmatter: targetFm } = parseFrontmatterFile(targetAbsPath);
    targetOriginalTypedRefs = Array.isArray(targetFm.typed_refs) ? [...targetFm.typed_refs] : [];
    const newSupersedes = archivedSources
      .filter((s) => s.page_id)
      .map((s) => ({ target: s.page_id, type: 'supersedes' }));
    const allRefs = [...targetOriginalTypedRefs];
    for (const ref of newSupersedes) {
      if (!allRefs.some((r) => r.target === ref.target && r.type === ref.type)) {
        allRefs.push(ref);
      }
    }
    if (allRefs.length !== targetOriginalTypedRefs.length) {
      updateFrontmatterFile(targetAbsPath, { typed_refs: allRefs });
    }
    syncRuntimeFiles(repoRoot, [targetAbsPath]);
  }

  // Write migration log
  const logPath = getMigrationLogPath(repoRoot);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '# Migration Log\n\n', 'utf8');
  }
  const logEntry = [
    '',
    `## ${formatTimestamp()} ${plan.plan_id}`,
    '',
    `- operation: merge-pages`,
    `- scope: ${plan.scope}`,
    `- archived sources: ${archivedSources.length}`,
    `- target: ${targetWikiPath}`,
    `- reason: ${plan.reason || '~'}`,
  ].join('\n');
  fs.appendFileSync(logPath, `${logEntry}\n`, 'utf8');

  plan.status = 'applied';
  plan.applied_at = formatTimestamp();
  // Full rollback state: source entries + target original typed_refs
  plan.rollback_plan = {
    entries: rollbackEntries,
    target_path: targetWikiPath,
    target_original_typed_refs: targetOriginalTypedRefs,
  };
  savePlan(repoRoot, plan);

  return { plan_id: planId, applied: archivedSources.length, archived_sources: archivedSources, target: targetWikiPath };
}

// Apply a migration plan: execute all structural changes.
// Only applies plans with status 'reviewed' (must dry-run first).
function applyMigrationPlan(repoRoot, planId, options = {}) {
  const plan = loadPlan(repoRoot, planId);
  if (plan.status === 'applied') {
    throw new Error(`migration plan ${planId} has already been applied`);
  }
  if (plan.status === 'draft' && !options.force) {
    throw new Error(`migration plan ${planId} must be dry-run first (status is 'draft'). Run dry-run or pass force=true`);
  }

  // Handle merge-pages: archive source pages, record aliases, update target typed_refs
  if (plan.operation_type === 'merge-pages') {
    return applyMergePages(repoRoot, plan, planId);
  }

  const affectedPages = findMatchingPages(repoRoot, plan.from);
  const rollbackEntries = [];
  const appliedChanges = [];

  for (const page of affectedPages) {
    const absolutePath = path.join(repoRoot, '.wiki', page.path);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    const { frontmatter } = parseFrontmatterFile(absolutePath);
    const updates = {};
    const rollback = { path: page.path, original: {}, delete_keys: [] };

    // Apply domain (big classification) change
    if (plan.to.domain && plan.to.domain !== frontmatter.domain) {
      rollback.original.domain = frontmatter.domain;
      updates.domain = plan.to.domain;
    }

    // Apply collection (placement) change
    if (plan.to.collection !== undefined && plan.to.collection !== frontmatter.collection) {
      rollback.original.collection = frontmatter.collection;
      updates.collection = plan.to.collection || null;
    }

    // Apply subtype (small classification) change
    if (plan.to.subtype !== undefined && plan.to.subtype !== frontmatter.subtype) {
      rollback.original.subtype = frontmatter.subtype;
      updates.subtype = plan.to.subtype || null;
    }

    // Apply primary_type change
    if (plan.to.primary_type && plan.to.primary_type !== frontmatter.primary_type) {
      rollback.original.primary_type = frontmatter.primary_type;
      updates.primary_type = plan.to.primary_type;
    }

    // Archive pages when operation_type=deprecate
    if (plan.operation_type === 'deprecate' && frontmatter.status !== 'archived') {
      rollback.original.status = frontmatter.status || null;
      updates.status = 'archived';
    }

    if (Object.keys(updates).length) {
      updateFrontmatterFile(absolutePath, updates);
    }

    // Compute new path if domain or collection changes
    const oldRelPath = page.path.replace(/^canon\/domains\//, '').replace(/\.md$/, '');
    const pathParts = oldRelPath.split('/');
    const oldDomain = pathParts[0];
    const oldSlug = pathParts[pathParts.length - 1];
    const newDomain = plan.to.domain || oldDomain;
    const newCollection = plan.to.collection !== undefined
      ? plan.to.collection
      : (pathParts.length >= 3 ? pathParts.slice(1, -1).join('/') : '');
    const newRelPath = newCollection
      ? `${newDomain}/${newCollection}/${oldSlug}`
      : `${newDomain}/${oldSlug}`;
    const newAbsolutePath = path.join(repoRoot, '.wiki', 'canon', 'domains', `${newRelPath}.md`);

    if (newAbsolutePath !== absolutePath) {
      // Collision guard: refuse to overwrite an existing destination file.
      // Without this check, fs.renameSync silently destroys the destination page.
      if (fs.existsSync(newAbsolutePath)) {
        throw new Error(
          `reclassify collision: destination already exists: ${wikiRelative(repoRoot, newAbsolutePath)}. ` +
          `Merge or rename the conflicting page before reclassifying.`
        );
      }
      fs.mkdirSync(path.dirname(newAbsolutePath), { recursive: true });
      fs.renameSync(absolutePath, newAbsolutePath);
      rollback.new_path = `canon/domains/${newRelPath}.md`;
      // Record alias: old path → page_id
      if (frontmatter.page_id) {
        recordPathAlias(repoRoot, page.path, frontmatter.page_id);
      }
      syncRuntimeFiles(repoRoot, [absolutePath, newAbsolutePath]);
    } else {
      syncRuntimeFiles(repoRoot, [absolutePath]);
    }

    rollbackEntries.push(rollback);
    appliedChanges.push({ old_path: page.path, new_path: `canon/domains/${newRelPath}.md`, updates });
  }

  // Record taxonomy aliases for rename-domain / merge-subtype
  if (plan.operation_type === 'rename-domain' && plan.from.domain && plan.to.domain) {
    recordTaxonomyAlias(repoRoot, 'domain', plan.from.domain, plan.to.domain);
  }
  if (plan.operation_type === 'merge-subtype' && plan.from.subtype && plan.to.subtype) {
    recordTaxonomyAlias(repoRoot, 'subtype', plan.from.subtype, plan.to.subtype);
  }

  // Write migration log
  const logPath = getMigrationLogPath(repoRoot);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '# Migration Log\n\n', 'utf8');
  }
  const logEntry = [
    '',
    `## ${formatTimestamp()} ${plan.plan_id}`,
    '',
    `- operation: ${plan.operation_type}`,
    `- scope: ${plan.scope}`,
    `- affected: ${appliedChanges.length} pages`,
    `- risk: ${plan.risk_level}`,
    `- reason: ${plan.reason || '~'}`,
  ].join('\n');
  fs.appendFileSync(logPath, `${logEntry}\n`, 'utf8');

  // Update plan status
  plan.status = 'applied';
  plan.applied_at = formatTimestamp();
  plan.rollback_plan = { entries: rollbackEntries };
  savePlan(repoRoot, plan);

  return { plan_id: planId, applied: appliedChanges.length, changes: appliedChanges };
}

// Rollback a previously applied migration plan.
function rollbackMigrationPlan(repoRoot, planId) {
  const plan = loadPlan(repoRoot, planId);
  if (plan.status !== 'applied') {
    throw new Error(`migration plan ${planId} is not in 'applied' state (current: ${plan.status})`);
  }
  if (!plan.rollback_plan || !Array.isArray(plan.rollback_plan.entries)) {
    throw new Error(`migration plan ${planId} has no rollback data`);
  }

  const rolledBack = [];
  for (const entry of plan.rollback_plan.entries) {
    const currentPath = entry.new_path
      ? path.join(repoRoot, '.wiki', entry.new_path)
      : path.join(repoRoot, '.wiki', entry.path);
    const originalAbsPath = path.join(repoRoot, '.wiki', entry.path);

    if (!fs.existsSync(currentPath)) {
      continue;
    }
    // Restore original frontmatter fields (status, merged_into, domain, etc.)
    if (Object.keys(entry.original).length) {
      updateFrontmatterFile(currentPath, entry.original);
    }
    // Delete keys that didn't exist before this migration (e.g., merged_into added by merge-pages)
    if (Array.isArray(entry.delete_keys) && entry.delete_keys.length) {
      const deletions = Object.fromEntries(entry.delete_keys.map((k) => [k, undefined]));
      updateFrontmatterFile(currentPath, deletions);
    }
    // Restore original path if it was moved
    if (entry.new_path && currentPath !== originalAbsPath) {
      fs.mkdirSync(path.dirname(originalAbsPath), { recursive: true });
      fs.renameSync(currentPath, originalAbsPath);
      syncRuntimeFiles(repoRoot, [currentPath, originalAbsPath]);
    } else {
      syncRuntimeFiles(repoRoot, [currentPath]);
    }
    rolledBack.push(entry.path);
  }

  // merge-pages: also restore target page's original typed_refs
  if (plan.operation_type === 'merge-pages' && plan.rollback_plan.target_path) {
    const targetAbsPath = path.join(repoRoot, '.wiki', plan.rollback_plan.target_path);
    if (fs.existsSync(targetAbsPath)) {
      const originalRefs = Array.isArray(plan.rollback_plan.target_original_typed_refs)
        ? plan.rollback_plan.target_original_typed_refs
        : [];
      updateFrontmatterFile(targetAbsPath, { typed_refs: originalRefs });
      syncRuntimeFiles(repoRoot, [targetAbsPath]);
    }
  }

  const logPath = getMigrationLogPath(repoRoot);
  if (fs.existsSync(logPath)) {
    const logEntry = [
      '',
      `## ${formatTimestamp()} ROLLBACK ${plan.plan_id}`,
      '',
      `- rolled_back: ${rolledBack.length} pages`,
    ].join('\n');
    fs.appendFileSync(logPath, `${logEntry}\n`, 'utf8');
  }

  plan.status = 'rolled-back';
  plan.rolled_back_at = formatTimestamp();
  savePlan(repoRoot, plan);

  return { plan_id: planId, rolled_back: rolledBack.length };
}

// List all migration plans, optionally filtered by status.
function listMigrationPlans(repoRoot, filterStatus = '') {
  const migrationsDir = getMigrationsDir(repoRoot);
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  const plans = [];
  for (const file of fs.readdirSync(migrationsDir)) {
    if (!file.endsWith('.json')) {
      continue;
    }
    try {
      const plan = readJsonFile(path.join(migrationsDir, file));
      if (!filterStatus || plan.status === filterStatus) {
        plans.push({
          plan_id: plan.plan_id,
          operation_type: plan.operation_type,
          scope: plan.scope,
          risk_level: plan.risk_level,
          status: plan.status,
          affected_count: (plan.affected_page_paths || []).length,
          created_at: plan.created_at,
          applied_at: plan.applied_at || null,
        });
      }
    } catch {
      // skip malformed plan files
    }
  }
  return plans.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

module.exports = {
  OPERATION_TYPES,
  applyMigrationPlan,
  createMigrationPlan,
  dryRunMigrationPlan,
  findMatchingPages,
  listMigrationPlans,
  loadPlan,
  rollbackMigrationPlan,
};
