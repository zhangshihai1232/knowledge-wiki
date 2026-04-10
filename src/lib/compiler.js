'use strict';

const fs = require('fs');
const path = require('path');
const {
  parseFrontmatterFile,
  replaceSection,
  updateFrontmatterFile,
  writeFrontmatterFile,
} = require('./frontmatter');
const { createCanon, updateDomainIndex } = require('./wiki-internal');
const { openRuntimeIndex, recordOperation, syncRuntimeFiles, wikiRelative } = require('./runtime-index');
const { appendLog, findNamedFile, formatDate, updateState } = require('./wiki-repo');

function repoWikiPath(repoRoot, relativePath = '') {
  return path.join(repoRoot, '.wiki', relativePath);
}

function readWikiFile(repoRoot, wikiPath) {
  if (!wikiPath || !wikiPath.startsWith('sources/')) {
    return null;
  }
  const filePath = repoWikiPath(repoRoot, wikiPath);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return parseFrontmatterFile(filePath);
}

function deriveTitle(repoRoot, proposalFrontmatter) {
  const targetPage = proposalFrontmatter.target_page || '';
  const existingPagePath = repoWikiPath(repoRoot, `canon/domains/${targetPage}.md`);
  if (fs.existsSync(existingPagePath)) {
    return parseFrontmatterFile(existingPagePath).frontmatter.title || path.basename(existingPagePath, '.md');
  }
  const sourceFile = readWikiFile(repoRoot, proposalFrontmatter.trigger_source || '');
  if (sourceFile && sourceFile.frontmatter.title) {
    return sourceFile.frontmatter.title;
  }
  const slug = targetPage.split('/').filter(Boolean).pop() || 'untitled';
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item)).filter(Boolean)));
}

function mergeTagLists(...values) {
  return uniqueStrings(values.flatMap((value) => Array.isArray(value) ? value : value ? String(value).split(',').map((item) => item.trim()) : []));
}

function collectSourcePaths(proposalFrontmatter, existingPageFrontmatter = {}) {
  const existingSources = Array.isArray(existingPageFrontmatter.sources) ? existingPageFrontmatter.sources : [];
  const triggerSource = proposalFrontmatter.trigger_source;
  return uniqueStrings([
    ...existingSources,
    triggerSource && triggerSource.startsWith('sources/') ? triggerSource : '',
  ]);
}

function deriveConfidence(repoRoot, sources, existingConfidence = '') {
  if (existingConfidence === 'high') {
    return 'high';
  }
  const authorities = sources
    .map((sourcePath) => readWikiFile(repoRoot, sourcePath))
    .filter(Boolean)
    .map((entry) => String(entry.frontmatter.authority || '').toLowerCase());
  return authorities.includes('authoritative') ? 'medium' : 'low';
}

function extractSubsection(body, heading) {
  const marker = `### ${heading}\n`;
  const start = body.indexOf(marker);
  if (start === -1) {
    return '';
  }
  const remainder = body.slice(start + marker.length);
  const nextHeading = remainder.search(/\n### [^\n]+\n/);
  return (nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)).trim();
}

function isMeaningfulContent(content) {
  return Boolean(content) && !/^无(?:（.*）)?$/m.test(content.trim());
}

function extractCompiledContent(body, action) {
  const preferredHeadings =
    action === 'create'
      ? ['新增内容', '修改内容']
      : action === 'update'
        ? ['修改内容', '新增内容']
        : [];
  for (const heading of preferredHeadings) {
    const content = extractSubsection(body, heading);
    if (isMeaningfulContent(content)) {
      return content;
    }
  }
  return body.trim();
}

function splitTopLevelSections(markdown) {
  const matches = Array.from(markdown.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |\Z)/gm));
  return matches.map((match) => ({
    heading: match[1].trim(),
    content: match[2].trim(),
  }));
}

function extractCrossRefs(body) {
  const refs = [];
  const pattern = /\[\[([^[\]|]+)(?:\|[^[\]]+)?\]\]/g;
  for (const match of body.matchAll(pattern)) {
    refs.push(match[1].trim());
  }
  return uniqueStrings(refs);
}

