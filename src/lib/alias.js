'use strict';

const fs = require('fs');
const path = require('path');

const ALIASES_FILE = 'aliases.json';

function getAliasesPath(repoRoot) {
  return path.join(repoRoot, '.wiki', 'policy', ALIASES_FILE);
}

function loadAliases(repoRoot) {
  const aliasesPath = getAliasesPath(repoRoot);
  if (!fs.existsSync(aliasesPath)) {
    return { version: '1.0', path_map: {}, taxonomy_map: {} };
  }
  return JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
}

function saveAliases(repoRoot, aliases) {
  const aliasesPath = getAliasesPath(repoRoot);
  fs.mkdirSync(path.dirname(aliasesPath), { recursive: true });
  fs.writeFileSync(aliasesPath, `${JSON.stringify(aliases, null, 2)}\n`, 'utf8');
}

// Record that an old wiki-relative path maps to a stable page_id.
// Used after relocate/rename so old paths remain resolvable.
function recordPathAlias(repoRoot, oldPath, pageId) {
  if (!oldPath || !pageId) {
    throw new Error('alias: oldPath and pageId are required');
  }
  const aliases = loadAliases(repoRoot);
  aliases.path_map[oldPath] = pageId;
  saveAliases(repoRoot, aliases);
}

// Record that an old taxonomy value (e.g. old domain name) maps to a new value.
// kind: 'domain' | 'subtype' | 'primary_type'
function recordTaxonomyAlias(repoRoot, kind, oldValue, newValue) {
  if (!kind || !oldValue || !newValue) {
    throw new Error('alias: kind, oldValue and newValue are required');
  }
  const aliases = loadAliases(repoRoot);
  if (!aliases.taxonomy_map[kind]) {
    aliases.taxonomy_map[kind] = {};
  }
  aliases.taxonomy_map[kind][oldValue] = newValue;
  saveAliases(repoRoot, aliases);
}

// Resolve a page_id from a path (current or old).
// Returns the page_id if this path was aliased, otherwise null.
function resolvePathAlias(repoRoot, wikiPath) {
  const aliases = loadAliases(repoRoot);
  return aliases.path_map[wikiPath] || null;
}

// Resolve a taxonomy value through alias map.
// Returns the canonical (new) value, or the input value if no alias exists.
function resolveTaxonomyAlias(repoRoot, kind, value) {
  const aliases = loadAliases(repoRoot);
  const kindMap = aliases.taxonomy_map[kind] || {};
  return kindMap[value] || value;
}

function listAliases(repoRoot) {
  return loadAliases(repoRoot);
}

module.exports = {
  listAliases,
  recordPathAlias,
  recordTaxonomyAlias,
  resolvePathAlias,
  resolveTaxonomyAlias,
};
