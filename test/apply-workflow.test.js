'use strict';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite is an experimental feature/.test(warning.message)) {
    return;
  }
  console.warn(warning.stack || String(warning));
});

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { scaffoldRepo } = require('../src/lib/bootstrap');
const { askWorkflow, createCanon, importWorkflow, moveProposal } = require('../src/lib/wiki-internal');
const { applyResolve, applyReviewDecision } = require('../src/lib/wiki-repo');
const { compileApprovedProposal } = require('../src/lib/compiler');
const { supportsRequiredNode } = require('../src/lib/runtime-requirements');
const { applySuggestionDecision, getTaxonomySnapshot, listSuggestions } = require('../src/lib/taxonomy');

function makeTempRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-wiki-test-'));
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

function seedCreateProposal(repoPath) {
  return importWorkflow(repoPath, {
    source: {
      kind: 'note',
      title: 'Smoke Test Note',
      author: 'copilot',
      published_at: '2026-04-10',
      ingested_at: '2026-04-10',
      domain: 'demo',
      tags: ['smoke'],
      extracted: true,
      body: '## note\nThis is a smoke test.\n',
      extracted_claims: ['Smoke claim'],
    },
    proposal: {
      action: 'create',
      status: 'inbox',
      target_page: 'demo/test/smoke-note',
      target_type: 'concept',
      confidence: 'medium',
      origin: 'ingest',
      auto_quality_score: 0.8,
      body: '## 提案摘要\n\nSmoke proposal.\n\n## 变更内容\n\n### 新增内容\n\n## 定义\n\nSmoke definition.\n\n## 参考来源\n\n- `sources/notes/2026-04-10-smoke-test-note.md`\n',
    },
  });
}

function seedConflictProposal(repoPath) {
  createCanon(repoPath, {
    targetPage: 'demo/test/conflict-note',
    type: 'concept',
    title: 'Conflict Note',
    sources: ['sources/notes/existing-conflict.md'],
    body: '## 定义\n\n旧定义。\n\n<<<CONFLICT>>>\n待合并内容\n<<<END_CONFLICT>>>\n',
  });

  const seeded = importWorkflow(repoPath, {
    source: {
      kind: 'note',
      title: 'Conflict Source',
      author: 'copilot',
      published_at: '2026-04-10',
      ingested_at: '2026-04-10',
      domain: 'demo',
      tags: ['conflict'],
      extracted: true,
      body: '## note\nConflict source.\n',
      extracted_claims: ['Conflict claim'],
    },
    proposal: {
      action: 'update',
      status: 'review',
      target_page: 'demo/test/conflict-note',
      target_type: 'concept',
      confidence: 'medium',
      origin: 'ingest',
      auto_quality_score: 0.7,
      body: '## 提案摘要\n\nConflict proposal.\n\n## 变更内容\n\n### 修改内容\n\n## 定义\n\n合并后的定义。\n',
    },
  });

  const proposalPath = moveProposal(repoPath, seeded.proposal, 'conflicts', {
    conflictLocation: 'canon/domains/demo/test/conflict-note.md',
  });

  return {
    pagePath: path.join(repoPath, '.wiki', 'canon', 'domains', 'demo', 'test', 'conflict-note.md'),
    proposalPath,
  };
}

