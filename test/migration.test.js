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
const { createCanon, extractCollection, generatePageId, maintainWorkflow, runInternalCommand } = require('../src/lib/wiki-internal');
const { parseFrontmatterFile, updateFrontmatterFile } = require('../src/lib/frontmatter');
const { openRuntimeIndex, syncRuntimeFiles } = require('../src/lib/runtime-index');
const { computeCheckFindings, findNamedFile, resolveUserFile } = require('../src/lib/wiki-repo');
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
  registerSubtype,
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
  db.close();
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
  assert.deepEqual(result.replaced_by, ['engineering']);

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
  assert.deepEqual(result.issues[0].replaced_by, ['engineering']);
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

test('migration: merge-pages rollback fully restores source and target', (t) => {
  const repoPath = makeTempRepo(t);

  createCanon(repoPath, {
    targetPage: 'ai/rag/rollback-src-a',
    type: 'concept',
    title: 'Rollback Src A',
    sources: [],
  });
  createCanon(repoPath, {
    targetPage: 'ai/rag/rollback-src-b',
    type: 'concept',
    title: 'Rollback Src B',
    sources: [],
  });
  createCanon(repoPath, {
    targetPage: 'ai/rag/rollback-target',
    type: 'concept',
    title: 'Rollback Target',
    sources: [],
  });

  const srcA = 'canon/domains/ai/rag/rollback-src-a.md';
  const srcB = 'canon/domains/ai/rag/rollback-src-b.md';
  const tgt = 'canon/domains/ai/rag/rollback-target.md';

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'merge-pages',
    scope: 'rollback-test',
    from: { page_paths: [srcA, srcB] },
    to: { target_path: tgt },
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);
  rollbackMigrationPlan(repoPath, plan.plan_id);

  // Sources should be restored: status=active, merged_into removed
  const fmA = parseFrontmatterFile(path.join(repoPath, '.wiki', srcA)).frontmatter;
  const fmB = parseFrontmatterFile(path.join(repoPath, '.wiki', srcB)).frontmatter;
  assert.equal(fmA.status, 'active', 'source-a should be active after rollback');
  assert.equal(fmB.status, 'active', 'source-b should be active after rollback');
  assert.ok(!fmA.merged_into, 'source-a merged_into should be absent/null after rollback');

  // Target should have original typed_refs (empty supersedes)
  const fmTarget = parseFrontmatterFile(path.join(repoPath, '.wiki', tgt)).frontmatter;
  const supersedes = (fmTarget.typed_refs || []).filter((r) => r.type === 'supersedes');
  assert.equal(supersedes.length, 0, 'target should have no supersedes after rollback');
});

test('migration: deprecate allows empty to spec (pure archive)', (t) => {
  const repoPath = makeTempRepo(t);

  createCanon(repoPath, {
    targetPage: 'ai/rag/pure-archive',
    type: 'concept',
    title: 'Pure Archive',
    sources: [],
  });

  // Should NOT throw — deprecate with empty to is valid
  const plan = createMigrationPlan(repoPath, {
    operation_type: 'deprecate',
    scope: 'pure-archive',
    from: { domain: 'ai' },
    to: {},
  });
  assert.equal(plan.operation_type, 'deprecate');

  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);

  const fp = path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'rag', 'pure-archive.md');
  const { frontmatter } = parseFrontmatterFile(fp);
  assert.equal(frontmatter.status, 'archived', 'page should be archived');
});

test('updateFrontmatterFile: undefined value deletes key', (t) => {
  const repoPath = makeTempRepo(t);
  const { updateFrontmatterFile: updateFm } = require('../src/lib/frontmatter');

  createCanon(repoPath, {
    targetPage: 'ai/rag/delete-key-test',
    type: 'concept',
    title: 'Delete Key Test',
    sources: [],
  });

  const fp = path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'rag', 'delete-key-test.md');
  updateFm(fp, { merged_into: 'some/path.md' });
  const fm1 = parseFrontmatterFile(fp).frontmatter;
  assert.equal(fm1.merged_into, 'some/path.md', 'key should be set');

  // Delete with undefined
  updateFm(fp, { merged_into: undefined });
  const fm2 = parseFrontmatterFile(fp).frontmatter;
  assert.ok(!('merged_into' in fm2), 'key should be absent after delete');
});