function updatePageMetadata(repoRoot, pagePath, sources, confidence) {
  const { frontmatter, body } = parseFrontmatterFile(pagePath);
  const updates = {
    sources,
    confidence,
    last_compiled: formatDate(),
    last_updated: formatDate(),
    staleness_days: 0,
    cross_refs: extractCrossRefs(body),
    primary_type: frontmatter.primary_type || frontmatter.type || null,
    subtype: frontmatter.subtype || null,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
  };
  updateFrontmatterFile(pagePath, updates);
  syncRuntimeFiles(repoRoot, [pagePath]);
  return updates;
}

function ensureArchiveBanner(pagePath) {
  const { frontmatter, body } = parseFrontmatterFile(pagePath);
  if (body.startsWith('> 本页已归档')) {
    return;
  }
  const archiveBanner = `> 本页已归档，最后活跃于 ${formatDate()}，如需恢复请更新内容并移除 archived 状态。`;
  writeFrontmatterFile(pagePath, frontmatter, `${archiveBanner}\n\n${body.trim()}\n`);
}

function compileCreate(repoRoot, proposalPath, proposalFrontmatter, compiledContent) {
  const pagePath = repoWikiPath(repoRoot, `canon/domains/${proposalFrontmatter.target_page}.md`);
  if (fs.existsSync(pagePath)) {
    throw new Error(`canon page already exists: ${wikiRelative(repoRoot, pagePath)}`);
  }
  const sources = collectSourcePaths(proposalFrontmatter);
  if (!sources.length) {
    throw new Error('create apply requires a real sources/... trigger_source');
  }
  const sourceFile = readWikiFile(repoRoot, proposalFrontmatter.trigger_source || '');
  const tags = mergeTagLists(
    proposalFrontmatter.tags,
    sourceFile && sourceFile.frontmatter ? sourceFile.frontmatter.tags : []
  );
  createCanon(repoRoot, {
    targetPage: proposalFrontmatter.target_page,
    type: proposalFrontmatter.target_type,
    primaryType: proposalFrontmatter.primary_type || proposalFrontmatter.target_type,
    subtype: proposalFrontmatter.subtype || (sourceFile && sourceFile.frontmatter ? sourceFile.frontmatter.subtype : null),
    title: deriveTitle(repoRoot, proposalFrontmatter),
    sources,
    confidence: deriveConfidence(repoRoot, sources),
    tags,
    body: compiledContent,
  });
  const metadata = updatePageMetadata(repoRoot, pagePath, sources, deriveConfidence(repoRoot, sources));
  return {
    pagePath,
    result: 'success',
    sourcesAdded: sources.length,
    refsUpdated: metadata.cross_refs.length,
    conflicts: 0,
  };
}

function compileUpdate(repoRoot, proposalPath, proposalFrontmatter, compiledContent) {
  const pagePath = repoWikiPath(repoRoot, `canon/domains/${proposalFrontmatter.target_page}.md`);
  if (!fs.existsSync(pagePath)) {
    throw new Error(`canon page not found: ${wikiRelative(repoRoot, pagePath)}`);
  }
  const before = parseFrontmatterFile(pagePath).frontmatter;
  const sourceFile = readWikiFile(repoRoot, proposalFrontmatter.trigger_source || '');
  const sections = splitTopLevelSections(compiledContent);
  if (sections.length > 0) {
    for (const section of sections) {
      replaceSection(pagePath, section.heading, section.content);
    }
  } else if (compiledContent) {
    replaceSection(pagePath, '编译更新', compiledContent);
  }
  updateFrontmatterFile(pagePath, {
    primary_type: proposalFrontmatter.primary_type || before.primary_type || before.type || null,
    subtype: proposalFrontmatter.subtype || before.subtype || (sourceFile && sourceFile.frontmatter ? sourceFile.frontmatter.subtype : null),
    tags: mergeTagLists(before.tags, proposalFrontmatter.tags, sourceFile && sourceFile.frontmatter ? sourceFile.frontmatter.tags : []),
  });
  const sources = collectSourcePaths(proposalFrontmatter, before);
  const confidence = deriveConfidence(repoRoot, sources, before.confidence || '');
  const metadata = updatePageMetadata(repoRoot, pagePath, sources, confidence);
  const beforeSources = Array.isArray(before.sources) ? before.sources : [];
  const beforeRefs = Array.isArray(before.cross_refs) ? before.cross_refs : [];
  return {
    pagePath,
    result: 'success',
    sourcesAdded: sources.filter((sourcePath) => !beforeSources.includes(sourcePath)).length,
    refsUpdated: metadata.cross_refs.filter((ref) => !beforeRefs.includes(ref)).length,
    conflicts: 0,
  };
}