test('public apply command compiles approved proposals into canon', (t) => {
  const repoPath = makeTempRepo(t);
  const seeded = seedCreateProposal(repoPath);

  applyReviewDecision(repoPath, 'approve', seeded.proposal, {
    reviewedBy: 'tester',
    note: 'meaningful approval note',
  });

  const output = execFileSync(
    process.execPath,
    [path.resolve(__dirname, '..', 'tools', 'wiki.js'), 'apply', '--json', '--repo', repoPath],
    { encoding: 'utf8' }
  );
  const result = JSON.parse(output);

  assert.equal(result.total, 1);
  assert.equal(result.applied[0].page, 'canon/domains/demo/test/smoke-note.md');

  const canonPath = path.join(repoPath, '.wiki', 'canon', 'domains', 'demo', 'test', 'smoke-note.md');
  const canonText = fs.readFileSync(canonPath, 'utf8');
  assert.match(canonText, /## 定义/);
  assert.doesNotMatch(canonText, /## 提案摘要/);

  const domainIndex = fs.readFileSync(path.join(repoPath, '.wiki', 'canon', 'domains', 'demo', '_index.md'), 'utf8');
  assert.match(domainIndex, /demo\/test\/smoke-note/);

  const topIndex = fs.readFileSync(path.join(repoPath, '.wiki', 'canon', '_index.md'), 'utf8');
  assert.match(topIndex, /通过 `\/wiki` 使用知识前台入口/);
  assert.doesNotMatch(topIndex, /\/wiki-query|\/wiki-ingest/);

  const proposalText = fs.readFileSync(path.join(repoPath, '.wiki', 'changes', 'approved', '2026-04-10-create-smoke-note.md'), 'utf8');
  assert.match(proposalText, /compiled: true/);

  const stateText = fs.readFileSync(path.join(repoPath, '.wiki', 'policy', 'STATE.md'), 'utf8');
  assert.match(stateText, /- pending_proposals: 0/);
  assert.match(stateText, /- total_canon_pages: 1/);
  assert.match(stateText, /- total_domains: 1/);
});

test('review approval requires a meaningful note', (t) => {
  const repoPath = makeTempRepo(t);
  const seeded = seedCreateProposal(repoPath);

  assert.throws(
    () => applyReviewDecision(repoPath, 'approve', seeded.proposal, { reviewedBy: 'tester', note: 'short' }),
    /meaningful --note/
  );
});

test('compile apply rolls back page, indexes, proposal, and log when state update fails', (t) => {
  const repoPath = makeTempRepo(t);
  const seeded = seedCreateProposal(repoPath);
  const approvedPath = applyReviewDecision(repoPath, 'approve', seeded.proposal, {
    reviewedBy: 'tester',
    note: 'meaningful approval note',
  });
  const pagePath = path.join(repoPath, '.wiki', 'canon', 'domains', 'demo', 'test', 'smoke-note.md');
  const domainIndexPath = path.join(repoPath, '.wiki', 'canon', 'domains', 'demo', '_index.md');
  const topIndexPath = path.join(repoPath, '.wiki', 'canon', '_index.md');
  const logPath = path.join(repoPath, '.wiki', 'changes', 'LOG.md');
  const statePath = path.join(repoPath, '.wiki', 'policy', 'STATE.md');
  const proposalBefore = fs.readFileSync(approvedPath, 'utf8');
  const logBefore = fs.readFileSync(logPath, 'utf8');
  const topIndexBefore = fs.readFileSync(topIndexPath, 'utf8');
  const domainIndexBefore = fs.existsSync(domainIndexPath) ? fs.readFileSync(domainIndexPath, 'utf8') : null;

  fs.rmSync(statePath, { force: true });

  assert.throws(
    () => compileApprovedProposal(repoPath, approvedPath),
    /STATE\.md|ENOENT/
  );

  assert.equal(fs.existsSync(pagePath), false);
  assert.equal(fs.readFileSync(approvedPath, 'utf8'), proposalBefore);
  assert.equal(fs.readFileSync(logPath, 'utf8'), logBefore);
  assert.equal(fs.readFileSync(topIndexPath, 'utf8'), topIndexBefore);
  assert.equal(fs.existsSync(domainIndexPath), false);
  assert.equal(domainIndexBefore, null);
});

test('review apply rolls back proposal move and log when state update fails', (t) => {
  const repoPath = makeTempRepo(t);
  const seeded = seedCreateProposal(repoPath);
  const inboxPath = path.join(repoPath, '.wiki', seeded.proposal);
  const approvedPath = path.join(repoPath, '.wiki', 'changes', 'approved', path.basename(seeded.proposal));
  const logPath = path.join(repoPath, '.wiki', 'changes', 'LOG.md');
  const statePath = path.join(repoPath, '.wiki', 'policy', 'STATE.md');
  const proposalBefore = fs.readFileSync(inboxPath, 'utf8');
  const logBefore = fs.readFileSync(logPath, 'utf8');

  fs.rmSync(statePath, { force: true });

  assert.throws(
    () => applyReviewDecision(repoPath, 'approve', seeded.proposal, {
      reviewedBy: 'tester',
      note: 'meaningful approval note',
    }),
    /STATE\.md|ENOENT/
  );

  assert.equal(fs.readFileSync(inboxPath, 'utf8'), proposalBefore);
  assert.equal(fs.existsSync(approvedPath), false);
  assert.equal(fs.readFileSync(logPath, 'utf8'), logBefore);
});

test('resolve apply rolls back page, proposal move, and log when state update fails', (t) => {
  const repoPath = makeTempRepo(t);
  const seeded = seedConflictProposal(repoPath);
  const mergedFilePath = path.join(repoPath, 'merged.md');
  const resolvedPath = path.join(repoPath, '.wiki', 'changes', 'resolved', path.basename(seeded.proposalPath));
  const logPath = path.join(repoPath, '.wiki', 'changes', 'LOG.md');
  const statePath = path.join(repoPath, '.wiki', 'policy', 'STATE.md');
  const pageBefore = fs.readFileSync(seeded.pagePath, 'utf8');
  const proposalBefore = fs.readFileSync(seeded.proposalPath, 'utf8');
  const logBefore = fs.readFileSync(logPath, 'utf8');

  fs.writeFileSync(mergedFilePath, '## 定义\n\n已合并定义。\n', 'utf8');
  fs.rmSync(statePath, { force: true });

  assert.throws(
    () => applyResolve(repoPath, seeded.proposalPath, {
      mergedFile: mergedFilePath,
      resolvedBy: 'tester',
      resolution: 'manual',
      confidence: 'high',
    }),
    /STATE\.md|ENOENT/
  );

  assert.equal(fs.readFileSync(seeded.pagePath, 'utf8'), pageBefore);
  assert.equal(fs.readFileSync(seeded.proposalPath, 'utf8'), proposalBefore);
  assert.equal(fs.existsSync(resolvedPath), false);
  assert.equal(fs.readFileSync(logPath, 'utf8'), logBefore);
});

test('runtime helper enforces the documented Node floor', () => {
  assert.equal(supportsRequiredNode('22.5.0'), true);
  assert.equal(supportsRequiredNode('22.4.9'), false);
  assert.equal(supportsRequiredNode('21.9.0'), false);
});

test('taxonomy suggestions are queued and can be accepted into the registry', (t) => {
  const repoPath = makeTempRepo(t);

  importWorkflow(repoPath, {
    source: {
      kind: 'article',
      title: 'Latency benchmark',
      ingested_at: '2026-04-10',
      domain: 'research',
      subtype: 'benchmark',
      tags: ['latency'],
      suggested_tags: ['throughput'],
      body: 'Benchmark notes.',
    },
    proposal: {
      action: 'create',
      status: 'inbox',
      target_page: 'research/benchmarks/latency-benchmark',
      target_type: 'concept',
      subtype: 'benchmark',
      confidence: 'medium',
      origin: 'ingest',
      auto_quality_score: 0.8,
      body: '## 提案摘要\n\nLatency benchmark.\n',
    },
  });

  const pendingSuggestions = listSuggestions(repoPath, 'pending');
  assert.ok(pendingSuggestions.some((item) => item.kind === 'domain' && item.value === 'research'));
  assert.ok(pendingSuggestions.some((item) => item.kind === 'subtype' && item.value === 'benchmark'));
  assert.ok(pendingSuggestions.some((item) => item.kind === 'tag' && item.value === 'throughput'));

  applySuggestionDecision(repoPath, 'accepted', { kind: 'domain', value: 'research' });
  applySuggestionDecision(repoPath, 'accepted', {
    kind: 'subtype',
    value: 'benchmark',
    domain: 'research',
    primaryType: 'concept',
  });

  const snapshot = getTaxonomySnapshot(repoPath);
  assert.ok(snapshot.domains.some((item) => item.id === 'research'));
  assert.ok(snapshot.subtypes.some((item) => item.id === 'benchmark'));
});

test('ask workflow applies taxonomy hints before lexical ranking', (t) => {
  const repoPath = makeTempRepo(t);

  createCanon(repoPath, {
    targetPage: 'ai/playbooks/chunk-size-playbook',
    type: 'guide',
    title: 'Chunk Size Playbook',
    subtype: 'workflow',
    tags: ['chunk-size', 'retrieval'],
    sources: ['sources/notes/chunk-size.md'],
    body: '## 步骤\n\n如何选择 chunk size。\n',
  });
  createCanon(repoPath, {
    targetPage: 'ai/concepts/chunk-size-basics',
    type: 'concept',
    title: 'Chunk Size Basics',
    subtype: 'architecture',
    tags: ['chunk-size'],
    sources: ['sources/notes/chunk-size.md'],
    body: '## 定义\n\nChunk size 是检索切分大小。\n',
  });

  const result = askWorkflow(repoPath, '如何选择 chunk size', 5);

  assert.ok(result.retrieval.classification.primary_type_hints.includes('guide'));
  assert.equal(result.pages[0].primary_type, 'guide');
  assert.equal(result.pages[0].path, 'canon/domains/ai/playbooks/chunk-size-playbook.md');
});