// ─── Regression tests for P0/P1/P2 fixes ───────────────────────────────────

test('P0: reclassify throws on destination collision instead of silently overwriting', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'tech', { label: 'Technology' });
  registerDomain(repoPath, 'ai', { label: 'AI' });

  // Create source page
  createCanon(repoPath, {
    targetPage: 'tech/collision-candidate',
    type: 'concept',
    title: 'Collision Candidate',
    sources: [],
  });
  // Create a page at the exact destination path so a collision will occur
  createCanon(repoPath, {
    targetPage: 'ai/collision-candidate',
    type: 'concept',
    title: 'AI Collision Candidate',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    name: 'p0-collision-test',
    operation_type: 'reclassify',
    from: { domain: 'tech' },
    to: { domain: 'ai' },
    reason: 'Regression test for P0 collision guard',
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);

  // Applying should throw — NOT silently overwrite the destination
  assert.throws(
    () => applyMigrationPlan(repoPath, plan.plan_id),
    /reclassify collision/,
    'Expected collision error when destination already exists'
  );

  // Destination page must still have original content (was NOT overwritten)
  const { frontmatter: destFm } = parseFrontmatterFile(
    path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'collision-candidate.md')
  );
  assert.equal(destFm.title, 'AI Collision Candidate', 'destination page should be unchanged');
});

test('P1: findMatchingPages supports subtype_is_null, confidence, and page_ids filters', (t) => {
  const repoPath = makeTempRepo(t);
  const { findMatchingPages } = require('../src/lib/migration');
  registerDomain(repoPath, 'search', { label: 'Search' });

  const pageWithSubtype = createCanon(repoPath, {
    targetPage: 'search/subtype-page',
    type: 'concept',
    title: 'Subtype Page',
    sources: [],
    subtype: 'semantic',
  });
  const pageNoSubtype = createCanon(repoPath, {
    targetPage: 'search/no-subtype-page',
    type: 'concept',
    title: 'No Subtype Page',
    sources: [],
  });

  // subtype_is_null: true should match only pages with no subtype
  const noSubtypeResults = findMatchingPages(repoPath, { domain: 'search', subtype_is_null: true });
  const paths = noSubtypeResults.map((r) => r.path);
  assert.ok(paths.some((p) => p.endsWith('no-subtype-page.md')), 'subtype_is_null filter should match unclassified page');
  assert.ok(!paths.some((p) => p.endsWith('subtype-page.md') && !p.includes('no-subtype')), 'subtype_is_null filter should exclude pages with subtype');

  // page_ids filter: exact page selection by page_id
  const { frontmatter: fm1 } = parseFrontmatterFile(pageWithSubtype);
  const byId = findMatchingPages(repoPath, { page_ids: [fm1.page_id] });
  assert.equal(byId.length, 1, 'page_ids filter should return exactly 1 match');
  assert.equal(byId[0].page_id, fm1.page_id, 'page_ids result should have matching page_id');

  // empty page_ids array should not crash; returns full set (no page_id constraint)
  const empty = findMatchingPages(repoPath, { page_ids: [] });
  assert.ok(Array.isArray(empty), 'empty page_ids array should return array without crashing');
});

test('P2: deprecateTaxonomyItem stores replaced_by as array and supports 1:N splits', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'legacy', { label: 'Legacy' });
  registerDomain(repoPath, 'new-a', { label: 'New A' });
  registerDomain(repoPath, 'new-b', { label: 'New B' });

  // Single replacement (string input) → still produces array
  const single = deprecateTaxonomyItem(repoPath, 'domain', 'legacy', { replacedBy: 'new-a' });
  assert.ok(Array.isArray(single.replaced_by), 'replaced_by should always be an array');
  assert.deepEqual(single.replaced_by, ['new-a'], 'single string should produce 1-element array');

  // Re-register legacy so we can test array input
  registerDomain(repoPath, 'legacy2', { label: 'Legacy2' });
  const multi = deprecateTaxonomyItem(repoPath, 'domain', 'legacy2', { replacedBy: ['new-a', 'new-b'] });
  assert.ok(Array.isArray(multi.replaced_by), 'replaced_by should be array');
  assert.deepEqual(multi.replaced_by, ['new-a', 'new-b'], '1:N split should preserve both targets');

  // No replacement → empty array (not undefined/null)
  registerDomain(repoPath, 'legacy3', { label: 'Legacy3' });
  const none = deprecateTaxonomyItem(repoPath, 'domain', 'legacy3');
  assert.ok(Array.isArray(none.replaced_by), 'replaced_by should be array even with no replacement');
  assert.equal(none.replaced_by.length, 0, 'no replacement → empty array');
});

