'use strict';

const fs = require('fs');
const { writeFileAtomic } = require('./utils');

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeScalar(rawValue) {
  if (rawValue === '~') {
    return null;
  }
  if (/^\[(.*)\]$/.test(rawValue)) {
    const inner = rawValue.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner.split(',').map((item) => normalizeScalar(item.trim()));
  }
  // JSON object/array items (e.g., typed_refs: [{...}])
  if ((rawValue.startsWith('{') && rawValue.endsWith('}')) || (rawValue.startsWith('[') && rawValue.endsWith(']'))) {
    try {
      return JSON.parse(rawValue);
    } catch {
      // fall through to string
    }
  }
  if (rawValue === 'true') {
    return true;
  }
  if (rawValue === 'false') {
    return false;
  }
  return stripQuotes(rawValue);
}

function parseFrontmatterText(text) {
  if (!text.startsWith('---\n')) {
    return { frontmatter: {}, body: text };
  }

  const endIndex = text.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { frontmatter: {}, body: text };
  }

  const block = text.slice(4, endIndex);
  const body = text.slice(endIndex + 5);
  const lines = block.split('\n');
  const frontmatter = {};
  let currentListKey = '';

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const listItemMatch = line.match(/^  - (.*)$/);
    if (currentListKey && listItemMatch) {
      frontmatter[currentListKey].push(normalizeScalar(listItemMatch[1].trim()));
      continue;
    }

    currentListKey = '';
    const keyValueMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyValueMatch) {
      continue;
    }

    const key = keyValueMatch[1];
    const rawValue = keyValueMatch[2].trim();

    if (rawValue === '') {
      frontmatter[key] = [];
      currentListKey = key;
      continue;
    }

    frontmatter[key] = normalizeScalar(rawValue);
  }

  return { frontmatter, body };
}

function parseFrontmatterFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return parseFrontmatterText(text);
}

function scalarToYaml(value) {
  if (value === null || value === undefined) {
    return '~';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value === '') {
    return '""';
  }
  if (/^[A-Za-z0-9._/@:-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function stringifyFrontmatter(frontmatter) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${scalarToYaml(item)}`);
      }
      continue;
    }
    lines.push(`${key}: ${scalarToYaml(value)}`);
  }
  lines.push('---');
  return `${lines.join('\n')}\n`;
}

function writeFrontmatterFile(filePath, frontmatter, body) {
  const normalizedBody = body.startsWith('\n') ? body : `\n${body}`;
  writeFileAtomic(filePath, `${stringifyFrontmatter(frontmatter)}${normalizedBody}`);
}

function updateFrontmatterFile(filePath, updates) {
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      // Explicit undefined = delete the key entirely from frontmatter
      delete frontmatter[key];
    } else {
      frontmatter[key] = value;
    }
  }
  writeFrontmatterFile(filePath, frontmatter, body);
  return frontmatter;
}

function replaceConflictBlock(filePath, mergedContent) {
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  const pattern = /<<<CONFLICT>>>[\s\S]*?<<<END_CONFLICT>>>/;
  if (!pattern.test(body)) {
    throw new Error(`No conflict block found in ${filePath}`);
  }
  const normalizedMerged = mergedContent.endsWith('\n') ? mergedContent.slice(0, -1) : mergedContent;
  const updatedBody = body.replace(pattern, normalizedMerged);
  writeFrontmatterFile(filePath, frontmatter, updatedBody);
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function appendToSection(filePath, heading, content, options = {}) {
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  const normalizedContent = ensureTrailingNewline(content.trim());
  if (options.dedupNeedle && body.includes(options.dedupNeedle)) {
    return false;
  }
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`(^## ${escapedHeading}\\n)([\\s\\S]*?)(?=^## |\\Z)`, 'm');
  let updatedBody = body;

  if (sectionPattern.test(body)) {
    updatedBody = body.replace(sectionPattern, (match, sectionHeader, sectionBody) => {
      const separator = sectionBody.trim() ? '\n' : '';
      return `${sectionHeader}${sectionBody}${separator}${normalizedContent}`;
    });
  } else {
    const prefix = body.trim() ? '\n\n' : '\n';
    updatedBody = `${body}${prefix}## ${heading}\n\n${normalizedContent}`;
  }

  writeFrontmatterFile(filePath, frontmatter, updatedBody);
  return true;
}

function replaceSection(filePath, heading, content) {
  const { frontmatter, body } = parseFrontmatterFile(filePath);
  const normalizedContent = ensureTrailingNewline(content.trim());
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`(^## ${escapedHeading}\\n)([\\s\\S]*?)(?=^## |\\Z)`, 'm');
  let updatedBody = body;

  if (sectionPattern.test(body)) {
    updatedBody = body.replace(sectionPattern, `## ${heading}\n\n${normalizedContent}`);
  } else {
    const prefix = body.trim() ? '\n\n' : '\n';
    updatedBody = `${body}${prefix}## ${heading}\n\n${normalizedContent}`;
  }

  writeFrontmatterFile(filePath, frontmatter, updatedBody);
}

module.exports = {
  appendToSection,
  parseFrontmatterFile,
  parseFrontmatterText,
  replaceSection,
  stringifyFrontmatter,
  writeFrontmatterFile,
  updateFrontmatterFile,
  replaceConflictBlock,
};
