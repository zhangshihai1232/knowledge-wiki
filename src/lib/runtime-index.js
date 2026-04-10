'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { parseFrontmatterFile } = require('./frontmatter');
const { buildQueryHints } = require('./taxonomy');
const { normalizePath, listMarkdownFiles } = require('./utils');

function wikiRelative(repoRoot, absolutePath) {
  return normalizePath(path.relative(path.join(repoRoot, '.wiki'), absolutePath));
}

function getRuntimeDir(repoRoot) {
  return path.join(repoRoot, '.wiki', 'runtime');
}

function getDatabasePath(repoRoot) {
  return path.join(getRuntimeDir(repoRoot), 'index.sqlite');
}

function ensureTableColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function parseTags(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function ensureDatabase(repoRoot) {
  fs.mkdirSync(getRuntimeDir(repoRoot), { recursive: true });
  const db = new DatabaseSync(getDatabasePath(repoRoot));
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS pages (
      path TEXT PRIMARY KEY,
      title TEXT,
      domain TEXT,
      category TEXT,
      slug TEXT,
      primary_type TEXT,
      subtype TEXT,
      tags_json TEXT,
      status TEXT,
      confidence TEXT,
      last_updated TEXT,
      last_compiled TEXT,
      staleness_days INTEGER,
      source_count INTEGER,
      content TEXT,
      meta_json TEXT
    );
    CREATE TABLE IF NOT EXISTS sources (
      path TEXT PRIMARY KEY,
      title TEXT,
      source_kind TEXT,
      domain TEXT,
      primary_type TEXT,
      subtype TEXT,
      tags_json TEXT,
      authority TEXT,
      ingested_at TEXT,
      extracted TEXT,
      content TEXT,
      meta_json TEXT
    );
    CREATE TABLE IF NOT EXISTS proposals (
      path TEXT PRIMARY KEY,
      status TEXT,
      action TEXT,
      target_page TEXT,
      domain TEXT,
      primary_type TEXT,
      subtype TEXT,
      tags_json TEXT,
      origin TEXT,
      trigger_source TEXT,
      proposed_at TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT,
      compiled TEXT,
      conflict_location TEXT,
      content TEXT,
      meta_json TEXT
    );
    CREATE TABLE IF NOT EXISTS links (
      source_path TEXT,
      target_slug TEXT,
      PRIMARY KEY (source_path, target_slug)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      proposal_path TEXT PRIMARY KEY,
      decision TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS lint_findings (
      rule_id TEXT,
      severity TEXT,
      target_path TEXT,
      message TEXT
    );
    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      command TEXT,
      result TEXT,
      details TEXT,
      created_at TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS page_fts USING fts5(path, title, content);
    CREATE VIRTUAL TABLE IF NOT EXISTS proposal_fts USING fts5(path, target_page, content);
  `);
  ensureTableColumn(db, 'pages', 'primary_type', 'TEXT');
  ensureTableColumn(db, 'pages', 'subtype', 'TEXT');
  ensureTableColumn(db, 'pages', 'tags_json', 'TEXT');
  ensureTableColumn(db, 'sources', 'primary_type', 'TEXT');
  ensureTableColumn(db, 'sources', 'subtype', 'TEXT');
  ensureTableColumn(db, 'sources', 'tags_json', 'TEXT');
  ensureTableColumn(db, 'proposals', 'domain', 'TEXT');
  ensureTableColumn(db, 'proposals', 'primary_type', 'TEXT');
  ensureTableColumn(db, 'proposals', 'subtype', 'TEXT');
  ensureTableColumn(db, 'proposals', 'tags_json', 'TEXT');
  return db;
}

function hasRuntimeIndexData(db) {
  const counts = db
    .prepare('SELECT (SELECT COUNT(*) FROM pages) + (SELECT COUNT(*) FROM sources) + (SELECT COUNT(*) FROM proposals) AS total')
    .get();
  return counts.total > 0;
}

function resetRuntimeIndex(db) {
  db.exec(`
    DELETE FROM pages;
    DELETE FROM sources;
    DELETE FROM proposals;
    DELETE FROM links;
    DELETE FROM reviews;
    DELETE FROM lint_findings;
    DELETE FROM page_fts;
    DELETE FROM proposal_fts;
  `);
}

function recordOperation(db, command, result, details) {
  const timestamp = new Date().toISOString();
  const operationId = `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  db.prepare(
    'INSERT INTO operations (id, command, result, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(operationId, command, result, JSON.stringify(details || {}), timestamp);
}

function deleteIndexedPath(db, relPath) {
  if (relPath.startsWith('canon/domains/')) {
    db.prepare('DELETE FROM links WHERE source_path = ?').run(relPath);
    db.prepare('DELETE FROM page_fts WHERE path = ?').run(relPath);
    db.prepare('DELETE FROM pages WHERE path = ?').run(relPath);
    return;
  }
  if (relPath.startsWith('sources/')) {
    db.prepare('DELETE FROM sources WHERE path = ?').run(relPath);
    return;
  }
  if (relPath.startsWith('changes/')) {
    db.prepare('DELETE FROM proposal_fts WHERE path = ?').run(relPath);
    db.prepare('DELETE FROM reviews WHERE proposal_path = ?').run(relPath);
    db.prepare('DELETE FROM proposals WHERE path = ?').run(relPath);
  }
}

function upsertPageFile(db, repoRoot, filePath) {
  if (path.basename(filePath) === '_index.md') {
    return;
  }

  const relPath = wikiRelative(repoRoot, filePath);
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  const withoutPrefix = relPath.replace(/^canon\/domains\//, '').replace(/\.md$/, '');
  const parts = withoutPrefix.split('/');
  const domain = parts[0] || '';
  const category = parts.length > 2 ? parts.slice(1, -1).join('/') : parts[1] || '';
  const slug = parts[parts.length - 1] || '';
  const sources = Array.isArray(frontmatter.sources) ? frontmatter.sources : [];
  const crossRefs = Array.isArray(frontmatter.cross_refs) ? frontmatter.cross_refs : [];
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const primaryType = frontmatter.primary_type || frontmatter.type || '';
  const subtype = frontmatter.subtype || '';

  deleteIndexedPath(db, relPath);
  db.prepare(`
    INSERT INTO pages (
      path, title, domain, category, slug, primary_type, subtype, tags_json, status, confidence, last_updated,
      last_compiled, staleness_days, source_count, content, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    relPath,
    frontmatter.title || '',
    domain,
    category,
    slug,
    primaryType,
    subtype,
    JSON.stringify(tags),
    frontmatter.status || 'active',
    frontmatter.confidence || '',
    frontmatter.last_updated || '',
    frontmatter.last_compiled || '',
    Number.parseInt(frontmatter.staleness_days || 0, 10) || 0,
    sources.length,
    body,
    JSON.stringify(frontmatter)
  );
  db.prepare('INSERT INTO page_fts (path, title, content) VALUES (?, ?, ?)').run(relPath, frontmatter.title || '', body);
  const insertLink = db.prepare('INSERT OR IGNORE INTO links (source_path, target_slug) VALUES (?, ?)');
  for (const ref of crossRefs) {
    insertLink.run(relPath, String(ref));
  }
}

function upsertSourceFile(db, repoRoot, filePath) {
  const relPath = wikiRelative(repoRoot, filePath);
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  deleteIndexedPath(db, relPath);
  db.prepare(`
    INSERT INTO sources (
      path, title, source_kind, domain, primary_type, subtype, tags_json, authority, ingested_at, extracted, content, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    relPath,
    frontmatter.title || '',
    frontmatter.source_kind || '',
    frontmatter.domain || '',
    frontmatter.primary_type || 'source',
    frontmatter.subtype || '',
    JSON.stringify(tags),
    frontmatter.authority || '',
    frontmatter.ingested_at || '',
    String(frontmatter.extracted ?? ''),
    body,
    JSON.stringify(frontmatter)
  );
}

function upsertProposalFile(db, repoRoot, filePath) {
  const relPath = wikiRelative(repoRoot, filePath);
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  const targetPage = frontmatter.target_page || '';
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  deleteIndexedPath(db, relPath);
  db.prepare(`
    INSERT INTO proposals (
      path, status, action, target_page, domain, primary_type, subtype, tags_json, origin, trigger_source, proposed_at, reviewed_at,
      reviewed_by, compiled, conflict_location, content, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    relPath,
    frontmatter.status || path.basename(path.dirname(filePath)),
    frontmatter.action || '',
    targetPage,
    frontmatter.domain || targetPage.split('/').filter(Boolean)[0] || '',
    frontmatter.primary_type || frontmatter.target_type || '',
    frontmatter.subtype || '',
    JSON.stringify(tags),
    frontmatter.origin || '',
    frontmatter.trigger_source || '',
    frontmatter.proposed_at || '',
    frontmatter.reviewed_at || '',
    frontmatter.reviewed_by || '',
    String(frontmatter.compiled ?? ''),
    frontmatter.conflict_location || '',
    body,
    JSON.stringify(frontmatter)
  );
  db.prepare('INSERT INTO proposal_fts (path, target_page, content) VALUES (?, ?, ?)').run(
    relPath,
    frontmatter.target_page || '',
    body
  );

  if (frontmatter.reviewed_at && (frontmatter.status === 'approved' || frontmatter.status === 'rejected')) {
    db.prepare(
      'INSERT OR REPLACE INTO reviews (proposal_path, decision, reviewed_by, reviewed_at, note) VALUES (?, ?, ?, ?, ?)'
    ).run(
      relPath,
      frontmatter.status,
      frontmatter.reviewed_by || '',
      frontmatter.reviewed_at || '',
      frontmatter.approve_note || frontmatter.rejection_reason || ''
    );
  }
}

function syncRuntimeFiles(repoRoot, filePaths) {
  const db = openRuntimeIndex(repoRoot);
  for (const entry of filePaths) {
    const filePath = path.isAbsolute(entry) ? entry : path.join(repoRoot, '.wiki', entry.replace(/^\.wiki\//, ''));
    const relPath = path.isAbsolute(entry) ? wikiRelative(repoRoot, filePath) : entry.replace(/^\.wiki\//, '');
    if (!relPath.endsWith('.md')) {
      continue;
    }
    if (!fs.existsSync(filePath)) {
      deleteIndexedPath(db, relPath);
      continue;
    }
    if (relPath.startsWith('canon/domains/')) {
      upsertPageFile(db, repoRoot, filePath);
    } else if (relPath.startsWith('sources/')) {
      upsertSourceFile(db, repoRoot, filePath);
    } else if (relPath.startsWith('changes/')) {
      upsertProposalFile(db, repoRoot, filePath);
    }
  }
  return db;
}

function rebuildRuntimeIndex(repoRoot) {
  const db = ensureDatabase(repoRoot);
  resetRuntimeIndex(db);

  for (const filePath of listMarkdownFiles(path.join(repoRoot, '.wiki', 'canon', 'domains'))) {
    upsertPageFile(db, repoRoot, filePath);
  }

  for (const filePath of listMarkdownFiles(path.join(repoRoot, '.wiki', 'sources'))) {
    upsertSourceFile(db, repoRoot, filePath);
  }

  const proposalStages = ['inbox', 'review', 'approved', 'rejected', 'conflicts', 'resolved'];
  for (const stage of proposalStages) {
    for (const filePath of listMarkdownFiles(path.join(repoRoot, '.wiki', 'changes', stage))) {
      const relPath = wikiRelative(repoRoot, filePath);
      upsertProposalFile(db, repoRoot, filePath);
    }
  }

  return db;
}

function openRuntimeIndex(repoRoot) {
  const dbPath = getDatabasePath(repoRoot);
  const needsRebuild = !fs.existsSync(dbPath);
  const db = ensureDatabase(repoRoot);
  if (needsRebuild || !hasRuntimeIndexData(db)) {
    return rebuildRuntimeIndex(repoRoot);
  }
  return db;
}

function escapeLike(value) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function tokenizeQuery(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return Array.from(new Set(normalized.split(/[\s/_.-]+/).map((item) => item.trim()).filter(Boolean)));
}

function countMatchedTokens(text, tokens) {
  const lowered = String(text || '').toLowerCase();
  return tokens.filter((token) => lowered.includes(token)).length;
}

function makeExcerpt(text, query, tokens) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) {
    return '';
  }
  const lowered = source.toLowerCase();
  const needles = [query.trim().toLowerCase(), ...tokens].filter(Boolean);
  let index = -1;
  for (const needle of needles) {
    index = lowered.indexOf(needle);
    if (index >= 0) {
      break;
    }
  }
  if (index < 0) {
    return source.slice(0, 180);
  }
  const start = Math.max(0, index - 48);
  const end = Math.min(source.length, index + 132);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function includesHint(hints, value) {
  return Boolean(value) && Array.isArray(hints) && hints.includes(String(value));
}

function filterRowsWithFallback(rows, predicate) {
  const filtered = rows.filter(predicate);
  return filtered.length ? filtered : rows;
}

function applyFieldFilters(rows, hints, options = {}) {
  let filtered = rows;
  if (hints.domain_hints.length) {
    filtered = filterRowsWithFallback(filtered, (row) => hints.domain_hints.includes(String(row.domain || '')));
  }
  if (options.usePrimaryType && hints.primary_type_hints.length) {
    filtered = filterRowsWithFallback(filtered, (row) => hints.primary_type_hints.includes(String(row.primary_type || '')));
  }
  if (options.useSubtype && hints.subtype_hints.length) {
    filtered = filterRowsWithFallback(filtered, (row) => hints.subtype_hints.includes(String(row.subtype || '')));
  }
  return filtered;
}

function rankPageRow(row, query, tokens, hints) {
  const title = String(row.title || '').toLowerCase();
  const pathValue = String(row.path || '').toLowerCase();
  const slug = String(row.slug || '').toLowerCase();
  const content = String(row.content || '').toLowerCase();
  const classification = `${row.primary_type || ''} ${row.subtype || ''} ${parseTags(row.tags_json).join(' ')}`.toLowerCase();
  let score = 0;
  if (title === query || slug === query) {
    score += 160;
  }
  if (pathValue === query) {
    score += 140;
  }
  if (title.includes(query)) {
    score += 70;
  }
  if (slug.includes(query) || pathValue.includes(query)) {
    score += 56;
  }
  if (content.includes(query)) {
    score += 18;
  }
  score += countMatchedTokens(title, tokens) * 18;
  score += countMatchedTokens(`${slug} ${pathValue}`, tokens) * 12;
  score += countMatchedTokens(classification, tokens) * 10;
  score += countMatchedTokens(content, tokens) * 4;
  if (includesHint(hints.domain_hints, row.domain)) {
    score += 28;
  }
  if (includesHint(hints.primary_type_hints, row.primary_type)) {
    score += 26;
  }
  if (includesHint(hints.subtype_hints, row.subtype)) {
    score += 18;
  }
  if (row.confidence === 'high') {
    score += 6;
  } else if (row.confidence === 'medium') {
    score += 3;
  }
  return score;
}

function rankProposalRow(row, query, tokens, hints) {
  const targetPage = String(row.target_page || '').toLowerCase();
  const pathValue = String(row.path || '').toLowerCase();
  const action = String(row.action || '').toLowerCase();
  const content = String(row.content || '').toLowerCase();
  const classification = `${row.domain || ''} ${row.primary_type || ''} ${row.subtype || ''} ${parseTags(row.tags_json).join(' ')}`.toLowerCase();
  let score = 0;
  if (targetPage === query) {
    score += 150;
  }
  if (pathValue === query) {
    score += 135;
  }
  if (targetPage.includes(query)) {
    score += 74;
  }
  if (pathValue.includes(query)) {
    score += 42;
  }
  if (action && action === query) {
    score += 24;
  }
  if (content.includes(query)) {
    score += 18;
  }
  score += countMatchedTokens(`${targetPage} ${pathValue}`, tokens) * 16;
  score += countMatchedTokens(action, tokens) * 8;
  score += countMatchedTokens(classification, tokens) * 10;
  score += countMatchedTokens(content, tokens) * 4;
  if (includesHint(hints.domain_hints, row.domain)) {
    score += 22;
  }
  if (includesHint(hints.primary_type_hints, row.primary_type)) {
    score += 22;
  }
  if (includesHint(hints.subtype_hints, row.subtype)) {
    score += 14;
  }
  if (row.status === 'inbox') {
    score += 8;
  } else if (row.status === 'review') {
    score += 5;
  }
  if (hints.focus === 'proposal') {
    score += 12;
  }
  return score;
}

function rankSourceRow(row, query, tokens, hints) {
  const title = String(row.title || '').toLowerCase();
  const pathValue = String(row.path || '').toLowerCase();
  const sourceKind = String(row.source_kind || '').toLowerCase();
  const content = String(row.content || '').toLowerCase();
  const classification = `${row.domain || ''} ${row.primary_type || ''} ${row.subtype || ''} ${parseTags(row.tags_json).join(' ')}`.toLowerCase();
  let score = 0;
  if (title === query) {
    score += 150;
  }
  if (pathValue === query) {
    score += 130;
  }
  if (title.includes(query)) {
    score += 68;
  }
  if (pathValue.includes(query)) {
    score += 44;
  }
  if (content.includes(query)) {
    score += 20;
  }
  score += countMatchedTokens(title, tokens) * 17;
  score += countMatchedTokens(`${pathValue} ${sourceKind}`, tokens) * 8;
  score += countMatchedTokens(classification, tokens) * 8;
  score += countMatchedTokens(content, tokens) * 4;
  if (includesHint(hints.domain_hints, row.domain)) {
    score += 22;
  }
  if (includesHint(hints.primary_type_hints, row.primary_type)) {
    score += 16;
  }
  if (includesHint(hints.subtype_hints, row.subtype)) {
    score += 14;
  }
  if (String(row.extracted) === 'true') {
    score += 2;
  }
  if (hints.focus === 'evidence') {
    score += 16;
  }
  return score;
}

function takeTopMatches(rows, rankFn, mapFn, query, tokens, hints, limit) {
  return rows
    .map((row) => ({ row, score: rankFn(row, query, tokens, hints) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.row.path).localeCompare(String(right.row.path)))
    .slice(0, limit)
    .map((entry) => mapFn(entry.row, entry.score));
}

function searchRuntimeIndex(repoRoot, query, limit = 5) {
  const db = openRuntimeIndex(repoRoot);
  const normalizedQuery = query.trim();
  const pageCandidates = db
    .prepare(
      `SELECT path, title, domain, confidence, slug, primary_type, subtype, tags_json, content
       FROM pages
       WHERE status != 'archived'
       ORDER BY path ASC`
    )
    .all();
  const proposalCandidates = db
    .prepare(
      `SELECT path, status, action, target_page, domain, primary_type, subtype, tags_json, content
       FROM proposals
       ORDER BY proposed_at DESC, path ASC`
    )
    .all();
  const sourceCandidates = db
    .prepare(
      `SELECT path, title, source_kind, domain, primary_type, subtype, tags_json, extracted, content
       FROM sources
       ORDER BY ingested_at DESC, path ASC`
    )
    .all();
  const runtimeDomains = Array.from(new Set([
    ...pageCandidates.map((row) => row.domain),
    ...proposalCandidates.map((row) => row.domain),
    ...sourceCandidates.map((row) => row.domain),
  ].filter(Boolean)));
  const hints = buildQueryHints(repoRoot, normalizedQuery, { runtimeDomains });
  const tokens = hints.tokens.length ? hints.tokens : tokenizeQuery(normalizedQuery);
  const filteredPageCandidates = applyFieldFilters(pageCandidates, hints, { usePrimaryType: true, useSubtype: true });
  const filteredProposalCandidates = applyFieldFilters(proposalCandidates, hints, { usePrimaryType: true, useSubtype: true });
  const filteredSourceCandidates = applyFieldFilters(sourceCandidates, hints, {
    usePrimaryType: hints.primary_type_hints.includes('source'),
    useSubtype: true,
  });

  const pageRows = takeTopMatches(
    filteredPageCandidates,
    rankPageRow,
    (row, score) => ({
      path: row.path,
      title: row.title,
      domain: row.domain,
      confidence: row.confidence,
      primary_type: row.primary_type,
      subtype: row.subtype,
      tags: parseTags(row.tags_json),
      excerpt: makeExcerpt(row.content, normalizedQuery, tokens),
      score,
    }),
    normalizedQuery.toLowerCase(),
    tokens,
    hints,
    limit
  );
  const proposalRows = takeTopMatches(
    filteredProposalCandidates,
    rankProposalRow,
    (row, score) => ({
      path: row.path,
      status: row.status,
      action: row.action,
      target_page: row.target_page,
      domain: row.domain,
      primary_type: row.primary_type,
      subtype: row.subtype,
      tags: parseTags(row.tags_json),
      excerpt: makeExcerpt(row.content, normalizedQuery, tokens),
      score,
    }),
    normalizedQuery.toLowerCase(),
    tokens,
    hints,
    limit
  );
  const sourceRows = takeTopMatches(
    filteredSourceCandidates,
    rankSourceRow,
    (row, score) => ({
      path: row.path,
      title: row.title,
      source_kind: row.source_kind,
      domain: row.domain,
      primary_type: row.primary_type,
      subtype: row.subtype,
      tags: parseTags(row.tags_json),
      excerpt: makeExcerpt(row.content, normalizedQuery, tokens),
      score,
    }),
    normalizedQuery.toLowerCase(),
    tokens,
    hints,
    limit
  );

  return {
    retrieval: {
      query: normalizedQuery,
      tokens,
      limit,
      strategy: 'taxonomy-filter-rank-v1',
      classification: {
        domain_hints: hints.domain_hints,
        primary_type_hints: hints.primary_type_hints,
        subtype_hints: hints.subtype_hints,
        focus: hints.focus,
      },
      candidate_counts: {
        pages: filteredPageCandidates.length,
        proposals: filteredProposalCandidates.length,
        sources: filteredSourceCandidates.length,
      },
    },
    pages: pageRows,
    proposals: proposalRows,
    sources: sourceRows,
  };
}

module.exports = {
  ensureDatabase,
  getDatabasePath,
  getRuntimeDir,
  hasRuntimeIndexData,
  openRuntimeIndex,
  recordOperation,
  resetRuntimeIndex,
  rebuildRuntimeIndex,
  searchRuntimeIndex,
  syncRuntimeFiles,
  wikiRelative,
};