test('Fix1: computeCheckFindings emits L012 (not S006) for pages with no subtype', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'topics', { label: 'Topics' });

  // Page with subtype — should NOT trigger L012
  createCanon(repoPath, {
    targetPage: 'topics/classified-page',
    type: 'concept',
    title: 'Classified Page',
    sources: [],
    subtype: 'overview',
  });

  // Page without subtype — SHOULD trigger L012
  createCanon(repoPath, {
    targetPage: 'topics/unclassified-page',
    type: 'concept',
    title: 'Unclassified Page',
    sources: [],
  });

  const findings = computeCheckFindings(repoPath);
  const l012 = findings.filter((f) => f.rule === 'L012');
  const s006 = findings.filter((f) => f.rule === 'S006');

  assert.equal(s006.length, 0, 'S006 should no longer exist (replaced by L012)');
  assert.ok(l012.length >= 1, 'L012 should fire for unclassified page');
  assert.ok(l012.some((f) => f.targetPath.endsWith('/topics/unclassified-page.md')), 'L012 should point to the unclassified page');
  assert.ok(!l012.some((f) => f.targetPath.endsWith('/topics/classified-page.md')), 'L012 should NOT fire for classified page');
});

test('Fix2: wiki migrate plan --filter subtype_is_null=true selects unclassified pages', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'research', { label: 'Research' });

  createCanon(repoPath, {
    targetPage: 'research/has-subtype',
    type: 'concept', title: 'Has Subtype', sources: [], subtype: 'ml',
  });
  createCanon(repoPath, {
    targetPage: 'research/no-subtype-a',
    type: 'concept', title: 'No Subtype A', sources: [],
  });
  createCanon(repoPath, {
    targetPage: 'research/no-subtype-b',
    type: 'concept', title: 'No Subtype B', sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    from: { domain: 'research', subtype_is_null: true },
    to: { subtype: 'general' },
    scope: 'classify-unclassified',
  });

  assert.equal(plan.affected_page_paths.length, 2, 'filter should select only the 2 unclassified pages');
  assert.ok(plan.affected_page_paths.some((p) => p.includes('no-subtype-a')), 'should include no-subtype-a');
  assert.ok(plan.affected_page_paths.some((p) => p.includes('no-subtype-b')), 'should include no-subtype-b');
  assert.ok(!plan.affected_page_paths.some((p) => p.includes('has-subtype')), 'should exclude has-subtype');
});

test('Fix3: wiki internal scan --rule filters findings to a single rule', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'filter-test', { label: 'Filter Test' });

  // Create an unclassified page (triggers L012) and a page with empty sources (triggers L003)
  createCanon(repoPath, {
    targetPage: 'filter-test/no-subtype',
    type: 'concept', title: 'No Subtype', sources: [],
  });

  // scan without --rule should return multiple rule types
  const allOutput = runInternalCommand(repoPath, ['scan', '--format', 'json']);
  const allFindings = JSON.parse(allOutput).findings;
  const ruleSet = new Set(allFindings.map((f) => f.rule));
  assert.ok(ruleSet.size >= 2, 'unfiltered scan should return findings from multiple rules');

  // scan with --rule L012 should return only L012 findings
  const l012Output = runInternalCommand(repoPath, ['scan', '--rule', 'L012', '--format', 'json']);
  const l012Findings = JSON.parse(l012Output).findings;
  assert.ok(l012Findings.length >= 1, '--rule L012 should return at least one finding');
  assert.ok(l012Findings.every((f) => f.rule === 'L012'), 'all --rule L012 findings should be L012');

  // scan with --rule L001 should return only L001 findings (or none)
  const l001Output = runInternalCommand(repoPath, ['scan', '--rule', 'L001', '--format', 'json']);
  const l001Findings = JSON.parse(l001Output).findings;
  assert.ok(l001Findings.every((f) => f.rule === 'L001'), 'all --rule L001 findings should be L001');
});