function compileArchive(repoRoot, proposalPath, proposalFrontmatter) {
  const pagePath = repoWikiPath(repoRoot, `canon/domains/${proposalFrontmatter.target_page}.md`);
  if (!fs.existsSync(pagePath)) {
    throw new Error(`canon page not found: ${wikiRelative(repoRoot, pagePath)}`);
  }
  ensureArchiveBanner(pagePath);
  updateFrontmatterFile(pagePath, {
    status: 'archived',
    last_compiled: formatDate(),
    last_updated: formatDate(),
    staleness_days: 0,
  });
  syncRuntimeFiles(repoRoot, [pagePath]);
  return {
    pagePath,
    result: 'success',
    sourcesAdded: 0,
    refsUpdated: 0,
    conflicts: 0,
  };
}

function compileApprovedProposal(repoRoot, proposalInput) {
  const proposalPath = findNamedFile(repoRoot, proposalInput, ['approved']);
  const { frontmatter, body } = parseFrontmatterFile(proposalPath);
  if (frontmatter.compiled === true || frontmatter.compiled === 'true') {
    throw new Error(`proposal already compiled: ${wikiRelative(repoRoot, proposalPath)}`);
  }
  if (frontmatter.origin === 'lint-patrol' || String(frontmatter.target_page || '').startsWith('_system/')) {
    throw new Error('apply only compiles canon proposals; lint-patrol items belong to maintain');
  }
  if (frontmatter.origin === 'query-writeback' && !String(frontmatter.trigger_source || '').startsWith('sources/')) {
    throw new Error('query-writeback proposal still lacks a real sources/... trigger_source');
  }

  const compiledContent = extractCompiledContent(body, frontmatter.action);
  let result;
  switch (frontmatter.action) {
    case 'create':
      result = compileCreate(repoRoot, proposalPath, frontmatter, compiledContent);
      break;
    case 'update':
      result = compileUpdate(repoRoot, proposalPath, frontmatter, compiledContent);
      break;
    case 'archive':
      result = compileArchive(repoRoot, proposalPath, frontmatter);
      break;
    default:
      throw new Error(`unsupported apply action: ${frontmatter.action}`);
  }

  const domain = String(frontmatter.target_page || '').split('/').filter(Boolean)[0];
  if (domain) {
    updateDomainIndex(repoRoot, { domain, sync: true });
  }
  updateFrontmatterFile(proposalPath, { compiled: true, compiled_at: formatDate() });
  syncRuntimeFiles(repoRoot, [proposalPath]);
  appendLog(
    repoRoot,
    'changes',
    'apply',
    `action: ${frontmatter.action || '~'} | target: ${frontmatter.target_page || '~'} | result: ${result.result} | sources_added: ${result.sourcesAdded} | cross_refs_updated: ${result.refsUpdated} | conflicts: ${result.conflicts}`
  );
  updateState(repoRoot, { last_compile: formatDate() });
  const db = openRuntimeIndex(repoRoot);
  recordOperation(db, 'apply.run', 'ok', {
    proposal: wikiRelative(repoRoot, proposalPath),
    target: frontmatter.target_page || '',
    action: frontmatter.action || '',
  });
  return {
    proposal: wikiRelative(repoRoot, proposalPath),
    page: wikiRelative(repoRoot, result.pagePath),
    action: frontmatter.action,
    target_page: frontmatter.target_page,
    result: result.result,
    sources_added: result.sourcesAdded,
    refs_updated: result.refsUpdated,
    conflicts: result.conflicts,
  };
}

module.exports = {
  compileApprovedProposal,
};
