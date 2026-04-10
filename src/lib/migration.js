'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatterFile, updateFrontmatterFile } = require('./frontmatter');
const { withRuntimeIndex, syncRuntimeFiles, escapeLike } = require('./runtime-index');
const { recordPathAlias, recordTaxonomyAlias } = require('./alias');
const { loadAliases, saveAliases } = require('./alias');
const { deprecateTaxonomyItem, getTaxonomySnapshot } = require('./taxonomy');
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
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`migration: invalid JSON file ${filePath}: ${err.message}`);
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function getPlanPath(repoRoot, planId) {
  return path.join(getMigrationsDir(repoRoot), `${planId}.json`);
}

function loadPlan(repoRoot, planId) {
  const planPath = getPlanPath(repoRoot, planId);
  if (!fs.existsSync(planPath)) {
    throw new Error(`migration plan not found: ${planId}`);
  }
  const plan = readJsonFile(planPath);
  if (!plan || typeof plan !== 'object') {
    throw new Error(`migration plan ${planId} is invalid`);
  }
  if (!OPERATION_TYPES.includes(plan.operation_type)) {
    throw new Error(`migration plan ${planId} has unknown operation_type: ${plan.operation_type}`);
  }
  return plan;
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

function validateMergePagesSpec(fromPagePaths, targetPath) {
  const normalizedSourcePaths = (Array.isArray(fromPagePaths) ? fromPagePaths : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (normalizedSourcePaths.length < 2) {
    throw new Error('migration merge-pages: from.page_paths must be an array of at least 2 source page paths');
  }
  if (!targetPath) {
    throw new Error('migration merge-pages: to.target_path is required (the destination page wiki-relative path)');
  }
  const duplicateSourcePaths = normalizedSourcePaths.filter((item, index) => normalizedSourcePaths.indexOf(item) !== index);
  if (duplicateSourcePaths.length > 0) {
    throw new Error(
      `migration merge-pages: from.page_paths must be distinct (duplicate: ${Array.from(new Set(duplicateSourcePaths)).join(', ')})`
    );
  }
  if (normalizedSourcePaths.includes(targetPath)) {
    throw new Error('migration merge-pages: to.target_path must not also appear in from.page_paths');
  }
  return normalizedSourcePaths;
}

function computePathChange(page, to) {
  const oldRelPath = page.path.replace(/^canon\/domains\//, '').replace(/\.md$/, '');
  const pathParts = oldRelPath.split('/');
  const oldDomain = pathParts[0];
  const oldSlug = pathParts[pathParts.length - 1];
  const newDomain = to.domain || oldDomain;
  const newCollection = to.collection !== undefined
    ? to.collection
    : (pathParts.length >= 3 ? pathParts.slice(1, -1).join('/') : '');
  const newRelPath = newCollection
    ? `${newDomain}/${newCollection}/${oldSlug}`
    : `${newDomain}/${oldSlug}`;
  const newPath = `canon/domains/${newRelPath}.md`;
  return {
    old_path: page.path,
    new_path: newPath,
    page_id: page.page_id || null,
    old_domain: oldDomain,
    old_slug: oldSlug,
    new_domain: newDomain,
    new_collection: newCollection,
    new_rel_path: newRelPath,
  };
}

function detectPathCollisions(repoRoot, pathChanges) {
  const collisions = [];
  const changedPaths = pathChanges.filter((item) => item.old_path !== item.new_path);
  const byDestination = new Map();

  for (const change of changedPaths) {
    const current = byDestination.get(change.new_path) || [];
    current.push(change);
    byDestination.set(change.new_path, current);
  }

  for (const [newPath, items] of byDestination.entries()) {
    if (items.length > 1) {
      collisions.push({
        type: 'internal',
        new_path: newPath,
        old_paths: items.map((item) => item.old_path),
        page_ids: items.map((item) => item.page_id).filter(Boolean),
      });
    }
    const newAbsPath = path.join(repoRoot, '.wiki', newPath);
    if (fs.existsSync(newAbsPath)) {
      collisions.push({
        type: 'existing',
        new_path: newPath,
        old_paths: items.map((item) => item.old_path),
        page_ids: items.map((item) => item.page_id).filter(Boolean),
      });
    }
  }

  return collisions;
}

function formatCollisionError(collisions) {
  return (
    `reclassify collision: ${collisions.length} destination path(s) are not safe to apply:\n` +
    collisions.map((item) => {
      const reason = item.type === 'internal' ? 'multiple source pages converge here' : 'destination already exists';
      return `  - ${item.new_path} (${reason})`;
    }).join('\n') +
    '\nResolve collisions (merge/rename/skip) before applying.'
  );
}

// Find all canon pages matching a filter spec.
// filter: {
//   domain?,             — match primary domain
//   include_secondary?,  — when true, also match pages listing domain in secondary_domains_json
//   collection?, subtype?, primary_type?,
//   confidence?,         — match pages with this confidence level
//   subtype_is_null?,    — when true, match pages with no subtype (unclassified)
//   page_ids?,           — array of page_id strings for precise page selection
// }
function findMatchingPages(repoRoot, filter) {
  return withRuntimeIndex(repoRoot, (db) => {
    const conditions = ["status != 'archived'"];
    const params = [];
    if (filter.domain) {
      if (filter.include_secondary) {
        // Match primary domain OR secondary_domains_json contains the domain value.
        // Escape LIKE special chars (_, %) to prevent domain names like "ai_tools" from mismatching.
        const likePattern = `%"${escapeLike(filter.domain)}"%`;
        conditions.push("(domain = ? OR secondary_domains_json LIKE ? ESCAPE '\\')");
        params.push(filter.domain, likePattern);
      } else {
        conditions.push('domain = ?');
        params.push(filter.domain);
      }
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
    return db.prepare(`SELECT path, title, domain, collection, subtype, primary_type, page_id, secondary_domains_json FROM pages ${where}`).all(...params);
  });
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
    const sourcePaths = validateMergePagesSpec(from.page_paths, to.target_path);
    const planId = generatePlanId(operationType, options.scope);
    const plan = {
      plan_id: planId,
      operation_type: operationType,
      scope: options.scope || 'merge-pages',
      reason: options.reason || null,
      from: { ...from, page_paths: sourcePaths },
      to,
      affected_page_ids: [],
      affected_page_paths: sourcePaths,
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

  // Prevent status regression: an applied or rolled-back plan cannot be dry-run again.
  if (plan.status === 'applied') {
    throw new Error(`migration plan ${planId} has already been applied and cannot be dry-run again. Create a new plan if needed.`);
  }
  if (plan.status === 'rolled-back') {
    throw new Error(`migration plan ${planId} has been rolled back. Create a new plan to re-attempt.`);
  }

  // Special dry-run for merge-pages
  if (plan.operation_type === 'merge-pages') {
    const sourcePaths = validateMergePagesSpec(plan.from.page_paths, plan.to.target_path);
    const targetPath = plan.to.target_path;
    const targetAbsPath = path.join(repoRoot, '.wiki', targetPath);
    const aliasesNeeded = sourcePaths.map((p) => ({ old_path: p, redirects_to: targetPath }));
    const missingSources = sourcePaths.filter((sourcePath) => !fs.existsSync(path.join(repoRoot, '.wiki', sourcePath)));
    const validationErrors = [];
    if (!fs.existsSync(targetAbsPath)) {
      validationErrors.push(`target page does not exist: ${targetPath}`);
    }
    if (missingSources.length > 0) {
      validationErrors.push(`missing source pages: ${missingSources.join(', ')}`);
    }
    const report = {
      plan_id: planId,
      operation_type: 'merge-pages',
      scope: plan.scope,
      risk_level: plan.risk_level,
      affected_count: sourcePaths.length,
      source_pages: sourcePaths,
      target_page: targetPath,
      aliases_needed: aliasesNeeded,
      target_exists: fs.existsSync(targetAbsPath),
      missing_sources: missingSources,
      validation_errors: validationErrors,
      ready_to_apply: validationErrors.length === 0,
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
    const pathChange = computePathChange(page, plan.to);
    const newPath = pathChange.new_path;

    if (newPath !== page.path) {
      pathChanges.push(pathChange);
      if (page.page_id) {
        aliasesNeeded.push({ old_path: page.path, page_id: page.page_id });
      }
    }

    change.new_path = newPath !== page.path ? newPath : null;
    pathChanges.push && (change.path_change = newPath !== page.path);

    // Load cross_refs from frontmatter to accurately report broken-link risk.
    const absPagePath = path.join(repoRoot, '.wiki', page.path);
    if (fs.existsSync(absPagePath)) {
      try {
        const { frontmatter } = parseFrontmatterFile(absPagePath);
        const refs = Array.isArray(frontmatter.cross_refs) ? frontmatter.cross_refs : [];
        crossRefImpact.push(...refs);
      } catch (_) {
        // Non-fatal: skip cross_ref loading for this page
      }
    }
  }

  const collisions = detectPathCollisions(repoRoot, pathChanges);

  const report = {
    plan_id: planId,
    operation_type: plan.operation_type,
    scope: plan.scope,
    risk_level: plan.risk_level,
    affected_count: affectedPages.length,
    path_changes: pathChanges.filter((item) => item.old_path !== item.new_path),
    collisions_detected: collisions.length,
    collisions: collisions,
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
  const sourcePaths = validateMergePagesSpec(plan.from.page_paths, plan.to.target_path);
  const targetWikiPath = plan.to.target_path; // wiki-relative, e.g. canon/domains/ai/rag/merged-guide.md
  const targetAbsPath = path.join(repoRoot, '.wiki', targetWikiPath);
  const archivedSources = [];

  // Guard: target must exist before archiving sources to prevent knowledge loss.
  if (!fs.existsSync(targetAbsPath)) {
    throw new Error(
      `merge-pages: target page does not exist: ${targetWikiPath}. ` +
      'Create the target page first (via wiki import or wiki internal create-canon), then apply.'
    );
  }

  // Capture target's original typed_refs BEFORE modifying (needed for rollback)
  const { frontmatter: targetFm } = parseFrontmatterFile(targetAbsPath);
  const targetOriginalTypedRefs = Array.isArray(targetFm.typed_refs) ? [...targetFm.typed_refs] : [];

  plan.status = 'applying';
  plan.applied_at = null;
  plan.rollback_plan = {
    entries: [],
    target_path: targetWikiPath,
    target_original_typed_refs: targetOriginalTypedRefs,
  };
  savePlan(repoRoot, plan);
  const rollbackEntries = plan.rollback_plan.entries;

  try {
    for (const srcPath of sourcePaths) {
      const srcAbsPath = path.join(repoRoot, '.wiki', srcPath);
      if (!fs.existsSync(srcAbsPath)) {
        throw new Error(`merge-pages: source page does not exist: ${srcPath}`);
      }
      const { frontmatter } = parseFrontmatterFile(srcAbsPath);

      // Capture rollback state BEFORE mutating and persist immediately.
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
      rollbackEntries.push(rollback);
      savePlan(repoRoot, plan);

      updateFrontmatterFile(srcAbsPath, { status: 'archived', merged_into: targetWikiPath });

      // Record alias: source path → source page_id (callers resolve target via merged_into field)
      if (frontmatter.page_id) {
        recordPathAlias(repoRoot, srcPath, frontmatter.page_id);
      }

      syncRuntimeFiles(repoRoot, [srcAbsPath]);
      archivedSources.push({ path: srcPath, page_id: frontmatter.page_id || null });
    }

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
    savePlan(repoRoot, plan);

    return { plan_id: planId, applied: archivedSources.length, archived_sources: archivedSources, target: targetWikiPath };
  } catch (err) {
    savePlan(repoRoot, plan);
    throw err;
  }
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
  const appliedChanges = [];
  const pathChanges = affectedPages.map((page) => computePathChange(page, plan.to));
  const collisions = detectPathCollisions(repoRoot, pathChanges);
  if (collisions.length > 0) {
    throw new Error(formatCollisionError(collisions));
  }

  plan.status = 'applying';
  plan.applied_at = null;
  plan.rollback_plan = { entries: [] };
  savePlan(repoRoot, plan);
  const rollbackEntries = plan.rollback_plan.entries;

  try {
    for (const page of affectedPages) {
      const absolutePath = path.join(repoRoot, '.wiki', page.path);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`migration apply: source page does not exist: ${page.path}`);
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

      const pathChange = computePathChange(page, plan.to);
      const newAbsolutePath = path.join(repoRoot, '.wiki', pathChange.new_path);
      const moved = newAbsolutePath !== absolutePath;
      if (moved) {
        rollback.new_path = pathChange.new_path;
      }

      // Persist rollback metadata BEFORE mutating any file.
      rollbackEntries.push(rollback);
      savePlan(repoRoot, plan);

      let currentPath = absolutePath;
      if (moved) {
        fs.mkdirSync(path.dirname(newAbsolutePath), { recursive: true });
        fs.renameSync(absolutePath, newAbsolutePath);
        currentPath = newAbsolutePath;
        if (frontmatter.page_id) {
          recordPathAlias(repoRoot, page.path, frontmatter.page_id);
        }
      }

      if (Object.keys(updates).length) {
        updateFrontmatterFile(currentPath, updates);
      }

      if (moved) {
        syncRuntimeFiles(repoRoot, [absolutePath, newAbsolutePath]);
      } else {
        syncRuntimeFiles(repoRoot, [currentPath]);
      }

      appliedChanges.push({ old_path: page.path, new_path: pathChange.new_path, updates });
    }

    // Record taxonomy aliases for rename-domain / merge-subtype
    if (plan.operation_type === 'rename-domain' && plan.from.domain && plan.to.domain) {
      recordTaxonomyAlias(repoRoot, 'domain', plan.from.domain, plan.to.domain);
    }
    if (plan.operation_type === 'merge-subtype' && plan.from.subtype && plan.to.subtype) {
      recordTaxonomyAlias(repoRoot, 'subtype', plan.from.subtype, plan.to.subtype);
      // Deprecate merged-away subtype if it is formally registered (LBYL — avoids brittle string match).
      // Wrapped in try/catch so taxonomy errors don't abort an otherwise-successful migration.
      try {
        const snapshot = getTaxonomySnapshot(repoRoot);
        const subtypeIsRegistered = snapshot.subtypes.some(
          (s) => s.id === plan.from.subtype && s.status !== 'deprecated'
        );
        if (subtypeIsRegistered) {
          deprecateTaxonomyItem(repoRoot, 'subtype', plan.from.subtype, { replaced_by: plan.to.subtype });
        }
        // If not registered: alias is sufficient — unregistered subtypes used only in frontmatter
      } catch (err) {
        // Advisory only: migration pages already moved. Deprecation failure is non-fatal.
        process.stderr.write(`Warning: could not auto-deprecate subtype "${plan.from.subtype}": ${err.message}\n`);
      }
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
    savePlan(repoRoot, plan);

    return { plan_id: planId, applied: appliedChanges.length, changes: appliedChanges };
  } catch (err) {
    savePlan(repoRoot, plan);
    throw err;
  }
}

// Rollback a previously applied migration plan.
function rollbackMigrationPlan(repoRoot, planId) {
  const plan = loadPlan(repoRoot, planId);
  if (plan.status !== 'applied' && plan.status !== 'applying') {
    throw new Error(`migration plan ${planId} is not in 'applied' or 'applying' state (current: ${plan.status})`);
  }
  if (!plan.rollback_plan || !Array.isArray(plan.rollback_plan.entries)) {
    throw new Error(`migration plan ${planId} has no rollback data`);
  }

  const rolledBack = [];
  for (const entry of plan.rollback_plan.entries) {
    if (!entry || typeof entry.path !== 'string' || !entry.path) {
      throw new Error(`migration plan ${planId} has invalid rollback entry (missing path)`);
    }
    if (!entry.original || typeof entry.original !== 'object') {
      throw new Error(`migration plan ${planId} has invalid rollback entry for ${entry.path} (missing original state)`);
    }
    if (entry.delete_keys !== undefined && !Array.isArray(entry.delete_keys)) {
      throw new Error(`migration plan ${planId} has invalid rollback entry for ${entry.path} (delete_keys must be an array)`);
    }

    const movedCurrentPath = entry.new_path
      ? path.join(repoRoot, '.wiki', entry.new_path)
      : null;
    const originalAbsPath = path.join(repoRoot, '.wiki', entry.path);
    const currentPath = movedCurrentPath && fs.existsSync(movedCurrentPath)
      ? movedCurrentPath
      : originalAbsPath;

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

  // Clean up path aliases that were recorded during apply for moved pages.
  // Without this, resolvePathAlias("old/path.md") would still return a page_id
  // even after the path has been restored to its original location.
  const aliases = loadAliases(repoRoot);
  let aliasChanged = false;
  for (const entry of plan.rollback_plan.entries) {
    if (entry.new_path && aliases.path_map[entry.path]) {
      delete aliases.path_map[entry.path];
      aliasChanged = true;
    }
  }
  if (plan.operation_type === 'rename-domain' && plan.from && plan.to && plan.from.domain && plan.to.domain) {
    if (aliases.taxonomy_map.domain && aliases.taxonomy_map.domain[plan.from.domain] === plan.to.domain) {
      delete aliases.taxonomy_map.domain[plan.from.domain];
      aliasChanged = true;
    }
  }
  if (plan.operation_type === 'merge-subtype' && plan.from && plan.to && plan.from.subtype && plan.to.subtype) {
    if (aliases.taxonomy_map.subtype && aliases.taxonomy_map.subtype[plan.from.subtype] === plan.to.subtype) {
      delete aliases.taxonomy_map.subtype[plan.from.subtype];
      aliasChanged = true;
    }
  }
  if (aliasChanged) {
    saveAliases(repoRoot, aliases);
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