test('Fix4: page_id UNIQUE index prevents duplicate page_ids', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'dedup-test', { label: 'Dedup Test' });

  createCanon(repoPath, {
    targetPage: 'dedup-test/page-one',
    type: 'concept', title: 'Page One', sources: [],
    pageId: 'pg_unique_123',
  });

  // Attempting to create a second page with the same page_id should fail
  assert.throws(
    () => createCanon(repoPath, {
      targetPage: 'dedup-test/page-two',
      type: 'concept', title: 'Page Two', sources: [],
      pageId: 'pg_unique_123',
    }),
    /UNIQUE constraint failed|unique/i,
    'duplicate page_id should throw a UNIQUE constraint error'
  );

  // A different page_id should succeed
  assert.doesNotThrow(
    () => createCanon(repoPath, {
      targetPage: 'dedup-test/page-two',
      type: 'concept', title: 'Page Two', sources: [],
      pageId: 'pg_unique_456',
    }),
    'distinct page_id should not throw'
  );
});

test('Fix5: merge-subtype apply also deprecates source subtype in taxonomy', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'merge-st-test', { label: 'Merge Subtype Test' });
  // Register both subtypes so deprecation can be verified
  registerSubtype(repoPath, 'writing', { domain: 'merge-st-test' });
  registerSubtype(repoPath, 'content', { domain: 'merge-st-test' });

  createCanon(repoPath, {
    targetPage: 'merge-st-test/writing/article-a',
    type: 'concept', title: 'Article A', sources: [],
    subtype: 'writing',
  });

  // Build plan to merge subtype writing -> content
  const plan = createMigrationPlan(repoPath, {
    operation_type: 'merge-subtype',
    scope: 'writing → content',
    from: { domain: 'merge-st-test', subtype: 'writing' },
    to: { subtype: 'content' },
    reason: 'consolidation test',
  });

  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);

  // After apply, old subtype should be deprecated
  const taxonomy = getTaxonomySnapshot(repoPath);
  const deprecated = taxonomy.subtypes.find(s => s.id === 'writing' && s.status === 'deprecated');
  assert.ok(deprecated, 'subtype "writing" should be marked deprecated after merge-subtype apply');
  assert.deepEqual(deprecated.replaced_by, ['content'], 'replaced_by should point to merged-into subtype');
});

test('Fix6: findMatchingPages with include_secondary finds cross-domain pages', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'primary-domain', { label: 'Primary Domain' });
  registerDomain(repoPath, 'secondary-domain', { label: 'Secondary Domain' });

  const { findMatchingPages } = require('../src/lib/migration');

  // Create page in primary-domain, then patch its secondary_domains_json in the DB
  createCanon(repoPath, {
    targetPage: 'primary-domain/cross-domain-page',
    type: 'concept', title: 'Cross Domain Page', sources: [],
  });
  // Directly update DB to set secondary_domains_json (simulates what wiki govern / maintain would do)
  const db = openRuntimeIndex(repoPath);
  db.prepare("UPDATE pages SET secondary_domains_json = ? WHERE path LIKE '%cross-domain-page%'")
    .run(JSON.stringify(['secondary-domain']));
  db.close();

  // Without include_secondary, searching secondary-domain should NOT find this page
  const withoutFlag = findMatchingPages(repoPath, { domain: 'secondary-domain' });
  assert.ok(!withoutFlag.some(p => p.path.includes('cross-domain-page')),
    'without include_secondary, page in primary-domain should not appear in secondary-domain results');

  // With include_secondary: true, it SHOULD appear
  const withFlag = findMatchingPages(repoPath, { domain: 'secondary-domain', include_secondary: true });
  assert.ok(withFlag.some(p => p.path.includes('cross-domain-page')),
    'with include_secondary: true, cross-domain page should be included in results');
});

test('Fix7: applyMigrationPlan pre-flight rejects all collisions before touching any file', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  const { createMigrationPlan, dryRunMigrationPlan, applyMigrationPlan } = require('../src/lib/migration');

  // Create two source pages
  createCanon(repoPath, { targetPage: 'ai/src-a', type: 'concept', title: 'Src A', sources: [] });
  createCanon(repoPath, { targetPage: 'ai/src-b', type: 'concept', title: 'Src B', sources: [] });

  // Create ONE destination collision (src-a destination already exists)
  createCanon(repoPath, { targetPage: 'ai/concepts/src-a', type: 'concept', title: 'Dest A Existing', sources: [] });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    from: { domain: 'ai' },
    to: { domain: 'ai', collection: 'concepts' },
    reason: 'Pre-flight test',
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);

  // Apply should throw on collision without having moved src-b
  assert.throws(
    () => applyMigrationPlan(repoPath, plan.plan_id),
    /reclassify collision/,
    'Expected collision error'
  );

  // Verify src-b was NOT moved (pre-flight check happened before any file operations)
  const srcBPath = path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'src-b.md');
  assert.ok(fs.existsSync(srcBPath), 'src-b.md must still exist at original path (no partial migration)');
});

