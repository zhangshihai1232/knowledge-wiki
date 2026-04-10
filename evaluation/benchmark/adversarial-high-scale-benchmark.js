'use strict';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite is an experimental feature/.test(warning.message)) {
    return;
  }
  console.warn(warning.stack || String(warning));
});

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const { scaffoldRepo } = require(path.join(REPO_ROOT, 'src/lib/bootstrap'));
const {
  createCanon,
  generatePageId,
  importWorkflow,
  maintainWorkflow,
  moveProposal,
} = require(path.join(REPO_ROOT, 'src/lib/wiki-internal'));
const { parseFrontmatterFile, updateFrontmatterFile } = require(path.join(REPO_ROOT, 'src/lib/frontmatter'));
const { withRuntimeIndex, syncRuntimeFiles } = require(path.join(REPO_ROOT, 'src/lib/runtime-index'));
const {
  createMigrationPlan,
  dryRunMigrationPlan,
  applyMigrationPlan,
  rollbackMigrationPlan,
} = require(path.join(REPO_ROOT, 'src/lib/migration'));
const { listAliases, resolvePathAlias, resolveTaxonomyAlias } = require(path.join(REPO_ROOT, 'src/lib/alias'));
const { normalizeClassification, registerDomain, registerSubtype } = require(path.join(REPO_ROOT, 'src/lib/taxonomy'));
const { applyResolve, applyReviewDecision, findNamedFile, resolveUserFile } = require(path.join(REPO_ROOT, 'src/lib/wiki-repo'));
const { compileApprovedProposal } = require(path.join(REPO_ROOT, 'src/lib/compiler'));

const TIERS = {
  smoke: {
    pageIdCount: 2000,
    aiOverflowPages: 34,
    pendingSuggestionCount: 12,
    collisionPairs: 6,
    renamePages: 8,
    subtypePages: 8,
    mergeSourceCount: 6,
    workflowRepeats: 1,
  },
  challenge: {
    pageIdCount: 12000,
    aiOverflowPages: 48,
    pendingSuggestionCount: 18,
    collisionPairs: 12,
    renamePages: 16,
    subtypePages: 14,
    mergeSourceCount: 12,
    workflowRepeats: 3,
  },
  extreme: {
    pageIdCount: 30000,
    aiOverflowPages: 72,
    pendingSuggestionCount: 30,
    collisionPairs: 20,
    renamePages: 24,
    subtypePages: 20,
    mergeSourceCount: 20,
    workflowRepeats: 5,
  },
};

const THRESHOLDS = {
  page_id_collision_rate: { op: '<=', value: 0 },
  structural_signal_coverage_rate: { op: '>=', value: 1 },
  l012_visibility_rate: { op: '>=', value: 1 },
  internal_collision_detection_rate: { op: '>=', value: 1 },
  dry_run_schema_completeness_rate: { op: '>=', value: 1 },
  collision_preflight_preservation_rate: { op: '>=', value: 1 },
  taxonomy_mobility_recovery_rate: { op: '>=', value: 1 },
  merge_rollback_integrity_rate: { op: '>=', value: 1 },
  workflow_atomic_recovery_rate: { op: '>=', value: 1 },
  repo_boundary_rejection_rate: { op: '>=', value: 1 },
};

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ratio(numerator, denominator) {
  if (!denominator) {
    return 1;
  }
  return numerator / denominator;
}

function wikiFile(repoPath, relativePath) {
  return path.join(repoPath, '.wiki', relativePath);
}

function noteTitle(targetPage) {
  return targetPage.split('/').filter(Boolean).pop() || targetPage;
}

function createPage(repoPath, targetPage, options = {}) {
  return createCanon(repoPath, {
    targetPage,
    type: options.type || 'concept',
    title: options.title || noteTitle(targetPage),
    subtype: Object.prototype.hasOwnProperty.call(options, 'subtype') ? options.subtype : null,
    tags: options.tags || [],
    sources: options.sources || [],
    body: options.body,
  });
}

