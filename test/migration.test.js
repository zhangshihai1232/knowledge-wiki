'use strict';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite is an experimental feature/.test(warning.message)) {
    return;
  }
  console.warn(warning.stack || String(warning));
});

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { scaffoldRepo } = require('../src/lib/bootstrap');
const { createCanon, extractCollection, generatePageId } = require('../src/lib/wiki-internal');
const { parseFrontmatterFile } = require('../src/lib/frontmatter');
const { openRuntimeIndex } = require('../src/lib/runtime-index');
const { recordPathAlias, recordTaxonomyAlias, resolvePathAlias, resolveTaxonomyAlias } = require('../src/lib/alias');
const {
  createMigrationPlan,
  dryRunMigrationPlan,
  applyMigrationPlan,
  rollbackMigrationPlan,
  listMigrationPlans,
} = require('../src/lib/migration');
const {
  deprecateTaxonomyItem,
  validateClassification,
  registerDomain,
  getTaxonomySnapshot,
} = require('../src/lib/taxonomy');

function makeTempRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-wiki-migrate-test-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
  const repoPath = path.join(root, 'demo');
  scaffoldRepo({
    repoRoot: path.resolve(__dirname, '..'),
    configPath: path.join(root, 'config', 'namespaces.conf'),
    targetDir: repoPath,
    repoName: 'Demo Wiki',
    force: true,
  });
  return repoPath;
}

test('generatePageId produces a stable non-empty string with pg_ prefix', () => {
  const id1 = generatePageId();
  const id2 = generatePageId();
  assert.ok(id1.startsWith('pg_'), `expected pg_ prefix, got: ${id1}`);
  assert.ok(id2.startsWith('pg_'), `expected pg_ prefix, got: ${id2}`);
  assert.notEqual(id1, id2, 'two sequential IDs should be unique');
});

test('extractCollection returns middle path segment', () => {
  assert.equal(extractCollection('ai/rag/chunk-strategy'), 'rag');
  assert.equal(extractCollection('ai/databases/vector-db'), 'databases');
  assert.equal(extractCollection('ai/concept-page'), '');
  assert.equal(extractCollection('ai'), '');
  assert.equal(extractCollection(''), '');
  // nested collection
  assert.equal(extractCollection('engineering/infra/storage/sqlite-design'), 'infra/storage');
});

test('createCanon writes page_id and collection to frontmatter and SQLite', (t) => {
  const repoPath = makeTempRepo(t);
  const filePath = createCanon(repoPath, {
    targetPage: 'ai/rag/chunk-size-strategy',
    type: 'concept',
    title: 'Chunk Size Strategy',
    sources: [],
  });

  const { frontmatter } = parseFrontmatterFile(filePath);
  assert.ok(frontmatter.page_id, 'page_id should be set');
  assert.ok(frontmatter.page_id.startsWith('pg_'), 'page_id should start with pg_');
  assert.equal(frontmatter.collection, 'rag', 'collection should be extracted from path');
  assert.equal(frontmatter.domain, 'ai', 'domain should be ai');

  // Also verify SQLite was updated
  const db = openRuntimeIndex(repoPath);
  const row = db.prepare("SELECT page_id, collection FROM pages WHERE path = 'canon/domains/ai/rag/chunk-size-strategy.md'").get();
  assert.ok(row, 'page should be indexed in SQLite');
  assert.equal(row.page_id, frontmatter.page_id, 'SQLite page_id should match frontmatter');
  assert.equal(row.collection, 'rag', 'SQLite collection should be rag');
});

test('createCanon without collection segment leaves collection null', (t) => {
  const repoPath = makeTempRepo(t);
  const filePath = createCanon(repoPath, {
    targetPage: 'product/feature-flags',
    type: 'concept',
    title: 'Feature Flags',
    sources: [],
  });
  const { frontmatter } = parseFrontmatterFile(filePath);
  assert.equal(frontmatter.collection, null, 'collection should be null when no middle path segment');
});

test('alias: recordPathAlias and resolvePathAlias round-trip', (t) => {
  const repoPath = makeTempRepo(t);
  const oldPath = 'canon/domains/ai/rag/chunk-strategy.md';
  const pageId = generatePageId();

  recordPathAlias(repoPath, oldPath, pageId);
  const resolved = resolvePathAlias(repoPath, oldPath);
  assert.equal(resolved, pageId, 'resolved page_id should match recorded');

  // Unknown path returns null
  const unknown = resolvePathAlias(repoPath, 'canon/domains/nonexistent.md');
  assert.equal(unknown, null, 'unknown path should return null');
});