test('Fix8: rollbackMigrationPlan removes alias entries for moved pages', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'domain-a', { label: 'Domain A' });
  registerDomain(repoPath, 'domain-b', { label: 'Domain B' });
  const { createMigrationPlan, dryRunMigrationPlan, applyMigrationPlan, rollbackMigrationPlan } = require('../src/lib/migration');
  const { loadAliases } = require('../src/lib/alias');

  createCanon(repoPath, { targetPage: 'domain-a/page-to-move', type: 'concept', title: 'Movable Page', sources: [] });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    from: { domain: 'domain-a' },
    to: { domain: 'domain-b' },
    reason: 'Rollback alias test',
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);

  // After apply, alias must be recorded
  const aliasesAfterApply = loadAliases(repoPath);
  const hasAlias = Object.values(aliasesAfterApply.path_map || {}).length > 0 ||
    Object.keys(aliasesAfterApply.path_map || {}).some(k => k.includes('domain-a'));
  // The alias key is the OLD path (domain-a/page-to-move.md)
  assert.ok(
    Object.keys(aliasesAfterApply.path_map || {}).some(k => k.includes('domain-a')),
    'After apply, alias for old path must exist'
  );

  rollbackMigrationPlan(repoPath, plan.plan_id);

  // After rollback, alias must be removed
  const aliasesAfterRollback = loadAliases(repoPath);
  assert.ok(
    !Object.keys(aliasesAfterRollback.path_map || {}).some(k => k.includes('domain-a/page-to-move')),
    'After rollback, old path alias must be removed from aliases.json'
  );
});

test('Fix9: dry-run reports collisions, page_id path changes, and cross_ref impact', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });

  const sourcePath = createCanon(repoPath, {
    targetPage: 'ai/src-page',
    type: 'concept',
    title: 'Source Page',
    sources: [],
  });
  updateFrontmatterFile(sourcePath, { cross_refs: ['missing-target'] });

  createCanon(repoPath, {
    targetPage: 'ai/concepts/src-page',
    type: 'concept',
    title: 'Existing Destination',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    from: { domain: 'ai', collection: null },
    to: { domain: 'ai', collection: 'concepts' },
    reason: 'Dry-run reporting regression',
  });

  const report = dryRunMigrationPlan(repoPath, plan.plan_id);
  assert.equal(report.collisions_detected, 1, 'dry-run should report one collision');
  assert.equal(report.collisions.length, 1, 'collision details should be included');
  assert.ok(report.cross_ref_impact_count >= 1, 'cross_ref impact should reflect frontmatter cross_refs');
  assert.ok(report.path_changes.every((item) => Object.hasOwn(item, 'page_id')), 'path_changes should carry page_id');
});

test('Fix10: applied plan cannot be dry-run again', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  registerDomain(repoPath, 'ml', { label: 'ML' });

  createCanon(repoPath, {
    targetPage: 'ai/page-a',
    type: 'concept',
    title: 'Page A',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'reclassify',
    from: { domain: 'ai' },
    to: { domain: 'ml' },
    reason: 'Prevent status regression',
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);

  assert.throws(
    () => dryRunMigrationPlan(repoPath, plan.plan_id),
    /already been applied/,
    'applied plan must not be dry-run again'
  );

  const planRow = listMigrationPlans(repoPath).find((item) => item.plan_id === plan.plan_id);
  assert.equal(planRow.status, 'applied', 'status must remain applied after rejected dry-run');
});