function makeTempRepo(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `knowledge-wiki-bench-${label}-`));
  const repoPath = path.join(root, 'demo');
  scaffoldRepo({
    repoRoot: REPO_ROOT,
    configPath: path.join(root, 'config', 'namespaces.conf'),
    targetDir: repoPath,
    repoName: `Benchmark ${label}`,
    force: true,
  });
  return {
    repoPath,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function countRows(repoPath, sql, params = []) {
  return withRuntimeIndex(repoPath, (db) => db.prepare(sql).get(...params).count);
}

function seedCreateProposal(repoPath, slugSuffix) {
  return importWorkflow(repoPath, {
    source: {
      kind: 'note',
      title: `Benchmark Source ${slugSuffix}`,
      author: 'benchmark',
      published_at: '2026-04-10',
      ingested_at: '2026-04-10',
      domain: 'demo',
      tags: ['benchmark'],
      extracted: true,
      body: '## note\nbenchmark content\n',
      extracted_claims: [`claim-${slugSuffix}`],
    },
    proposal: {
      action: 'create',
      status: 'inbox',
      target_page: `demo/test/${slugSuffix}`,
      target_type: 'concept',
      confidence: 'medium',
      origin: 'ingest',
      auto_quality_score: 0.8,
      body: `## 提案摘要\n\nProposal ${slugSuffix}.\n\n## 变更内容\n\n### 新增内容\n\n## 定义\n\nDefinition for ${slugSuffix}.\n`,
    },
  });
}

function seedConflictProposal(repoPath, slugSuffix) {
  const pageRelative = `canon/domains/demo/test/${slugSuffix}.md`;
  createPage(repoPath, `demo/test/${slugSuffix}`, {
    type: 'concept',
    title: `Conflict ${slugSuffix}`,
    body: '## 定义\n\n旧定义。\n\n<<<CONFLICT>>>\n待合并内容\n<<<END_CONFLICT>>>\n',
  });
  const seeded = importWorkflow(repoPath, {
    source: {
      kind: 'note',
      title: `Conflict Source ${slugSuffix}`,
      author: 'benchmark',
      published_at: '2026-04-10',
      ingested_at: '2026-04-10',
      domain: 'demo',
      tags: ['conflict'],
      extracted: true,
      body: '## note\nconflict source\n',
      extracted_claims: [`conflict-claim-${slugSuffix}`],
    },
    proposal: {
      action: 'update',
      status: 'review',
      target_page: `demo/test/${slugSuffix}`,
      target_type: 'concept',
      confidence: 'medium',
      origin: 'ingest',
      auto_quality_score: 0.7,
      body: `## 提案摘要\n\nConflict ${slugSuffix}.\n\n## 变更内容\n\n### 修改内容\n\n## 定义\n\nmerged ${slugSuffix}\n`,
    },
  });
  const proposalPath = moveProposal(repoPath, seeded.proposal, 'conflicts', {
    conflictLocation: pageRelative,
  });
  return {
    pagePath: wikiFile(repoPath, pageRelative),
    proposalPath,
  };
}

function scenarioPageIdLoad(config) {
  const ids = new Set();
  let duplicateCount = 0;
  for (let index = 0; index < config.pageIdCount; index += 1) {
    const pageId = generatePageId();
    if (ids.has(pageId)) {
      duplicateCount += 1;
    }
    ids.add(pageId);
  }
  expect(duplicateCount === 0, `expected 0 duplicate page_id, got ${duplicateCount}`);
  return {
    workload: {
      ids_generated: config.pageIdCount,
    },
    metrics: {
      page_id_collision_rate: ratio(duplicateCount, config.pageIdCount),
      unique_id_rate: ratio(ids.size, config.pageIdCount),
    },
    notes: [`generated ${config.pageIdCount} page_id values without collision`],
  };
}

function scenarioStructuralSignalDensity(config) {
  const { repoPath, cleanup } = makeTempRepo('signals');
  try {
    for (let index = 0; index < config.aiOverflowPages - 1; index += 1) {
      createPage(repoPath, `ai/overflow/ai-workflow-${index}`, {
        type: 'guide',
        subtype: 'workflow',
      });
    }
    createPage(repoPath, 'ai/rare/rare-edge', {
      type: 'concept',
      subtype: 'rare-edge',
    });
    createPage(repoPath, 'engineering/shared/eng-workflow-edge', {
      type: 'guide',
      subtype: 'workflow',
    });
    createPage(repoPath, 'operations/shared/ops-workflow-edge', {
      type: 'guide',
      subtype: 'workflow',
    });
    createPage(repoPath, 'product/unclassified/no-subtype', {
      type: 'concept',
      subtype: null,
    });

    for (let index = 0; index < config.pendingSuggestionCount; index += 1) {
      normalizeClassification(
        repoPath,
        {
          domain: 'ai',
          primary_type: 'guide',
          subtype: 'workflow',
          suggested_tags: [`novel-tag-${index}`],
          suggested_aliases: [`novel-alias-${index}`],
        },
        {
          via: 'adversarial-benchmark',
          sourcePath: `sources/benchmark-${index}.md`,
        }
      );
    }

    const result = maintainWorkflow(repoPath, {});
    const signalIds = new Set((result.structural_signals || []).map((item) => item.rule));
    const findingIds = new Set((result.findings || []).map((item) => item.rule));
    const expectedSignals = ['S001', 'S002', 'S003', 'S004', 'S005'];
    const matchedSignals = expectedSignals.filter((ruleId) => signalIds.has(ruleId));

    expect(matchedSignals.length === expectedSignals.length, `expected ${expectedSignals.join(', ')}, got ${Array.from(signalIds).sort().join(', ')}`);
    expect(findingIds.has('L012'), 'expected L012 to remain visible under dense data');

    return {
      workload: {
        pages_generated: config.aiOverflowPages + 3,
        suggestion_entries: config.pendingSuggestionCount * 2,
      },
      metrics: {
        structural_signal_coverage_rate: ratio(matchedSignals.length, expectedSignals.length),
        l012_visibility_rate: findingIds.has('L012') ? 1 : 0,
      },
      notes: [`signals=${matchedSignals.join(', ')}`],
    };
  } finally {
    cleanup();
  }
}

function scenarioMigrationCollisionMatrix(config) {
  const { repoPath, cleanup } = makeTempRepo('collision');
  try {
    const oldPaths = [];
    for (let index = 0; index < config.collisionPairs; index += 1) {
      const leftRel = `canon/domains/ai/a/shared-${index}.md`;
      const rightRel = `canon/domains/ai/b/shared-${index}.md`;
      createPage(repoPath, `ai/a/shared-${index}`, { type: 'concept' });
      createPage(repoPath, `ai/b/shared-${index}`, { type: 'concept' });
      oldPaths.push(leftRel, rightRel);
    }

    const plan = createMigrationPlan(repoPath, {
      operation_type: 'relocate',
      scope: 'collision-matrix',
      from: { domain: 'ai' },
      to: { domain: 'ai', collection: 'merged' },
      reason: 'adversarial internal collision benchmark',
    });
    const report = dryRunMigrationPlan(repoPath, plan.plan_id);

    let applyBlocked = false;
    try {
      applyMigrationPlan(repoPath, plan.plan_id);
    } catch (err) {
      if (/not safe to apply|multiple source pages converge here|reclassify collision/.test(err.message)) {
        applyBlocked = true;
      } else {
        throw err;
      }
    }

    const schemaComplete = Array.isArray(report.path_changes)
      && report.path_changes.every((item) => Object.prototype.hasOwnProperty.call(item, 'page_id'))
      && Array.isArray(report.collisions)
      && typeof report.collisions_detected === 'number'
      && typeof report.cross_ref_impact_count === 'number';
    const originalsIntact = oldPaths.every((relPath) => fs.existsSync(wikiFile(repoPath, relPath)));
    const mergedTargetsAbsent = Array.from({ length: config.collisionPairs }, (_, index) => (
      !fs.existsSync(wikiFile(repoPath, `canon/domains/ai/merged/shared-${index}.md`))
    )).every(Boolean);

    expect(report.collisions_detected === config.collisionPairs, `expected ${config.collisionPairs} collisions, got ${report.collisions_detected}`);
    expect(report.collisions.every((item) => item.type === 'internal'), 'expected all collision entries to be internal');
    expect(schemaComplete, 'dry-run schema is missing required fields');
    expect(applyBlocked, 'apply should be blocked before any mutation');
    expect(originalsIntact && mergedTargetsAbsent, 'collision apply attempt should preserve original files');

    return {
      workload: {
        pages_generated: config.collisionPairs * 2,
        plans_created: 1,
      },
      metrics: {
        internal_collision_detection_rate: ratio(report.collisions_detected, config.collisionPairs),
        dry_run_schema_completeness_rate: schemaComplete ? 1 : 0,
        collision_preflight_preservation_rate: originalsIntact && mergedTargetsAbsent ? 1 : 0,
      },
      notes: [`reported ${report.collisions_detected} internal collisions`],
    };
  } finally {
    cleanup();
  }
}

function scenarioTaxonomyMobility(config) {
  const { repoPath, cleanup } = makeTempRepo('taxonomy');
  try {
    registerDomain(repoPath, 'legacy-ai');
    registerDomain(repoPath, 'modern-ai');
    registerSubtype(repoPath, 'playbook', { domain: 'engineering', primaryType: 'guide' });

    const renameOldPaths = [];
    for (let index = 0; index < config.renamePages; index += 1) {
      const relPath = `canon/domains/legacy-ai/archive/legacy-${index}.md`;
      createPage(repoPath, `legacy-ai/archive/legacy-${index}`, {
        type: 'concept',
        subtype: 'workflow',
      });
      renameOldPaths.push(relPath);
    }

    const subtypePaths = [];
    for (let index = 0; index < config.subtypePages; index += 1) {
      const relPath = `canon/domains/engineering/runbooks/play-${index}.md`;
      createPage(repoPath, `engineering/runbooks/play-${index}`, {
        type: 'guide',
        subtype: 'playbook',
      });
      subtypePaths.push(relPath);
    }

    const renamePlan = createMigrationPlan(repoPath, {
      operation_type: 'rename-domain',
      scope: 'legacy-ai-to-modern-ai',
      from: { domain: 'legacy-ai' },
      to: { domain: 'modern-ai' },
      reason: 'benchmark big-field migration',
    });
    dryRunMigrationPlan(repoPath, renamePlan.plan_id);
    applyMigrationPlan(repoPath, renamePlan.plan_id);

    expect(resolveTaxonomyAlias(repoPath, 'domain', 'legacy-ai') === 'modern-ai', 'domain taxonomy alias should resolve after rename-domain apply');
    const renameAppliedOk = renameOldPaths.every((oldRel) => {
      const newRel = oldRel.replace('canon/domains/legacy-ai/', 'canon/domains/modern-ai/');
      return !fs.existsSync(wikiFile(repoPath, oldRel))
        && fs.existsSync(wikiFile(repoPath, newRel))
        && resolvePathAlias(repoPath, oldRel);
    });
    expect(renameAppliedOk, 'rename-domain apply should move pages and record path aliases');

    const mergePlan = createMigrationPlan(repoPath, {
      operation_type: 'merge-subtype',
      scope: 'playbook-to-workflow',
      from: { domain: 'engineering', subtype: 'playbook' },
      to: { subtype: 'workflow' },
      reason: 'benchmark small-field consolidation',
    });
    dryRunMigrationPlan(repoPath, mergePlan.plan_id);
    applyMigrationPlan(repoPath, mergePlan.plan_id);

    expect(resolveTaxonomyAlias(repoPath, 'subtype', 'playbook') === 'workflow', 'subtype taxonomy alias should resolve after merge-subtype apply');
    const subtypeAppliedOk = subtypePaths.every((relPath) => parseFrontmatterFile(wikiFile(repoPath, relPath)).frontmatter.subtype === 'workflow');
    expect(subtypeAppliedOk, 'merge-subtype apply should rewrite page subtype values');

    rollbackMigrationPlan(repoPath, mergePlan.plan_id);
    rollbackMigrationPlan(repoPath, renamePlan.plan_id);

    const aliases = listAliases(repoPath);
    const rollbackOk = renameOldPaths.every((oldRel) => {
      const newRel = oldRel.replace('canon/domains/legacy-ai/', 'canon/domains/modern-ai/');
      return fs.existsSync(wikiFile(repoPath, oldRel))
        && !fs.existsSync(wikiFile(repoPath, newRel))
        && resolvePathAlias(repoPath, oldRel) === null;
    }) && subtypePaths.every((relPath) => parseFrontmatterFile(wikiFile(repoPath, relPath)).frontmatter.subtype === 'playbook')
      && !(aliases.taxonomy_map.domain || {})['legacy-ai']
      && !(aliases.taxonomy_map.subtype || {})['playbook'];
    expect(rollbackOk, 'taxonomy mobility rollback should restore pages and clear alias state');

    return {
      workload: {
        pages_generated: config.renamePages + config.subtypePages,
        plans_created: 2,
      },
      metrics: {
        taxonomy_mobility_recovery_rate: rollbackOk ? 1 : 0,
      },
      notes: [`rename_plan=${renamePlan.plan_id}`, `merge_plan=${mergePlan.plan_id}`],
    };
  } finally {
    cleanup();
  }
}

function scenarioMergeFanIn(config) {
  const { repoPath, cleanup } = makeTempRepo('merge');
  try {
    const sourcePaths = [];
    for (let index = 0; index < config.mergeSourceCount; index += 1) {
      const relPath = `canon/domains/ai/rag/source-${index}.md`;
      createPage(repoPath, `ai/rag/source-${index}`, {
        type: 'concept',
        title: `Source ${index}`,
      });
      sourcePaths.push(relPath);
    }
    const targetPath = 'canon/domains/ai/rag/mega-target.md';
    createPage(repoPath, 'ai/rag/mega-target', {
      type: 'concept',
      title: 'Mega Target',
    });
    updateFrontmatterFile(wikiFile(repoPath, targetPath), {
      typed_refs: [
        { target: 'pg_existing_001', type: 'see-also' },
        { target: 'pg_existing_002', type: 'depends-on' },
      ],
    });
    syncRuntimeFiles(repoPath, [wikiFile(repoPath, targetPath)]);

    const plan = createMigrationPlan(repoPath, {
      operation_type: 'merge-pages',
      scope: 'mega-merge',
      from: { page_paths: sourcePaths },
      to: { target_path: targetPath },
      reason: 'benchmark fan-in merge',
    });
    const sourcePageIds = Object.fromEntries(sourcePaths.map((relPath) => [
      relPath,
      parseFrontmatterFile(wikiFile(repoPath, relPath)).frontmatter.page_id,
    ]));
    const report = dryRunMigrationPlan(repoPath, plan.plan_id);
    expect(report.ready_to_apply === true, 'merge-pages dry-run should be ready_to_apply');
    applyMigrationPlan(repoPath, plan.plan_id);

    const targetFrontmatter = parseFrontmatterFile(wikiFile(repoPath, targetPath)).frontmatter;
    const targetPageId = targetFrontmatter.page_id;
    const supersedesCount = (targetFrontmatter.typed_refs || []).filter((item) => item.type === 'supersedes').length;
    const archivedSources = sourcePaths.filter((relPath) => {
      const frontmatter = parseFrontmatterFile(wikiFile(repoPath, relPath)).frontmatter;
      return frontmatter.status === 'archived'
        && frontmatter.merged_into === targetPath
        && resolvePathAlias(repoPath, relPath) === sourcePageIds[relPath];
    }).length;

    expect(supersedesCount === config.mergeSourceCount, `expected ${config.mergeSourceCount} supersedes refs, got ${supersedesCount}`);
    expect(archivedSources === config.mergeSourceCount, `expected ${config.mergeSourceCount} archived sources, got ${archivedSources}`);

    rollbackMigrationPlan(repoPath, plan.plan_id);

    const restoredSources = sourcePaths.filter((relPath) => {
      const frontmatter = parseFrontmatterFile(wikiFile(repoPath, relPath)).frontmatter;
      return frontmatter.status === 'active' && !frontmatter.merged_into;
    }).length;
    const rollbackFrontmatter = parseFrontmatterFile(wikiFile(repoPath, targetPath)).frontmatter;
    const rollbackSupersedesCount = (rollbackFrontmatter.typed_refs || []).filter((item) => item.type === 'supersedes').length;

    expect(restoredSources === config.mergeSourceCount, `expected ${config.mergeSourceCount} restored sources, got ${restoredSources}`);
    expect(rollbackSupersedesCount === 0, 'merge rollback should remove supersedes refs from target');

    return {
      workload: {
        pages_generated: config.mergeSourceCount + 1,
        plans_created: 1,
      },
      metrics: {
        merge_rollback_integrity_rate: ratio(restoredSources, config.mergeSourceCount),
      },
      notes: [`fan-in=${config.mergeSourceCount}`],
    };
  } finally {
    cleanup();
  }
}

function scenarioWorkflowAtomicity(config) {
  let successfulRecoveries = 0;
  const totalFailures = config.workflowRepeats * 3;
  let proposalsGenerated = 0;
  let pagesGenerated = 0;

  for (let index = 0; index < config.workflowRepeats; index += 1) {
    {
      const { repoPath, cleanup } = makeTempRepo(`compile-${index}`);
      try {
        const seeded = seedCreateProposal(repoPath, `compile-${index}`);
        proposalsGenerated += 1;
        const approvedPath = applyReviewDecision(repoPath, 'approve', seeded.proposal, {
          reviewedBy: 'benchmark',
          note: 'meaningful approval note for adversarial benchmark',
        });
        const pagePath = wikiFile(repoPath, `canon/domains/demo/test/compile-${index}.md`);
        const domainIndexPath = wikiFile(repoPath, 'canon/domains/demo/_index.md');
        const topIndexPath = wikiFile(repoPath, 'canon/_index.md');
        const logPath = wikiFile(repoPath, 'changes/LOG.md');
        const statePath = wikiFile(repoPath, 'policy/STATE.md');
        const proposalBefore = fs.readFileSync(approvedPath, 'utf8');
        const logBefore = fs.readFileSync(logPath, 'utf8');
        const domainIndexBefore = readTextIfExists(domainIndexPath);
        const topIndexBefore = fs.readFileSync(topIndexPath, 'utf8');

        fs.rmSync(statePath, { force: true });
        let threw = false;
        try {
          compileApprovedProposal(repoPath, approvedPath);
        } catch (err) {
          threw = /STATE\.md|ENOENT/.test(err.message);
          if (!threw) {
            throw err;
          }
        }
        expect(threw, 'compile failure injection should throw');
        expect(!fs.existsSync(pagePath), 'compile rollback should remove newly created page');
        expect(fs.readFileSync(approvedPath, 'utf8') === proposalBefore, 'compile rollback should restore proposal');
        expect(fs.readFileSync(logPath, 'utf8') === logBefore, 'compile rollback should restore log');
        expect(fs.readFileSync(topIndexPath, 'utf8') === topIndexBefore, 'compile rollback should restore top index');
        expect(readTextIfExists(domainIndexPath) === domainIndexBefore, 'compile rollback should restore domain index');
        successfulRecoveries += 1;
      } finally {
        cleanup();
      }
    }

    {
      const { repoPath, cleanup } = makeTempRepo(`review-${index}`);
      try {
        const seeded = seedCreateProposal(repoPath, `review-${index}`);
        proposalsGenerated += 1;
        const inboxPath = wikiFile(repoPath, seeded.proposal);
        const approvedPath = wikiFile(repoPath, `changes/approved/${path.basename(seeded.proposal)}`);
        const logPath = wikiFile(repoPath, 'changes/LOG.md');
        const statePath = wikiFile(repoPath, 'policy/STATE.md');
        const proposalBefore = fs.readFileSync(inboxPath, 'utf8');
        const logBefore = fs.readFileSync(logPath, 'utf8');

        fs.rmSync(statePath, { force: true });
        let threw = false;
        try {
          applyReviewDecision(repoPath, 'approve', seeded.proposal, {
            reviewedBy: 'benchmark',
            note: 'meaningful approval note for adversarial benchmark',
          });
        } catch (err) {
          threw = /STATE\.md|ENOENT/.test(err.message);
          if (!threw) {
            throw err;
          }
        }
        expect(threw, 'review failure injection should throw');
        expect(fs.readFileSync(inboxPath, 'utf8') === proposalBefore, 'review rollback should restore proposal');
        expect(!fs.existsSync(approvedPath), 'review rollback should undo proposal move');
        expect(fs.readFileSync(logPath, 'utf8') === logBefore, 'review rollback should restore log');
        successfulRecoveries += 1;
      } finally {
        cleanup();
      }
    }

    {
      const { repoPath, cleanup } = makeTempRepo(`resolve-${index}`);
      try {
        const seeded = seedConflictProposal(repoPath, `resolve-${index}`);
        proposalsGenerated += 1;
        pagesGenerated += 1;
        const resolvedPath = wikiFile(repoPath, `changes/resolved/${path.basename(seeded.proposalPath)}`);
        const logPath = wikiFile(repoPath, 'changes/LOG.md');
        const statePath = wikiFile(repoPath, 'policy/STATE.md');
        const mergedFilePath = path.join(repoPath, `merged-${index}.md`);
        const pageBefore = fs.readFileSync(seeded.pagePath, 'utf8');
        const proposalBefore = fs.readFileSync(seeded.proposalPath, 'utf8');
        const logBefore = fs.readFileSync(logPath, 'utf8');

        fs.writeFileSync(mergedFilePath, '## 定义\n\n已合并定义。\n', 'utf8');
        fs.rmSync(statePath, { force: true });
        let threw = false;
        try {
          applyResolve(repoPath, seeded.proposalPath, {
            mergedFile: mergedFilePath,
            resolvedBy: 'benchmark',
            resolution: 'manual',
            confidence: 'high',
          });
        } catch (err) {
          threw = /STATE\.md|ENOENT/.test(err.message);
          if (!threw) {
            throw err;
          }
        }
        expect(threw, 'resolve failure injection should throw');
        expect(fs.readFileSync(seeded.pagePath, 'utf8') === pageBefore, 'resolve rollback should restore page body');
        expect(fs.readFileSync(seeded.proposalPath, 'utf8') === proposalBefore, 'resolve rollback should restore proposal');
        expect(!fs.existsSync(resolvedPath), 'resolve rollback should undo proposal move');
        expect(fs.readFileSync(logPath, 'utf8') === logBefore, 'resolve rollback should restore log');
        successfulRecoveries += 1;
      } finally {
        cleanup();
      }
    }
  }

  expect(successfulRecoveries === totalFailures, `expected ${totalFailures} workflow recoveries, got ${successfulRecoveries}`);
  return {
    workload: {
      workflow_failures_injected: totalFailures,
      proposals_generated: proposalsGenerated,
      pages_generated: pagesGenerated,
    },
    metrics: {
      workflow_atomic_recovery_rate: ratio(successfulRecoveries, totalFailures),
    },
    notes: [`recoveries=${successfulRecoveries}/${totalFailures}`],
  };
}

function scenarioRepoBoundaryAdversarialInputs() {
  const { repoPath, cleanup } = makeTempRepo('boundary');
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-wiki-boundary-'));
  try {
    const outsideFile = path.join(outsideRoot, 'outside.md');
    fs.writeFileSync(outsideFile, '# outside\n', 'utf8');
    const symlinkPath = path.join(repoPath, 'outside-link.md');
    fs.symlinkSync(outsideFile, symlinkPath);

    const relativeEscape = path.relative(process.cwd(), outsideFile);
    const maliciousInputs = [
      '../../../../etc/passwd',
      '.wiki/../../../../etc/passwd',
      outsideFile,
      relativeEscape,
      'outside-link.md',
      `.wiki/${path.relative(path.join(repoPath, '.wiki'), outsideFile)}`,
    ];

    let rejected = 0;
    let total = 0;
    for (const input of maliciousInputs) {
      for (const probe of [
        () => resolveUserFile(repoPath, input),
        () => findNamedFile(repoPath, input, ['inbox']),
      ]) {
        total += 1;
        try {
          probe();
        } catch (err) {
          if (/invalid file path|escapes repo root/.test(err.message)) {
            rejected += 1;
            continue;
          }
          throw err;
        }
      }
    }

    expect(rejected === total, `expected ${total} repo-boundary rejections, got ${rejected}`);
    return {
      workload: {
        malicious_inputs_tested: total,
      },
      metrics: {
        repo_boundary_rejection_rate: ratio(rejected, total),
      },
      notes: [`rejected=${rejected}/${total}`],
    };
  } finally {
    cleanup();
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
}

function runScenario(name, fn) {
  const startedAt = Date.now();
  try {
    const outcome = fn();
    return {
      name,
      passed: true,
      duration_ms: Date.now() - startedAt,
      workload: outcome.workload || {},
      metrics: outcome.metrics || {},
      notes: outcome.notes || [],
    };
  } catch (err) {
    return {
      name,
      passed: false,
      duration_ms: Date.now() - startedAt,
      workload: {},
      metrics: {},
      error: err.message,
      notes: [],
    };
  }
}

function mergeWorkload(target, partial) {
  for (const [key, value] of Object.entries(partial || {})) {
    target[key] = (target[key] || 0) + value;
  }
  return target;
}

function compareMetric(actual, threshold) {
  if (threshold.op === '>=') {
    return actual >= threshold.value;
  }
  if (threshold.op === '<=') {
    return actual <= threshold.value;
  }
  throw new Error(`unsupported threshold operator: ${threshold.op}`);
}

function evaluateMetrics(metrics) {
  const evaluations = {};
  const failingMetrics = [];
  for (const [name, threshold] of Object.entries(THRESHOLDS)) {
    const actual = metrics[name];
    const passed = typeof actual === 'number' && compareMetric(actual, threshold);
    evaluations[name] = {
      actual,
      ...threshold,
      passed,
    };
    if (!passed) {
      failingMetrics.push(name);
    }
  }
  return {
    evaluations,
    failingMetrics,
    pass: failingMetrics.length === 0,
  };
}

function renderText(report) {
  const lines = [
    `Benchmark: ${report.name}`,
    `Tier: ${report.tier}`,
    `Verdict: ${report.verdict.pass ? 'PASS' : 'FAIL'}`,
    `Duration: ${report.duration_ms} ms`,
    '',
    'Workload:',
  ];
  for (const [key, value] of Object.entries(report.workload)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('', 'Metrics:');
  for (const [name, evaluation] of Object.entries(report.verdict.metric_evaluations)) {
    lines.push(`- ${name}: ${evaluation.actual} (${evaluation.passed ? 'PASS' : 'FAIL'} ${evaluation.op} ${evaluation.value})`);
  }
  lines.push('', 'Scenarios:');
  for (const scenario of report.scenarios) {
    lines.push(`- ${scenario.name}: ${scenario.passed ? 'PASS' : 'FAIL'} (${scenario.duration_ms} ms)`);
    if (scenario.error) {
      lines.push(`  error: ${scenario.error}`);
    }
    if (scenario.notes.length) {
      lines.push(`  notes: ${scenario.notes.join(' | ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    tier: 'challenge',
    json: false,
    out: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--tier':
        options.tier = argv[index + 1];
        index += 1;
        break;
      case '--json':
        options.json = true;
        break;
      case '--out':
        options.out = argv[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`unknown option: ${token}`);
    }
  }
  return options;
}

function runBenchmark(options = {}) {
  const tier = options.tier || 'challenge';
  const config = TIERS[tier];
  if (!config) {
    throw new Error(`unknown tier: ${tier}`);
  }

  const startedAt = Date.now();
  const scenarios = [
    runScenario('page-id-load', () => scenarioPageIdLoad(config)),
    runScenario('structural-signal-density', () => scenarioStructuralSignalDensity(config)),
    runScenario('migration-collision-matrix', () => scenarioMigrationCollisionMatrix(config)),
    runScenario('taxonomy-mobility', () => scenarioTaxonomyMobility(config)),
    runScenario('merge-fan-in', () => scenarioMergeFanIn(config)),
    runScenario('workflow-atomicity', () => scenarioWorkflowAtomicity(config)),
    runScenario('repo-boundary-adversarial-inputs', () => scenarioRepoBoundaryAdversarialInputs(config)),
  ];

  const metrics = Object.assign({}, ...scenarios.map((scenario) => scenario.metrics));
  const workload = scenarios.reduce((acc, scenario) => mergeWorkload(acc, scenario.workload), {});
  const metricVerdict = evaluateMetrics(metrics);
  const scenarioFailures = scenarios.filter((scenario) => !scenario.passed).map((scenario) => scenario.name);

  return {
    name: 'adversarial-high-scale',
    tier,
    generated_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    config,
    workload,
    metrics,
    scenarios,
    verdict: {
      pass: metricVerdict.pass && scenarioFailures.length === 0,
      failing_metrics: metricVerdict.failingMetrics,
      failing_scenarios: scenarioFailures,
      metric_evaluations: metricVerdict.evaluations,
    },
  };
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const report = runBenchmark(options);
  if (options.out) {
    const outputPath = path.resolve(process.cwd(), options.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
  process.exitCode = report.verdict.pass ? 0 : 1;
}

module.exports = {
  THRESHOLDS,
  TIERS,
  runBenchmark,
};