test('alias: recordTaxonomyAlias and resolveTaxonomyAlias round-trip', (t) => {
  const repoPath = makeTempRepo(t);
  recordTaxonomyAlias(repoPath, 'domain', 'rag', 'retrieval');
  assert.equal(resolveTaxonomyAlias(repoPath, 'domain', 'rag'), 'retrieval');
  assert.equal(resolveTaxonomyAlias(repoPath, 'domain', 'ai'), 'ai', 'unknown value should pass through unchanged');
});

test('migration: createMigrationPlan produces a plan file with correct fields', (t) => {
  const repoPath = makeTempRepo(t);
  // Seed a canon page to have something to match
  createCanon(repoPath, {
    targetPage: 'ai/rag/chunk-strategy',
    type: 'concept',
    title: 'Chunk Strategy',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    scope: 'move rag pages to retrieval domain',
    from: { domain: 'ai', collection: 'rag' },
    to: { domain: 'ai', collection: 'retrieval' },
    reason: 'rag is a vague term',
  });

  assert.ok(plan.plan_id.startsWith('mig_'), 'plan_id should start with mig_');
  assert.equal(plan.operation_type, 'reclassify');
  assert.equal(plan.status, 'draft');
  assert.ok(Array.isArray(plan.affected_page_paths), 'affected_page_paths should be an array');
  assert.ok(plan.affected_page_paths.length >= 1, 'should affect the seeded page');
});

test('migration: dry-run produces a report and updates plan status', (t) => {
  const repoPath = makeTempRepo(t);
  createCanon(repoPath, {
    targetPage: 'ai/rag/embedding-strategy',
    type: 'guide',
    title: 'Embedding Strategy',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'relocate',
    scope: 'rag → retrieval bucket',
    from: { domain: 'ai', collection: 'rag' },
    to: { collection: 'retrieval' },
  });

  const report = dryRunMigrationPlan(repoPath, plan.plan_id);
  assert.equal(report.plan_id, plan.plan_id);
  assert.ok(typeof report.affected_count === 'number');
  assert.ok(Array.isArray(report.path_changes));
  assert.ok(Array.isArray(report.taxonomy_changes));
});

test('migration: apply then rollback restores original state', (t) => {
  const repoPath = makeTempRepo(t);
  const filePath = createCanon(repoPath, {
    targetPage: 'engineering/infra/storage-design',
    type: 'concept',
    title: 'Storage Design',
    sources: [],
  });

  const { frontmatter: before } = parseFrontmatterFile(filePath);
  assert.equal(before.domain, 'engineering');
  assert.equal(before.collection, 'infra');

  // Plan: move from engineering/infra collection to engineering/platform
  const plan = createMigrationPlan(repoPath, {
    operation_type: 'relocate',
    scope: 'infra → platform',
    from: { domain: 'engineering', collection: 'infra' },
    to: { collection: 'platform' },
  });

  // Must dry-run before apply
  dryRunMigrationPlan(repoPath, plan.plan_id);
  const applyResult = applyMigrationPlan(repoPath, plan.plan_id);
  assert.ok(applyResult.applied >= 1, 'at least one page should have been changed');

  // The new file should exist
  const newFilePath = path.join(repoPath, '.wiki', 'canon', 'domains', 'engineering', 'platform', 'storage-design.md');
  assert.ok(fs.existsSync(newFilePath), 'relocated file should exist at new path');

  // Rollback
  const rollbackResult = rollbackMigrationPlan(repoPath, plan.plan_id);
  assert.ok(rollbackResult.rolled_back >= 1);

  // Original path should be restored
  assert.ok(fs.existsSync(filePath), 'original file should be restored after rollback');
});

test('migration: listMigrationPlans returns all plans in created-at desc order', (t) => {
  const repoPath = makeTempRepo(t);
  createCanon(repoPath, {
    targetPage: 'product/decisions/feature-x',
    type: 'decision',
    title: 'Feature X Decision',
    sources: [],
  });

  createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    scope: 'plan-A',
    from: { domain: 'product' },
    to: { subtype: 'workflow' },
  });
  createMigrationPlan(repoPath, {
    operation_type: 'deprecate',
    scope: 'plan-B',
    from: { domain: 'product' },
    to: { subtype: 'archive' },
  });

  const plans = listMigrationPlans(repoPath);
  assert.ok(plans.length >= 2, 'should list at least 2 plans');
  // Verify descending order by created_at
  for (let i = 1; i < plans.length; i += 1) {
    assert.ok(plans[i - 1].created_at >= plans[i].created_at, 'plans should be in descending order');
  }
});

// ─── Data Mobility Tests ────────────────────────────────────────────────────