test('Fix11: wiki internal alias list --page-id returns matching old paths', (t) => {
  const repoPath = makeTempRepo(t);
  const pageId = generatePageId();
  recordPathAlias(repoPath, 'canon/domains/ai/old-page.md', pageId);
  recordPathAlias(repoPath, 'canon/domains/ai/older-page.md', pageId);

  const result = runInternalCommand(repoPath, ['alias', 'list', '--page-id', pageId, '--json']);
  assert.equal(result.page_id, pageId);
  assert.deepEqual(result.old_paths.sort(), [
    'canon/domains/ai/old-page.md',
    'canon/domains/ai/older-page.md',
  ]);
});

test('Fix12: maintainWorkflow returns per-rule summary counts', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  registerSubtype(repoPath, 'rag', { label: 'RAG' });

  const stalePath = createCanon(repoPath, {
    targetPage: 'ai/stale-page',
    type: 'concept',
    title: 'Stale Page',
    subtype: 'rag',
    sources: [],
  });
  updateFrontmatterFile(stalePath, { last_updated: '2020-01-01', staleness_days: 120 });
  const unclassifiedPath = createCanon(repoPath, {
    targetPage: 'ai/unclassified-page',
    type: 'concept',
    title: 'Unclassified Page',
    sources: [],
  });
  updateFrontmatterFile(unclassifiedPath, { subtype: null });
  syncRuntimeFiles(repoPath, [stalePath, unclassifiedPath]);

  const result = maintainWorkflow(repoPath);
  assert.equal(typeof result.l002_count, 'number');
  assert.equal(typeof result.l012_count, 'number');
  assert.ok(result.l002_count >= 1, 'stale page should increment l002_count');
  assert.ok(result.l012_count >= 1, 'unclassified page should increment l012_count');
  assert.equal(result.unclassified_pages, result.l012_count, 'unclassified_pages should match l012_count');
});

test('Fix13: resolveInternalFile rejects path traversal outside repo', (t) => {
  const repoPath = makeTempRepo(t);
  assert.throws(
    () => runInternalCommand(repoPath, ['frontmatter', 'get', '../../../../etc/passwd', 'title']),
    /path traversal|escapes allowed roots/,
    'path traversal inputs must be rejected'
  );
});

test('Fix14: internal destination collisions are detected before apply mutates files', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });

  createCanon(repoPath, { targetPage: 'ai/a/foo', type: 'concept', title: 'Foo A', sources: [] });
  createCanon(repoPath, { targetPage: 'ai/b/foo', type: 'concept', title: 'Foo B', sources: [] });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'relocate',
    from: { domain: 'ai' },
    to: { domain: 'ai', collection: 'shared' },
    reason: 'Internal collision detection regression',
  });

  const report = dryRunMigrationPlan(repoPath, plan.plan_id);
  assert.equal(report.collisions_detected, 1, 'dry-run should report one internal collision');
  assert.ok(report.collisions.some((item) => item.type === 'internal'), 'collision should be marked internal');

  assert.throws(
    () => applyMigrationPlan(repoPath, plan.plan_id),
    /not safe to apply|multiple source pages converge here/,
    'apply should fail before moving any file'
  );

  assert.ok(fs.existsSync(path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'a', 'foo.md')));
  assert.ok(fs.existsSync(path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'b', 'foo.md')));
  assert.ok(!fs.existsSync(path.join(repoPath, '.wiki', 'canon', 'domains', 'ai', 'shared', 'foo.md')));
});

test('Fix15: merge-pages rejects target overlap and duplicate sources', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  createCanon(repoPath, { targetPage: 'ai/target', type: 'concept', title: 'Target', sources: [] });
  createCanon(repoPath, { targetPage: 'ai/source', type: 'concept', title: 'Source', sources: [] });

  assert.throws(
    () => createMigrationPlan(repoPath, {
      operation_type: 'merge-pages',
      from: { page_paths: ['canon/domains/ai/target.md', 'canon/domains/ai/source.md'] },
      to: { target_path: 'canon/domains/ai/target.md' },
      reason: 'target overlap',
    }),
    /must not also appear in from\.page_paths/,
    'target must not also appear in source list'
  );

  assert.throws(
    () => createMigrationPlan(repoPath, {
      operation_type: 'merge-pages',
      from: { page_paths: ['canon/domains/ai/source.md', 'canon/domains/ai/source.md'] },
      to: { target_path: 'canon/domains/ai/target.md' },
      reason: 'duplicate sources',
    }),
    /must be distinct/,
    'duplicate source paths must be rejected'
  );
});

