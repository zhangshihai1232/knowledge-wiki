'use strict';

const fs = require('fs');
const path = require('path');
const {
  appendToSection,
  parseFrontmatterFile,
  replaceSection,
  updateFrontmatterFile,
  writeFrontmatterFile,
  replaceConflictBlock,
} = require('./frontmatter');
const {
  openRuntimeIndex,
  recordOperation,
  searchRuntimeIndex,
  syncRuntimeFiles,
  wikiRelative,
} = require('./runtime-index');
const { appendLog, computeCheckFindings, formatDate, formatTimestamp, updateState } = require('./wiki-repo');
const { listMarkdownFiles } = require('./utils');

function repoWikiPath(repoRoot, relativePath) {
  return path.join(repoRoot, '.wiki', relativePath);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function ensureUniquePath(filePath) {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  let counter = 2;
  while (fs.existsSync(`${base}-${counter}${ext}`)) {
    counter += 1;
  }
  return `${base}-${counter}${ext}`;
}

function readOptionalBody(options = {}) {
  if (typeof options.body === 'string') {
    return options.body;
  }
  if (options.bodyFile) {
    return fs.readFileSync(options.bodyFile, 'utf8');
  }
  return '';
}

function resolveInternalFile(repoRoot, target) {
  const normalizedTarget = target.replace(/^\.wiki\//, '').replace(/\\/g, '/');
  const candidates = [
    path.resolve(process.cwd(), target),
    path.resolve(repoRoot, target),
    repoWikiPath(repoRoot, normalizedTarget),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(process.cwd(), target);
}

function createSource(repoRoot, options) {
  const kind = options.kind || '';
  const title = options.title || '';
  if (!['article', 'conversation', 'note', 'reference'].includes(kind)) {
    throw new Error('create-source: --kind must be article|conversation|note|reference');
  }
  if (!title) {
    throw new Error('create-source: --title is required');
  }
  const subdir = kind === 'reference' ? 'references' : `${kind}s`;
  const slug = slugify(title);
  const date = options.ingestedAt || formatDate();
  const initialPath = repoWikiPath(repoRoot, `sources/${subdir}/${date}-${slug}.md`);
  const filePath = ensureUniquePath(initialPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const frontmatter = {
    type: 'source',
    source_kind: kind,
    title,
    url: options.url || null,
    author: options.author || null,
    published_at: options.publishedAt || null,
    ingested_at: date,
    domain: options.domain || null,
    tags: Array.isArray(options.tags) ? options.tags : options.tags ? String(options.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
    extracted: Boolean(options.extracted),
  };
  const body = ['## 原始内容', '', readOptionalBody(options), '', '## 提取声明', ''].join('\n');
  writeFrontmatterFile(filePath, frontmatter, body);
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function createProposal(repoRoot, options) {
  const action = options.action || '';
  const status = options.status || 'inbox';
  const confidence = options.confidence || 'medium';
  const targetPage = options.targetPage || '';
  const triggerSource = options.triggerSource || '';
  if (!['create', 'update', 'merge', 'split', 'archive'].includes(action)) {
    throw new Error('create-proposal: --action must be create|update|merge|split|archive');
  }
  if (!['inbox', 'review'].includes(status)) {
    throw new Error('create-proposal: --status must be inbox|review');
  }
  if (!['high', 'medium', 'low'].includes(confidence)) {
    throw new Error('create-proposal: --confidence must be high|medium|low');
  }
  if (!targetPage || !triggerSource) {
    throw new Error('create-proposal: --target-page and --trigger-source are required');
  }

  const date = options.proposedAt || formatDate();
  const slug = slugify(targetPage.split('/').pop() || targetPage);
  const initialPath = repoWikiPath(repoRoot, `changes/${status}/${date}-${action}-${slug}.md`);
  const filePath = ensureUniquePath(initialPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const frontmatter = {
    type: 'change-proposal',
    action,
    status,
    target_page: targetPage,
    target_type: options.targetType || null,
    trigger_source: triggerSource,
    origin: options.origin || 'ingest',
    confidence,
    proposed_at: date,
    auto_quality_score: options.autoQualityScore || null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    compiled: false,
    compiled_at: null,
  };
  writeFrontmatterFile(filePath, frontmatter, readOptionalBody(options));
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function canonTemplate(pageType) {
  switch (pageType) {
    case 'concept':
      return '## 定义\n\n## 核心特征\n\n## 相关概念\n\n## 参考来源\n';
    case 'entity':
      return '## 基本信息\n\n## 关键属性\n\n## 历史/背景\n\n## 参考来源\n';
    case 'comparison':
      return '## 对比维度\n\n## 详细对比\n\n| 维度 | A | B |\n|------|---|---|\n\n## 选择建议\n\n## 参考来源\n';
    case 'guide':
      return '## 前提条件\n\n## 步骤\n\n## 常见问题\n\n## 参考来源\n';
    case 'decision':
      return '## 背景与约束\n\n## 选项分析\n\n## 决策结论\n\n## 参考来源\n';
    default:
      return '';
  }
}

function createCanon(repoRoot, options) {
  const targetPage = options.targetPage || '';
  const pageType = options.type || '';
  const title = options.title || '';
  if (!targetPage || !pageType || !title) {
    throw new Error('create-canon: --target-page, --type, and --title are required');
  }
  if (!['concept', 'entity', 'comparison', 'guide', 'decision'].includes(pageType)) {
    throw new Error('create-canon: --type must be concept|entity|comparison|guide|decision');
  }
  const parts = targetPage.split('/').filter(Boolean);
  const domain = parts[0] || '';
  const filePath = repoWikiPath(repoRoot, `canon/domains/${targetPage}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sources = Array.isArray(options.sources)
    ? options.sources
    : typeof options.sources === 'string'
      ? options.sources.split(',').map((item) => item.trim()).filter(Boolean)
      : [];
  const frontmatter = {
    type: pageType,
    title,
    domain,
    sources,
    confidence: options.confidence || 'medium',
    last_compiled: formatDate(),
    staleness_days: 0,
    last_updated: formatDate(),
    cross_refs: [],
    status: 'active',
    tags: [],
    last_queried_at: null,
    query_count: 0,
  };
  writeFrontmatterFile(filePath, frontmatter, readOptionalBody(options) || canonTemplate(pageType));
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function updateDomainIndex(repoRoot, options) {
  const domain = options.domain || '';
  if (!domain) {
    throw new Error('update-index: --domain is required');
  }
  const domainDir = repoWikiPath(repoRoot, `canon/domains/${domain}`);
  const indexPath = path.join(domainDir, '_index.md');
  const topIndexPath = repoWikiPath(repoRoot, 'canon/_index.md');
  fs.mkdirSync(domainDir, { recursive: true });
  if (!fs.existsSync(topIndexPath)) {
    fs.writeFileSync(topIndexPath, '# Canon Index\n', 'utf8');
  }

  const pageFiles = listMarkdownFiles(domainDir).filter((filePath) => path.basename(filePath) !== '_index.md');
  const pages = pageFiles.map((filePath) => {
    const relPath = wikiRelative(repoRoot, filePath).replace(/^canon\/domains\//, '').replace(/\.md$/, '');
    const { frontmatter } = parseFrontmatterFile(filePath);
    const pageTitle = frontmatter.title || path.basename(filePath, '.md');
    const category = relPath.split('/').slice(1, -1).join('/') || 'uncategorized';
    return { relPath, pageTitle, slug: path.basename(filePath, '.md'), category };
  });

  const lines = ['# ' + domain + ' 领域', ''];
  let currentCategory = '';
  for (const page of pages) {
    if (page.category !== currentCategory) {
      lines.push(`## ${page.category}`, '');
      currentCategory = page.category;
    }
    lines.push(`- [[${page.slug}]] — ${page.pageTitle}`);
  }
  const frontmatter = {
    type: 'index',
    domain,
    title: `${domain} 领域索引`,
    updated_at: formatDate(),
    pages: pages.map((page) => page.relPath),
    status: 'active',
  };
  writeFrontmatterFile(indexPath, frontmatter, lines.join('\n'));

  const domainLink = `- [${domain}](domains/${domain}/_index.md)`;
  const topLines = fs.readFileSync(topIndexPath, 'utf8').split('\n').filter(Boolean);
  if (!topLines.includes(domainLink)) {
    topLines.push(domainLink);
    fs.writeFileSync(topIndexPath, `${topLines.join('\n')}\n`, 'utf8');
  }
  return indexPath;
}

function markExtracted(repoRoot, sourceInput) {
  const filePath = resolveInternalFile(repoRoot, sourceInput);
  updateFrontmatterFile(filePath, { extracted: true });
  syncRuntimeFiles(repoRoot, [filePath]);
  return 'ok';
}

function markCompiled(repoRoot, proposalInput) {
  const filePath = resolveInternalFile(repoRoot, proposalInput);
  updateFrontmatterFile(filePath, { compiled: true, compiled_at: formatDate() });
  syncRuntimeFiles(repoRoot, [filePath]);
  return 'ok';
}

function getFrontmatterValue(repoRoot, fileInput, key) {
  const filePath = resolveInternalFile(repoRoot, fileInput);
  const { frontmatter } = parseFrontmatterFile(filePath);
  const value = frontmatter[key];
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function getFrontmatterList(repoRoot, fileInput, key) {
  const filePath = resolveInternalFile(repoRoot, fileInput);
  const { frontmatter } = parseFrontmatterFile(filePath);
  const value = frontmatter[key];
  return Array.isArray(value) ? value : [];
}

function setFrontmatterValue(repoRoot, fileInput, key, value) {
  const filePath = resolveInternalFile(repoRoot, fileInput);
  let normalized = value;
  if (value === '~') {
    normalized = null;
  } else if (value === 'true') {
    normalized = true;
  } else if (value === 'false') {
    normalized = false;
  }
  updateFrontmatterFile(filePath, { [key]: normalized });
  syncRuntimeFiles(repoRoot, [filePath]);
  return 'ok';
}

function countThings(repoRoot, target = 'all') {
  const counts = {
    sources: listMarkdownFiles(repoWikiPath(repoRoot, 'sources')).filter((item) => path.basename(item) !== '_index.md').length,
    canon: listMarkdownFiles(repoWikiPath(repoRoot, 'canon/domains')).filter((item) => path.basename(item) !== '_index.md').length,
    domains: fs.existsSync(repoWikiPath(repoRoot, 'canon/domains'))
      ? fs.readdirSync(repoWikiPath(repoRoot, 'canon/domains'), { withFileTypes: true }).filter((item) => item.isDirectory()).length
      : 0,
    inbox: listMarkdownFiles(repoWikiPath(repoRoot, 'changes/inbox')).length,
    review: listMarkdownFiles(repoWikiPath(repoRoot, 'changes/review')).length,
    approved: listMarkdownFiles(repoWikiPath(repoRoot, 'changes/approved')).length,
    rejected: listMarkdownFiles(repoWikiPath(repoRoot, 'changes/rejected')).length,
    conflicts: listMarkdownFiles(repoWikiPath(repoRoot, 'changes/conflicts')).length,
  };
  counts.pending = counts.inbox + counts.review;
  if (target === 'all') {
    return counts;
  }
  if (!(target in counts)) {
    throw new Error(`count: unknown target: ${target}`);
  }
  return counts[target];
}

function dedupCheck(repoRoot, targetPage) {
  const db = openRuntimeIndex(repoRoot);
  const row = db
    .prepare("SELECT path FROM proposals WHERE target_page = ? AND status IN ('inbox', 'review') ORDER BY proposed_at ASC LIMIT 1")
    .get(targetPage);
  if (row) {
    return { duplicate: true, path: row.path };
  }
  return { duplicate: false };
}

function resolveConflict(repoRoot, canonPathInput, mergedFileInput) {
  const canonPath = resolveInternalFile(repoRoot, canonPathInput);
  const mergedFile = resolveInternalFile(repoRoot, mergedFileInput);
  const mergedContent = fs.readFileSync(mergedFile, 'utf8');
  replaceConflictBlock(canonPath, mergedContent);
  syncRuntimeFiles(repoRoot, [canonPath]);
  return 'ok';
}

function appendSourceClaims(repoRoot, sourceInput, claims) {
  const filePath = resolveInternalFile(repoRoot, sourceInput);
  const normalizedClaims = Array.isArray(claims) ? claims.filter(Boolean) : [];
  if (!normalizedClaims.length) {
    throw new Error('append-source-claims: claims are required');
  }
  const existingText = fs.readFileSync(filePath, 'utf8');
  const missingClaims = normalizedClaims.filter((claim) => !existingText.includes(claim));
  if (!missingClaims.length) {
    return filePath;
  }
  const content = missingClaims.map((claim) => `- ${claim}`).join('\n');
  appendToSection(filePath, '提取声明', content, { dedupNeedle: missingClaims[0] });
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function appendPageMaintenanceRecord(repoRoot, pageInput, recordText) {
  const filePath = resolveInternalFile(repoRoot, pageInput);
  if (!recordText) {
    throw new Error('append-maintenance-record: record text is required');
  }
  appendToSection(filePath, '维护记录', `- ${recordText}`);
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function mergeProposalEvidence(repoRoot, proposalInput, evidenceText) {
  const filePath = resolveInternalFile(repoRoot, proposalInput);
  if (!evidenceText) {
    throw new Error('merge-proposal-evidence: evidence text is required');
  }
  appendToSection(filePath, 'Source 证据', evidenceText, { dedupNeedle: evidenceText.split('\n')[0] });
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function applyMergedContent(repoRoot, pageInput, mergedContent, options = {}) {
  const filePath = resolveInternalFile(repoRoot, pageInput);
  let normalizedContent = mergedContent;
  if (!normalizedContent && options.mergedFile) {
    normalizedContent = fs.readFileSync(resolveInternalFile(repoRoot, options.mergedFile), 'utf8');
  }
  if (!normalizedContent) {
    throw new Error('apply-merged-content: merged content is required');
  }
  if (normalizedContent.includes('<<<CONFLICT>>>')) {
    replaceConflictBlock(filePath, normalizedContent);
  } else if (options.section) {
    replaceSection(filePath, options.section, normalizedContent);
  } else {
    throw new Error('apply-merged-content: either conflict markers must exist or --section must be provided');
  }
  syncRuntimeFiles(repoRoot, [filePath]);
  return filePath;
}

function moveProposal(repoRoot, proposalInput, destination, options = {}) {
  const allowedDestinations = new Set(['approved', 'rejected', 'review', 'inbox', 'conflicts', 'resolved']);
  if (!allowedDestinations.has(destination)) {
    throw new Error(`move-proposal: unsupported destination: ${destination}`);
  }
  const proposalPath = resolveInternalFile(repoRoot, proposalInput);
  if (!fs.existsSync(proposalPath)) {
    throw new Error(`move-proposal: file not found: ${proposalPath}`);
  }
  const now = formatTimestamp();
  const updates = {};
  if (destination === 'approved') {
    updates.status = 'approved';
    updates.reviewed_by = options.reviewedBy || null;
    updates.reviewed_at = options.reviewedAt || now;
    updates.approve_note = options.approveNote || null;
  } else if (destination === 'rejected') {
    updates.status = 'rejected';
    updates.reviewed_by = options.reviewedBy || null;
    updates.reviewed_at = options.reviewedAt || now;
    updates.rejection_reason = options.rejectionReason || null;
  } else if (destination === 'review') {
    updates.status = 'review';
    if (options.modifyNote) {
      updates.modify_note = options.modifyNote;
      updates.modified_at = now;
    }
  } else if (destination === 'inbox') {
    updates.status = 'inbox';
    updates.reopen_reason = options.reopenReason || null;
    updates.reopened_at = now;
    updates.reviewed_by = null;
    updates.reviewed_at = null;
    updates.rejection_reason = null;
  } else if (destination === 'conflicts') {
    updates.status = 'conflict';
    updates.conflict_location = options.conflictLocation || null;
  } else if (destination === 'resolved') {
    updates.status = 'resolved';
    updates.resolved_at = formatDate();
    updates.resolved_by = options.resolvedBy || null;
    updates.resolution = options.resolution || null;
  }
  updateFrontmatterFile(proposalPath, updates);
  const destinationPath = repoWikiPath(repoRoot, `changes/${destination}/${path.basename(proposalPath)}`);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (proposalPath !== destinationPath) {
    fs.renameSync(proposalPath, destinationPath);
  }
  syncRuntimeFiles(repoRoot, [proposalPath, destinationPath]);
  return destinationPath;
}

function decayConfidence(repoRoot, options = {}) {
  const changed = [];
  for (const pageFile of listMarkdownFiles(repoWikiPath(repoRoot, 'canon/domains'))) {
    if (path.basename(pageFile) === '_index.md') {
      continue;
    }
    const { frontmatter } = parseFrontmatterFile(pageFile);
    const status = frontmatter.status || 'active';
    const confidence = frontmatter.confidence || '';
    if (status === 'archived' || !confidence || confidence === 'low') {
      continue;
    }
    let staleness = Number.parseInt(frontmatter.staleness_days || 0, 10) || 0;
    if (frontmatter.last_updated) {
      const updatedDate = new Date(frontmatter.last_updated);
      if (!Number.isNaN(updatedDate.getTime())) {
        staleness = Math.max(0, Math.floor((Date.now() - updatedDate.getTime()) / 86400000));
      }
    }

    let nextConfidence = '';
    if (confidence === 'high' && staleness > 90) {
      nextConfidence = 'medium';
    } else if (confidence === 'medium' && staleness > 180) {
      nextConfidence = 'low';
    }
    if (!nextConfidence) {
      continue;
    }
    changed.push({ path: pageFile, from: confidence, to: nextConfidence, staleness });
    if (!options.dryRun) {
      updateFrontmatterFile(pageFile, { confidence: nextConfidence });
      syncRuntimeFiles(repoRoot, [pageFile]);
    }
  }
  return changed;
}

function validateWikiFile(repoRoot, fileInput, explicitSchema = '') {
  const filePath = resolveInternalFile(repoRoot, fileInput);
  const { frontmatter } = parseFrontmatterFile(filePath);
  const schema = explicitSchema || frontmatter.type || '';
  const errors = [];
  const requireField = (field) => {
    const value = frontmatter[field];
    if (value === null || value === undefined || value === '') {
      errors.push(`MISSING: ${field}`);
    }
  };
  const requireEnum = (field, allowed) => {
    const value = frontmatter[field];
    if (value !== null && value !== undefined && value !== '' && !allowed.includes(value)) {
      errors.push(`INVALID: ${field}=${value} (expected: ${allowed.join(',')})`);
    }
  };

  switch (schema) {
    case 'source':
      ['type', 'source_kind', 'title', 'ingested_at', 'extracted'].forEach(requireField);
      requireEnum('source_kind', ['article', 'conversation', 'note', 'reference']);
      break;
    case 'change-proposal':
      ['type', 'action', 'status', 'target_page', 'trigger_source', 'confidence', 'proposed_at'].forEach(requireField);
      requireEnum('action', ['create', 'update', 'merge', 'split', 'archive']);
      requireEnum('status', ['inbox', 'review', 'approved', 'rejected', 'conflict', 'resolved', 'deferred']);
      requireEnum('confidence', ['high', 'medium', 'low']);
      break;
    case 'concept':
    case 'entity':
    case 'comparison':
    case 'guide':
    case 'decision':
      ['type', 'title', 'domain', 'confidence', 'last_compiled', 'status'].forEach(requireField);
      requireEnum('confidence', ['high', 'medium', 'low']);
      requireEnum('status', ['active', 'archived', 'draft']);
      if (!Array.isArray(frontmatter.sources) || frontmatter.sources.length === 0) {
        errors.push('MISSING: sources (list is empty)');
      }
      break;
    case 'index':
      ['type', 'domain'].forEach(requireField);
      break;
    default:
      errors.push(`UNKNOWN_SCHEMA: cannot validate type=${schema}`);
      break;
  }

  return { valid: errors.length === 0, errors };
}

function consecutiveApproveCount(repoRoot) {
  const db = openRuntimeIndex(repoRoot);
  const rows = db.prepare("SELECT decision FROM reviews ORDER BY reviewed_at DESC").all();
  let count = 0;
  for (const row of rows) {
    if (row.decision === 'rejected') {
      break;
    }
    if (row.decision === 'approved') {
      count += 1;
    }
  }
  return count;
}

function renderFindings(findings) {
  if (!findings.length) {
    return '未发现问题。\n\n==============================\n通过检查: 0 / 0\n健康分数: 100%\n==============================';
  }
  const groups = { error: [], warning: [], info: [] };
  for (const finding of findings) {
    groups[finding.severity].push(finding);
  }
  const lines = ['========== WIKI LINT REPORT (structural) ==========', `运行时间: ${formatTimestamp()}`, ''];
  for (const severity of ['error', 'warning', 'info']) {
    if (!groups[severity].length) {
      continue;
    }
    lines.push(`---------- ${severity.toUpperCase()} ----------`);
    for (const item of groups[severity]) {
      lines.push(`[${severity.toUpperCase()}] ${item.ruleId} ${item.targetPath} — ${item.message}`);
    }
    lines.push('');
  }
  const score = Math.max(0, 100 - findings.filter((item) => item.severity !== 'info').length * 3);
  lines.push('==============================');
  lines.push(`通过检查: ${Math.max(0, 100 - findings.length)} / 100`);
  lines.push(`健康分数: ${score}%`);
  lines.push('==============================');
  return lines.join('\n');
}

function importWorkflow(repoRoot, payload) {
  if (!payload || !payload.source || !payload.proposal) {
    throw new Error('import: payload must include source and proposal');
  }
  const extractedClaims = Array.isArray(payload.source.extracted_claims)
    ? payload.source.extracted_claims.filter(Boolean)
    : [];
  const dedup = dedupCheck(repoRoot, payload.proposal.target_page || '');
  const sourcePath = createSource(repoRoot, {
    kind: payload.source.kind,
    title: payload.source.title,
    url: payload.source.url,
    author: payload.source.author,
    publishedAt: payload.source.published_at,
    domain: payload.source.domain,
    tags: payload.source.tags,
    body: payload.source.body,
    bodyFile: payload.source.body_file,
    extracted: payload.source.extracted,
    ingestedAt: payload.source.ingested_at,
  });
  const proposalPath = dedup.duplicate
    ? null
    : createProposal(repoRoot, {
        action: payload.proposal.action,
        status: payload.proposal.status,
        targetPage: payload.proposal.target_page,
        targetType: payload.proposal.target_type,
        triggerSource: payload.proposal.trigger_source || wikiRelative(repoRoot, sourcePath),
        confidence: payload.proposal.confidence,
        origin: payload.proposal.origin,
        autoQualityScore: payload.proposal.auto_quality_score,
        body: payload.proposal.body,
        bodyFile: payload.proposal.body_file,
        proposedAt: payload.proposal.proposed_at,
      });
  if (extractedClaims.length) {
    appendSourceClaims(repoRoot, sourcePath, extractedClaims);
    markExtracted(repoRoot, sourcePath);
  } else if (payload.source.extracted) {
    markExtracted(repoRoot, sourcePath);
  }
  if (dedup.duplicate) {
    const evidenceLines = [];
    const sourceRel = wikiRelative(repoRoot, sourcePath);
    evidenceLines.push(`### 补充证据（来自 ${sourceRel}）`);
    evidenceLines.push('');
    if (payload.source.title) {
      evidenceLines.push(`- 标题: ${payload.source.title}`);
    }
    if (extractedClaims.length) {
      extractedClaims.forEach((claim) => evidenceLines.push(`- ${claim}`));
    } else if (payload.proposal.body) {
      evidenceLines.push(`- 补充说明: ${String(payload.proposal.body).split('\n').filter(Boolean).join(' ')}`);
    }
    mergeProposalEvidence(repoRoot, dedup.path, evidenceLines.join('\n'));
  }
  appendLog(
    repoRoot,
    'changes',
    'import',
    `source: ${wikiRelative(repoRoot, sourcePath)} | proposal: ${proposalPath ? wikiRelative(repoRoot, proposalPath) : 'dedup-hit'}`
  );
  updateState(repoRoot);
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'workflow.import', 'ok', {
    source: wikiRelative(repoRoot, sourcePath),
    proposal: proposalPath ? wikiRelative(repoRoot, proposalPath) : null,
    duplicate: dedup.duplicate,
  });
  return {
    source: wikiRelative(repoRoot, sourcePath),
    proposal: proposalPath ? wikiRelative(repoRoot, proposalPath) : null,
    duplicate: dedup,
  };
}

function askWorkflow(repoRoot, query, limit = 5) {
  const result = searchRuntimeIndex(repoRoot, query, limit);
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'workflow.ask', 'ok', { query, limit });
  return result;
}

function maintainWorkflow(repoRoot, options = {}) {
  const counts = countThings(repoRoot, 'all');
  const findings = computeCheckFindings(repoRoot);
  const decays = options.applyDecay ? decayConfidence(repoRoot) : [];
  updateState(repoRoot, options.applyDecay ? { last_lint: formatDate() } : {});
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'workflow.maintain', 'ok', {
    findings: findings.length,
    decays: decays.length,
  });
  return { counts, findings, decays };
}

function runInternalCommand(repoRoot, args) {
  const subcommand = args[0];
  if (!subcommand) {
    throw new Error('internal: missing subcommand');
  }
  switch (subcommand) {
    case 'create-source': {
      const options = {};
      for (let index = 1; index < args.length; index += 1) {
        const token = args[index];
        const value = args[index + 1];
        switch (token) {
          case '--kind':
            options.kind = value;
            index += 1;
            break;
          case '--title':
            options.title = value;
            index += 1;
            break;
          case '--url':
            options.url = value;
            index += 1;
            break;
          case '--author':
            options.author = value;
            index += 1;
            break;
          case '--published-at':
            options.publishedAt = value;
            index += 1;
            break;
          case '--domain':
            options.domain = value;
            index += 1;
            break;
          case '--tags':
            options.tags = value;
            index += 1;
            break;
          case '--body-file':
            options.bodyFile = value;
            index += 1;
            break;
          default:
            throw new Error(`create-source: unknown option: ${token}`);
        }
      }
      return createSource(repoRoot, options);
    }
    case 'create-proposal': {
      const options = {};
      for (let index = 1; index < args.length; index += 1) {
        const token = args[index];
        const value = args[index + 1];
        switch (token) {
          case '--action':
            options.action = value;
            index += 1;
            break;
          case '--status':
            options.status = value;
            index += 1;
            break;
          case '--target-page':
            options.targetPage = value;
            index += 1;
            break;
          case '--target-type':
            options.targetType = value;
            index += 1;
            break;
          case '--trigger-source':
            options.triggerSource = value;
            index += 1;
            break;
          case '--confidence':
            options.confidence = value;
            index += 1;
            break;
          case '--origin':
            options.origin = value;
            index += 1;
            break;
          case '--auto-quality-score':
            options.autoQualityScore = value;
            index += 1;
            break;
          case '--body-file':
            options.bodyFile = value;
            index += 1;
            break;
          case '--proposed-at':
            options.proposedAt = value;
            index += 1;
            break;
          default:
            throw new Error(`create-proposal: unknown option: ${token}`);
        }
      }
      return createProposal(repoRoot, options);
    }
    case 'create-canon': {
      const options = {};
      for (let index = 1; index < args.length; index += 1) {
        const token = args[index];
        const value = args[index + 1];
        switch (token) {
          case '--target-page':
            options.targetPage = value;
            index += 1;
            break;
          case '--type':
            options.type = value;
            index += 1;
            break;
          case '--title':
            options.title = value;
            index += 1;
            break;
          case '--sources':
            options.sources = value;
            index += 1;
            break;
          case '--confidence':
            options.confidence = value;
            index += 1;
            break;
          case '--body-file':
            options.bodyFile = value;
            index += 1;
            break;
          default:
            throw new Error(`create-canon: unknown option: ${token}`);
        }
      }
      return createCanon(repoRoot, options);
    }
    case 'mark-extracted':
      return markExtracted(repoRoot, args[1]);
    case 'mark-compiled':
      return markCompiled(repoRoot, args[1]);
    case 'move-proposal': {
      const proposalPath = args[1];
      const options = {};
      let destination = '';
      for (let index = 2; index < args.length; index += 1) {
        const token = args[index];
        const value = args[index + 1];
        switch (token) {
          case '--to':
            destination = value;
            index += 1;
            break;
          case '--reviewed-by':
            options.reviewedBy = value;
            index += 1;
            break;
          case '--reviewed-at':
            options.reviewedAt = value;
            index += 1;
            break;
          case '--approve-note':
            options.approveNote = value;
            index += 1;
            break;
          case '--rejection-reason':
            options.rejectionReason = value;
            index += 1;
            break;
          case '--conflict-location':
            options.conflictLocation = value;
            index += 1;
            break;
          case '--resolved-by':
            options.resolvedBy = value;
            index += 1;
            break;
          case '--resolution':
            options.resolution = value;
            index += 1;
            break;
          case '--reopen-reason':
            options.reopenReason = value;
            index += 1;
            break;
          case '--modify-note':
            options.modifyNote = value;
            index += 1;
            break;
          default:
            throw new Error(`move-proposal: unknown option: ${token}`);
        }
      }
      return moveProposal(repoRoot, proposalPath, destination, options);
    }
    case 'append-source-claims': {
      const sourcePath = args[1];
      const claims = [];
      for (let index = 2; index < args.length; index += 1) {
        if (args[index] === '--claim') {
          claims.push(args[index + 1] || '');
          index += 1;
          continue;
        }
        throw new Error(`append-source-claims: unknown option: ${args[index]}`);
      }
      return appendSourceClaims(repoRoot, sourcePath, claims);
    }
    case 'append-maintenance-record': {
      const pagePath = args[1];
      const recordIndex = args.indexOf('--record');
      return appendPageMaintenanceRecord(repoRoot, pagePath, recordIndex >= 0 ? args[recordIndex + 1] : '');
    }
    case 'merge-proposal-evidence': {
      const proposalPath = args[1];
      const evidenceIndex = args.indexOf('--evidence');
      return mergeProposalEvidence(repoRoot, proposalPath, evidenceIndex >= 0 ? args[evidenceIndex + 1] : '');
    }
    case 'frontmatter':
      if (args[1] === 'get') {
        return getFrontmatterValue(repoRoot, args[2], args[3]);
      }
      if (args[1] === 'set') {
        return setFrontmatterValue(repoRoot, args[2], args[3], args[4]);
      }
      if (args[1] === 'get-list') {
        return getFrontmatterList(repoRoot, args[2], args[3]).join('\n');
      }
      throw new Error('frontmatter: requires get|set|get-list');
    case 'update-index': {
      const options = {};
      for (let index = 1; index < args.length; index += 1) {
        const token = args[index];
        const value = args[index + 1];
        switch (token) {
          case '--domain':
            options.domain = value;
            index += 1;
            break;
          case '--add':
            options.add = value;
            index += 1;
            break;
          case '--remove':
            options.remove = value;
            index += 1;
            break;
          case '--sync':
            options.sync = true;
            break;
          default:
            throw new Error(`update-index: unknown option: ${token}`);
        }
      }
      updateDomainIndex(repoRoot, options);
      return options.sync ? 'synced' : options.remove ? 'removed' : 'added';
    }
    case 'update-state':
      return Object.entries(updateState(repoRoot))
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value ?? '~'}`)
        .join('\n');
    case 'append-log': {
      const options = {};
      for (let index = 1; index < args.length; index += 1) {
        const token = args[index];
        const value = args[index + 1];
        switch (token) {
          case '--to':
            options.to = value;
            index += 1;
            break;
          case '--spec':
            options.spec = value;
            index += 1;
            break;
          case '--message':
            options.message = value;
            index += 1;
            break;
          case '--fields':
            options.fields = value;
            index += 1;
            break;
          default:
            throw new Error(`append-log: unknown option: ${token}`);
        }
      }
      appendLog(
        repoRoot,
        options.to,
        options.spec,
        options.message,
        (options.fields || '').split('|').filter(Boolean)
      );
      return 'ok';
    }
    case 'scan': {
      const json = args.includes('--format') && args[args.indexOf('--format') + 1] === 'json';
      const findings = computeCheckFindings(repoRoot);
      const score = findings.length === 0 ? 100 : Math.max(0, 100 - findings.filter((item) => item.severity !== 'info').length * 3);
      return json ? JSON.stringify({ findings, health_score: score }, null, 2) : renderFindings(findings);
    }
    case 'decay': {
      const dryRun = args.includes('--dry-run');
      const changes = decayConfidence(repoRoot, { dryRun });
      return `${dryRun ? 'dry_run_' : ''}decayed_count=${changes.length}`;
    }
    case 'dedup-check': {
      const targetPage = args[args.indexOf('--target-page') + 1];
      const dedup = dedupCheck(repoRoot, targetPage);
      return dedup.duplicate ? `duplicate:${repoWikiPath(repoRoot, dedup.path)}` : 'unique';
    }
    case 'resolve-conflict':
      return resolveConflict(
        repoRoot,
        args[args.indexOf('--canon-path') + 1],
        args[args.indexOf('--content-file') + 1]
      );
    case 'apply-merged-content': {
      const pagePath = args[1];
      const contentIndex = args.indexOf('--content');
      const mergedFileIndex = args.indexOf('--merged-file');
      const sectionIndex = args.indexOf('--section');
      return applyMergedContent(repoRoot, pagePath, contentIndex >= 0 ? args[contentIndex + 1] : '', {
        mergedFile: mergedFileIndex >= 0 ? args[mergedFileIndex + 1] : '',
        section: sectionIndex >= 0 ? args[sectionIndex + 1] : '',
      });
    }
    case 'count': {
      const target = args[1] || 'all';
      const value = countThings(repoRoot, target);
      if (typeof value === 'object') {
        return Object.entries(value).map(([key, count]) => `${key}=${count}`).join('\n');
      }
      return String(value);
    }
    case 'validate': {
      const filePath = args.find((item, index) => index > 0 && !item.startsWith('--') && args[index - 1] !== '--schema');
      const schemaIndex = args.indexOf('--schema');
      const schema = schemaIndex >= 0 ? args[schemaIndex + 1] : '';
      const result = validateWikiFile(repoRoot, filePath, schema);
      return result.valid ? 'VALID' : `INVALID\n${result.errors.join('\n')}`;
    }
    case 'consecutive-approve-count':
      return String(consecutiveApproveCount(repoRoot));
    default:
      throw new Error(`unknown internal subcommand: ${subcommand}`);
  }
}

module.exports = {
  askWorkflow,
  consecutiveApproveCount,
  countThings,
  createCanon,
  createProposal,
  createSource,
  decayConfidence,
  dedupCheck,
  importWorkflow,
  maintainWorkflow,
  markCompiled,
  markExtracted,
  moveProposal,
  resolveConflict,
  runInternalCommand,
  setFrontmatterValue,
  updateDomainIndex,
  validateWikiFile,
};