test('deprecateTaxonomyItem: marks a domain as deprecated', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'legacy-domain');

  const result = deprecateTaxonomyItem(repoPath, 'domain', 'legacy-domain', { replacedBy: 'engineering' });
  assert.equal(result.kind, 'domain');
  assert.equal(result.id, 'legacy-domain');
  assert.equal(result.status, 'deprecated');
  assert.equal(result.replaced_by, 'engineering');

  // Snapshot should reflect deprecated status
  const snapshot = getTaxonomySnapshot(repoPath);
  const item = snapshot.domains.find((d) => d.id === 'legacy-domain');
  assert.ok(item, 'item should still exist in registry');
  assert.equal(item.status, 'deprecated');
});

test('deprecateTaxonomyItem: throws for unknown item', (t) => {
  const repoPath = makeTempRepo(t);
  assert.throws(
    () => deprecateTaxonomyItem(repoPath, 'domain', 'nonexistent-xyz'),
    /not found in registry/
  );
});

test('validateClassification: returns valid for known active values', (t) => {
  const repoPath = makeTempRepo(t);
  const result = validateClassification(repoPath, { domain: 'ai', primary_type: 'concept' });
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test('validateClassification: detects deprecated domain', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'old-domain');
  deprecateTaxonomyItem(repoPath, 'domain', 'old-domain', { replacedBy: 'engineering' });

  const result = validateClassification(repoPath, { domain: 'old-domain' });
  assert.equal(result.valid, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].field, 'domain');
  assert.equal(result.issues[0].reason, 'deprecated');
  assert.equal(result.issues[0].replaced_by, 'engineering');
});

test('validateClassification: detects unknown domain', (t) => {
  const repoPath = makeTempRepo(t);
  const result = validateClassification(repoPath, { domain: 'totally-unknown-xyz' });
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].reason, 'unknown');
});

test('migration: deprecate op sets status=archived on affected pages', (t) => {
  const repoPath = makeTempRepo(t);
  createCanon(repoPath, {
    targetPage: 'ai/rag/old-concept',
    type: 'concept',
    title: 'Old Concept',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'deprecate',
    scope: 'archive old-concept',
    from: { domain: 'ai' },
    to: { domain: 'ai' }, // same domain, just archiving
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);

  const filePath = path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'rag', 'old-concept.md');
  const { frontmatter } = parseFrontmatterFile(filePath);
  assert.equal(frontmatter.status, 'archived', 'deprecate op should set status=archived');
});

test('migration: merge-pages archives sources and records aliases', (t) => {
  const repoPath = makeTempRepo(t);

  // Create two source pages
  createCanon(repoPath, {
    targetPage: 'ai/rag/source-page-a',
    type: 'concept',
    title: 'Source A',
    sources: [],
  });
  createCanon(repoPath, {
    targetPage: 'ai/rag/source-page-b',
    type: 'concept',
    title: 'Source B',
    sources: [],
  });

  // Create target page
  createCanon(repoPath, {
    targetPage: 'ai/rag/merged-page',
    type: 'concept',
    title: 'Merged Page',
    sources: [],
  });

  const srcPathA = 'canon/domains/ai/rag/source-page-a.md';
  const srcPathB = 'canon/domains/ai/rag/source-page-b.md';
  const targetPath = 'canon/domains/ai/rag/merged-page.md';

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'merge-pages',
    scope: 'merge A+B into merged',
    from: { page_paths: [srcPathA, srcPathB] },
    to: { target_path: targetPath },
  });

  assert.equal(plan.operation_type, 'merge-pages');
  assert.equal(plan.risk_level, 'medium');
  assert.equal(plan.status, 'draft');

  const report = dryRunMigrationPlan(repoPath, plan.plan_id);
  assert.equal(report.affected_count, 2);
  assert.equal(report.target_page, targetPath);
  assert.ok(report.archive_sources);

  const result = applyMigrationPlan(repoPath, plan.plan_id);
  assert.equal(result.applied, 2);

  // Source pages should be archived
  const fmA = parseFrontmatterFile(path.join(repoPath, '.wiki', srcPathA)).frontmatter;
  const fmB = parseFrontmatterFile(path.join(repoPath, '.wiki', srcPathB)).frontmatter;
  assert.equal(fmA.status, 'archived');
  assert.equal(fmB.status, 'archived');
  assert.equal(fmA.merged_into, targetPath);

  // Target page should have typed_refs supersedes entries
  const fmTarget = parseFrontmatterFile(path.join(repoPath, '.wiki', targetPath)).frontmatter;
  const supersedes = (fmTarget.typed_refs || []).filter((r) => r.type === 'supersedes');
  assert.ok(supersedes.length >= 1, 'target should have supersedes typed_refs for merged sources');
});
