'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatterFile, updateFrontmatterFile, replaceConflictBlock } = require('./frontmatter');
const { openRuntimeIndex, recordOperation, rebuildRuntimeIndex, syncRuntimeFiles, wikiRelative } = require('./runtime-index');

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

function repoRelative(repoRoot, absolutePath) {
  return normalizePath(path.relative(repoRoot, absolutePath));
}

function listMarkdownFiles(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const results = [];
  const stack = [targetDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== '.gitkeep') {
        results.push(entryPath);
      }
    }
  }
  results.sort();
  return results;
}

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function findNamedFile(repoRoot, target, stageDirs) {
  const normalizedTarget = target.replace(/^\.wiki\//, '').replace(/\\/g, '/');
  const directCandidates = [
    path.resolve(process.cwd(), target),
    path.resolve(repoRoot, target),
    path.resolve(path.join(repoRoot, '.wiki'), normalizedTarget),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  const matches = [];
  for (const stageDir of stageDirs) {
    const folderPath = path.join(repoRoot, '.wiki', 'changes', stageDir);
    for (const filePath of listMarkdownFiles(folderPath)) {
      if (path.basename(filePath) === normalizedTarget) {
        matches.push(filePath);
      }
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`multiple matches found for '${target}'. Use a fuller path.`);
  }

  throw new Error(`file not found: ${target}`);
}

function resolveUserFile(repoRoot, target) {
  const normalizedTarget = target.replace(/^\.wiki\//, '').replace(/\\/g, '/');
  const candidates = [
    path.resolve(process.cwd(), target),
    path.resolve(repoRoot, target),
    path.resolve(path.join(repoRoot, '.wiki'), normalizedTarget),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), target);
}

function appendLog(repoRoot, target, spec, message, extraFields = []) {
  const timestamp = formatTimestamp();
  const logFile =
    target === 'changes'
      ? path.join(repoRoot, '.wiki', 'changes', 'LOG.md')
      : path.join(repoRoot, '.wiki', 'policy', 'LOG.md');

  if (!fs.existsSync(logFile)) {
    throw new Error(`log file not found: ${logFile}`);
  }

  const lines = ['', `## ${timestamp} ${spec}`, '', `- ${message}`];
  for (const field of extraFields) {
    lines.push(`- ${field}`);
  }
  fs.appendFileSync(logFile, `${lines.join('\n')}\n`, 'utf8');
}

function updateState(repoRoot, overrides = {}) {
  const stateFile = path.join(repoRoot, '.wiki', 'policy', 'STATE.md');
  const db = openRuntimeIndex(repoRoot);
  const summary = {
    total_sources: db.prepare('SELECT COUNT(*) AS count FROM sources').get().count,
    total_canon_pages: db.prepare('SELECT COUNT(*) AS count FROM pages WHERE status != ?').get('archived').count,
    total_domains: db.prepare('SELECT COUNT(DISTINCT domain) AS count FROM pages').get().count,
    pending_proposals: db.prepare('SELECT COUNT(*) AS count FROM proposals WHERE status IN (?, ?)').get('inbox', 'review').count,
    last_promote_at: overrides.last_promote_at,
    last_compile: overrides.last_compile,
    last_lint: overrides.last_lint,
    open_conflicts: db.prepare('SELECT COUNT(*) AS count FROM proposals WHERE status = ?').get('conflict').count,
  };
  recordOperation(db, 'state.update', 'ok', summary);

  let text = fs.readFileSync(stateFile, 'utf8');
  const replaceBullet = (key, value) => {
    const pattern = new RegExp(`- ${key}: .*`, 'g');
    const replacement = `- ${key}: ${value ?? '~'}`;
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
    }
  };

  replaceBullet('total_sources', summary.total_sources);
  replaceBullet('total_canon_pages', summary.total_canon_pages);
  replaceBullet('total_domains', summary.total_domains);
  replaceBullet('pending_proposals', summary.pending_proposals);
  if (summary.last_promote_at) {
    replaceBullet('last_promote_at', summary.last_promote_at);
  }
  if (summary.last_compile) {
    replaceBullet('last_compile', summary.last_compile);
  }
  if (summary.last_lint) {
    replaceBullet('last_lint', summary.last_lint);
  }
  replaceBullet('open_conflicts', summary.open_conflicts);
  text = text.replace(/updated_at: .*/, `updated_at: ${formatDate()}`);

  fs.writeFileSync(stateFile, text, 'utf8');
  return summary;
}

function getProposalRows(repoRoot, stages) {
  const db = openRuntimeIndex(repoRoot);
  const placeholders = stages.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT path, status, action, target_page, proposed_at, reviewed_at, compiled
       FROM proposals WHERE status IN (${placeholders})
       ORDER BY proposed_at ASC, path ASC`
    )
    .all(...stages);
  recordOperation(db, 'queue.read', 'ok', { stages });
  return rows.map((row) => ({
    proposal: row.path,
    stage: row.status,
    action: row.action || '~',
    targetPage: row.target_page || '~',
    proposedAt: row.proposed_at || '~',
    reviewedAt: row.reviewed_at || '~',
    compiled: row.compiled || 'false',
  }));
}

function getConflictRows(repoRoot) {
  const db = openRuntimeIndex(repoRoot);
  const rows = db
    .prepare(
      `SELECT path, target_page, conflict_location, trigger_source, proposed_at
       FROM proposals WHERE status = 'conflict'
       ORDER BY proposed_at ASC, path ASC`
    )
    .all();
  recordOperation(db, 'conflict.read', 'ok', {});
  return rows.map((row) => ({
    proposal: row.path,
    targetPage: row.target_page || '~',
    conflictLocation: row.conflict_location || '~',
    triggerSource: row.trigger_source || '~',
    proposedAt: row.proposed_at || '~',
  }));
}

function computeCheckFindings(repoRoot) {
  const db = openRuntimeIndex(repoRoot);
  db.exec('DELETE FROM lint_findings');
  const findings = [];
  const pushFinding = (ruleId, severity, targetPath, message) => {
    findings.push({ ruleId, severity, targetPath, message });
    db.prepare('INSERT INTO lint_findings (rule_id, severity, target_path, message) VALUES (?, ?, ?, ?)')
      .run(ruleId, severity, targetPath, message);
  };

  const pages = db.prepare('SELECT * FROM pages ORDER BY path').all();
  const pageSlugSet = new Set(pages.map((row) => row.slug));

  const indexedPages = new Set();
  for (const indexFile of listMarkdownFiles(path.join(repoRoot, '.wiki', 'canon'))) {
    if (path.basename(indexFile) !== '_index.md') {
      continue;
    }
    const { frontmatter } = parseFrontmatterFile(indexFile);
    const pagesList = Array.isArray(frontmatter.pages) ? frontmatter.pages : [];
    for (const pagePath of pagesList) {
      indexedPages.add(String(pagePath));
    }
  }

  for (const page of pages) {
    const relCanonPath = page.path.replace(/^canon\/domains\//, '').replace(/\.md$/, '');
    const meta = JSON.parse(page.meta_json || '{}');
    if (!indexedPages.has(relCanonPath)) {
      pushFinding('L001', 'warning', page.path, '未被任何 _index.md 引用');
    }

    const lastUpdated = page.last_updated || '';
    let effectiveStaleness = Number.parseInt(page.staleness_days || 0, 10) || 0;
    if (lastUpdated) {
      const updatedDate = new Date(lastUpdated);
      if (!Number.isNaN(updatedDate.getTime())) {
        effectiveStaleness = Math.max(0, Math.floor((Date.now() - updatedDate.getTime()) / 86400000));
      }
    }
    if (effectiveStaleness > 90) {
      pushFinding('L002', 'warning', page.path, `effective_staleness_days=${effectiveStaleness}`);
    }
    if ((page.source_count || 0) === 0) {
      pushFinding('L003', 'error', page.path, 'sources 列表为空');
    }
    const crossRefs = Array.isArray(meta.cross_refs) ? meta.cross_refs : [];
    for (const ref of crossRefs) {
      if (!pageSlugSet.has(String(ref))) {
        pushFinding('L004', 'error', page.path, `cross_refs 引用不存在: ${ref}`);
      }
    }
    if (page.confidence === 'low' && effectiveStaleness > 30) {
      pushFinding('L005', 'warning', page.path, `confidence=low, ${effectiveStaleness}天未更新`);
    }
    if (page.content.includes('<<<CONFLICT>>>')) {
      pushFinding('L006', 'warning', page.path, '正文含 <<<CONFLICT>>> 标记');
    }
    if (meta.type === 'source' || meta.type === 'change-proposal') {
      pushFinding('L010', 'warning', page.path, `type=${meta.type} 与 canon/ 路径不匹配`);
    }
  }

  const domainCounts = new Map();
  for (const page of pages) {
    domainCounts.set(page.domain, (domainCounts.get(page.domain) || 0) + 1);
  }
  for (const [domain, count] of domainCounts.entries()) {
    if (count > 50) {
      pushFinding('L007', 'info', `canon/domains/${domain}`, `${count}个页面，超出阈值50`);
    }
  }

  const proposals = db
    .prepare("SELECT path, status, proposed_at, origin FROM proposals WHERE status IN ('inbox', 'review')")
    .all();
  for (const proposal of proposals) {
    if (!proposal.proposed_at) {
      continue;
    }
    const proposedDate = new Date(proposal.proposed_at);
    if (Number.isNaN(proposedDate.getTime())) {
      continue;
    }
    const age = Math.max(0, Math.floor((Date.now() - proposedDate.getTime()) / 86400000));
    const threshold = proposal.origin === 'query-writeback' ? 14 : 7;
    if (age > threshold) {
      pushFinding('L008', 'warning', proposal.path, `已持续${age}天`);
    }
  }

  const domainRoot = path.join(repoRoot, '.wiki', 'canon', 'domains');
  if (fs.existsSync(domainRoot)) {
    for (const entry of fs.readdirSync(domainRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const indexPath = path.join(domainRoot, entry.name, '_index.md');
        if (!fs.existsSync(indexPath)) {
          pushFinding('L009', 'error', `canon/domains/${entry.name}`, '目录缺少 _index.md');
        }
      }
    }
  }

  const reviewRows = db
    .prepare("SELECT decision, reviewed_at FROM reviews WHERE decision IN ('approved', 'rejected') ORDER BY reviewed_at DESC")
    .all();
  let consecutiveApproves = 0;
  for (const row of reviewRows) {
    if (row.decision === 'rejected') {
      break;
    }
    consecutiveApproves += 1;
  }
  if (consecutiveApproves >= 10) {
    pushFinding('L011', 'warning', 'changes', `连续批准${consecutiveApproves}次`);
  }

  recordOperation(db, 'check.run', 'ok', { findings: findings.length });
  return findings;
}

function applyReviewDecision(repoRoot, decision, proposalInput, options) {
  const stageDirs = decision === 'reopen' ? ['rejected'] : ['inbox', 'review'];
  const proposalPath = findNamedFile(repoRoot, proposalInput, stageDirs);
  const proposal = parseFrontmatterFile(proposalPath).frontmatter;
  const destinationMap = {
    approve: 'approved',
    reject: 'rejected',
    reopen: 'inbox',
    revise: 'review',
  };
  const destination = destinationMap[decision];
  const now = formatTimestamp();
  const updates = {};

  if (decision === 'approve') {
    updates.status = 'approved';
    updates.reviewed_by = options.reviewedBy;
    updates.reviewed_at = options.reviewedAt || now;
    updates.approve_note = options.note;
  } else if (decision === 'reject') {
    updates.status = 'rejected';
    updates.reviewed_by = options.reviewedBy;
    updates.reviewed_at = options.reviewedAt || now;
    updates.rejection_reason = options.reason;
  } else if (decision === 'reopen') {
    updates.status = 'inbox';
    updates.reopen_reason = options.reason || null;
    updates.reopened_at = now;
    updates.reviewed_by = null;
    updates.reviewed_at = null;
    updates.rejection_reason = null;
  } else if (decision === 'revise') {
    updates.status = 'review';
    updates.modify_note = options.note;
    updates.modified_at = now;
  } else {
    throw new Error(`unknown review decision: ${decision}`);
  }

  updateFrontmatterFile(proposalPath, updates);
  const destinationPath = path.join(repoRoot, '.wiki', 'changes', destination, path.basename(proposalPath));
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (proposalPath !== destinationPath) {
    fs.renameSync(proposalPath, destinationPath);
  }
  syncRuntimeFiles(repoRoot, [proposalPath, destinationPath]);

  appendLog(
    repoRoot,
    'changes',
    'review',
    `decision: ${decision} | file: ${wikiRelative(repoRoot, destinationPath)} | target: ${proposal.target_page || '~'} | action: ${proposal.action || '~'} | by: ${options.reviewedBy || 'system'}`
  );
  updateState(repoRoot, { last_promote_at: options.reviewedAt || now });
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'review.apply', 'ok', { decision, proposal: wikiRelative(repoRoot, destinationPath) });
  return destinationPath;
}

function markApplyDone(repoRoot, proposalInput, options) {
  const proposalPath = findNamedFile(repoRoot, proposalInput, ['approved']);
  const proposal = parseFrontmatterFile(proposalPath).frontmatter;
  const updates =
    options.result === 'error'
      ? { compiled: 'error', compiled_at: formatDate() }
      : { compiled: true, compiled_at: formatDate() };
  updateFrontmatterFile(proposalPath, updates);
  syncRuntimeFiles(repoRoot, [proposalPath]);
  appendLog(
    repoRoot,
    'changes',
    'apply',
    `action: ${proposal.action || '~'} | target: ${proposal.target_page || '~'} | result: ${options.result} | sources_added: ${options.sourcesAdded} | cross_refs_updated: ${options.refsUpdated} | conflicts: ${options.conflicts}`
  );
  updateState(repoRoot, { last_compile: formatDate() });
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'apply.done', 'ok', { proposal: wikiRelative(repoRoot, proposalPath), result: options.result });
  return proposalPath;
}

function applyResolve(repoRoot, proposalInput, options) {
  const proposalPath = findNamedFile(repoRoot, proposalInput, ['conflicts']);
  const proposal = parseFrontmatterFile(proposalPath).frontmatter;
  const mergedFilePath = resolveUserFile(repoRoot, options.mergedFile);
  if (!fs.existsSync(mergedFilePath)) {
    throw new Error(`merged file not found: ${mergedFilePath}`);
  }
  const pagePath = options.page
    ? resolveUserFile(repoRoot, options.page)
    : path.join(repoRoot, '.wiki', 'canon', 'domains', `${proposal.target_page}.md`);
  if (!fs.existsSync(pagePath)) {
    throw new Error(`canon page not found: ${pagePath}`);
  }

  const mergedContent = fs.readFileSync(mergedFilePath, 'utf8');
  replaceConflictBlock(pagePath, mergedContent);
  const pageUpdates = {
    last_compiled: formatDate(),
    staleness_days: 0,
  };
  if (options.confidence) {
    pageUpdates.confidence = options.confidence;
  }
  updateFrontmatterFile(pagePath, pageUpdates);
  updateFrontmatterFile(proposalPath, {
    status: 'resolved',
    resolved_at: formatDate(),
    resolved_by: options.resolvedBy,
    resolution: options.resolution,
  });
  const resolvedPath = path.join(repoRoot, '.wiki', 'changes', 'resolved', path.basename(proposalPath));
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.renameSync(proposalPath, resolvedPath);
  syncRuntimeFiles(repoRoot, [pagePath, proposalPath, resolvedPath]);

  appendLog(
    repoRoot,
    'changes',
    'resolve',
    `target: ${proposal.target_page || repoRelative(repoRoot, pagePath)} | resolution: ${options.resolution} | resolved_by: ${options.resolvedBy}`
  );
  updateState(repoRoot, { last_compile: formatDate() });
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'resolve.apply', 'ok', { proposal: wikiRelative(repoRoot, resolvedPath) });
  return { pagePath, resolvedPath };
}

module.exports = {
  appendLog,
  applyResolve,
  applyReviewDecision,
  computeCheckFindings,
  findNamedFile,
  formatDate,
  formatTimestamp,
  getConflictRows,
  getProposalRows,
  markApplyDone,
  repoRelative,
  resolveUserFile,
  updateState,
};