test('Fix16: rollback removes taxonomy aliases created by rename-domain', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  registerDomain(repoPath, 'ai-new', { label: 'AI New' });
  createCanon(repoPath, { targetPage: 'ai/page-a', type: 'concept', title: 'Page A', sources: [] });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'rename-domain',
    from: { domain: 'ai' },
    to: { domain: 'ai-new' },
    reason: 'taxonomy alias rollback',
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);
  applyMigrationPlan(repoPath, plan.plan_id);
  assert.equal(resolveTaxonomyAlias(repoPath, 'domain', 'ai'), 'ai-new');

  rollbackMigrationPlan(repoPath, plan.plan_id);
  assert.equal(resolveTaxonomyAlias(repoPath, 'domain', 'ai'), 'ai', 'rollback should remove taxonomy alias');
});

test('Fix17: merge-pages dry-run reports missing target as not ready to apply', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  createCanon(repoPath, { targetPage: 'ai/source-a', type: 'concept', title: 'Source A', sources: [] });
  createCanon(repoPath, { targetPage: 'ai/source-b', type: 'concept', title: 'Source B', sources: [] });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'merge-pages',
    from: { page_paths: ['canon/domains/ai/source-a.md', 'canon/domains/ai/source-b.md'] },
    to: { target_path: 'canon/domains/ai/missing-target.md' },
    reason: 'missing target dry-run',
  });

  const report = dryRunMigrationPlan(repoPath, plan.plan_id);
  assert.equal(report.target_exists, false);
  assert.equal(report.ready_to_apply, false);
  assert.ok(report.validation_errors.some((item) => item.includes('target page does not exist')));
});

test('Fix18: rollback accepts applying state and restores partially moved pages', (t) => {
  const repoPath = makeTempRepo(t);
  registerDomain(repoPath, 'ai', { label: 'AI' });
  registerDomain(repoPath, 'ml', { label: 'ML' });
  const originalPath = createCanon(repoPath, {
    targetPage: 'ai/page-a',
    type: 'concept',
    title: 'Page A',
    sources: [],
  });

  const plan = createMigrationPlan(repoPath, {
    operation_type: 'rename-domain',
    from: { domain: 'ai' },
    to: { domain: 'ml' },
    reason: 'partial apply rollback',
  });
  dryRunMigrationPlan(repoPath, plan.plan_id);

  const movedPath = path.join(repoPath, '.wiki', 'canon', 'domains', 'ml', 'page-a.md');
  fs.mkdirSync(path.dirname(movedPath), { recursive: true });
  fs.renameSync(originalPath, movedPath);
  updateFrontmatterFile(movedPath, { domain: 'ml' });
  syncRuntimeFiles(repoPath, [originalPath, movedPath]);

  const planFile = path.join(repoPath, '.wiki', 'migrations', `${plan.plan_id}.json`);
  const rawPlan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  rawPlan.status = 'applying';
  rawPlan.rollback_plan = {
    entries: [
      {
        path: 'canon/domains/ai/page-a.md',
        new_path: 'canon/domains/ml/page-a.md',
        original: { domain: 'ai' },
        delete_keys: [],
      },
    ],
  };
  fs.writeFileSync(planFile, `${JSON.stringify(rawPlan, null, 2)}\n`, 'utf8');

  rollbackMigrationPlan(repoPath, plan.plan_id);

  assert.ok(fs.existsSync(originalPath), 'original path should be restored');
  assert.ok(!fs.existsSync(movedPath), 'moved path should be removed after rollback');
  const { frontmatter } = parseFrontmatterFile(originalPath);
  assert.equal(frontmatter.domain, 'ai');
});

test('Fix19: public workflow path resolvers reject repo-external files by default', (t) => {
  const repoPath = makeTempRepo(t);
  const outsidePath = path.join(path.dirname(repoPath), 'outside.txt');
  fs.writeFileSync(outsidePath, 'outside', 'utf8');

  assert.throws(
    () => findNamedFile(repoPath, outsidePath, ['approved']),
    /escapes repo root/,
    'findNamedFile should reject files outside repo'
  );
  assert.throws(
    () => resolveUserFile(repoPath, outsidePath),
    /escapes repo root/,
    'resolveUserFile should reject files outside repo by default'
  );
  assert.equal(
    resolveUserFile(repoPath, outsidePath, { allowExternal: true }),
    outsidePath,
    'allowExternal=true should still permit external merged files'
  );
});
