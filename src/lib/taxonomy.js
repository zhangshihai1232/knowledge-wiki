'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_VERSION = '1.0';
const DOMAIN_REGISTRY_FILE = 'domains.json';
const PRIMARY_TYPE_REGISTRY_FILE = 'primary-types.json';
const SUBTYPE_REGISTRY_FILE = 'subtypes.json';
const TAG_REGISTRY_FILE = 'tags.json';
const SUGGESTION_QUEUE_FILE = 'suggestions.json';

const DEFAULT_DOMAINS = {
  version: REGISTRY_VERSION,
  items: [
    { id: 'ai', aliases: ['llm', 'rag', 'agent'], status: 'active' },
    { id: 'product', aliases: ['pm', 'prd'], status: 'active' },
    { id: 'engineering', aliases: ['eng', 'system'], status: 'active' },
    { id: 'operations', aliases: ['ops', 'runbook'], status: 'active' },
  ],
};

const DEFAULT_PRIMARY_TYPES = {
  version: REGISTRY_VERSION,
  items: [
    { id: 'concept', aliases: ['什么是', '定义', '概念', 'principle'], status: 'active' },
    { id: 'entity', aliases: ['对象', '组件', 'tool', 'service'], status: 'active' },
    { id: 'comparison', aliases: ['对比', '比较', '区别', 'vs'], status: 'active' },
    { id: 'guide', aliases: ['如何', '怎么', '步骤', '指南', 'playbook'], status: 'active' },
    { id: 'decision', aliases: ['决策', '选型', 'should', '是否'], status: 'active' },
    { id: 'source', aliases: ['来源', '原文', '依据', 'source', 'evidence'], status: 'active' },
  ],
};

const DEFAULT_SUBTYPES = {
  version: REGISTRY_VERSION,
  items: [
    { id: 'architecture', primary_types: ['concept', 'entity'], domains: ['ai', 'engineering'], aliases: ['arch'], status: 'active' },
    { id: 'workflow', primary_types: ['guide', 'decision'], domains: ['ai', 'engineering', 'operations'], aliases: ['process'], status: 'active' },
    { id: 'policy', primary_types: ['decision', 'guide'], domains: ['product', 'engineering', 'operations'], aliases: ['rule'], status: 'active' },
    { id: 'tool', primary_types: ['entity', 'source'], domains: ['ai', 'engineering', 'product'], aliases: ['platform'], status: 'active' },
    { id: 'meeting-note', primary_types: ['source'], domains: ['ai', 'product', 'engineering', 'operations'], aliases: ['minutes'], status: 'active' },
  ],
};

const DEFAULT_SUGGESTIONS = {
  version: REGISTRY_VERSION,
  items: [],
};

// Tag registry: controlled vocabulary for cross-cutting concerns.
// Tags differ from subtypes: they are NOT domain-scoped, and a page can have many.
// Categories: concern (security, performance, cost…), lifecycle (draft, stable, deprecated),
//             audience (junior, senior, pm, ic), source-type (internal, external, experiment)
const DEFAULT_TAGS = {
  version: REGISTRY_VERSION,
  items: [
    { id: 'security',     aliases: ['sec', 'auth', 'safety'],   category: 'concern',   status: 'active' },
    { id: 'performance',  aliases: ['perf', 'latency', 'speed'], category: 'concern',  status: 'active' },
    { id: 'cost',         aliases: ['pricing', 'budget'],        category: 'concern',  status: 'active' },
    { id: 'scalability',  aliases: ['scale', 'capacity'],        category: 'concern',  status: 'active' },
    { id: 'observability',aliases: ['monitoring', 'tracing'],    category: 'concern',  status: 'active' },
    { id: 'deprecated',   aliases: ['legacy', 'old'],            category: 'lifecycle', status: 'active' },
    { id: 'experimental', aliases: ['wip', 'draft', 'poc'],      category: 'lifecycle', status: 'active' },
  ],
};

function repoWikiPath(repoRoot, relativePath = '') {
  return path.join(repoRoot, '.wiki', relativePath);
}

function getRegistryDir(repoRoot) {
  return repoWikiPath(repoRoot, 'policy/registry');
}

function getRegistryPath(repoRoot, fileName) {
  return path.join(getRegistryDir(repoRoot), fileName);
}

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeList(value) {
  if (!value) {
    return [];
  }
  const input = Array.isArray(value) ? value : String(value).split(',');
  return Array.from(new Set(input.map((item) => normalizeValue(item)).filter(Boolean)));
}

function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return JSON.parse(JSON.stringify(fallbackValue));
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureTaxonomyRegistry(repoRoot) {
  const registryDir = getRegistryDir(repoRoot);
  fs.mkdirSync(registryDir, { recursive: true });
  const defaults = [
    [DOMAIN_REGISTRY_FILE, DEFAULT_DOMAINS],
    [PRIMARY_TYPE_REGISTRY_FILE, DEFAULT_PRIMARY_TYPES],
    [SUBTYPE_REGISTRY_FILE, DEFAULT_SUBTYPES],
    [TAG_REGISTRY_FILE, DEFAULT_TAGS],
    [SUGGESTION_QUEUE_FILE, DEFAULT_SUGGESTIONS],
  ];
  for (const [fileName, value] of defaults) {
    const filePath = getRegistryPath(repoRoot, fileName);
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filePath, value);
    }
  }
}

function loadTaxonomy(repoRoot) {
  ensureTaxonomyRegistry(repoRoot);
  return {
    domains: readJsonFile(getRegistryPath(repoRoot, DOMAIN_REGISTRY_FILE), DEFAULT_DOMAINS),
    primaryTypes: readJsonFile(getRegistryPath(repoRoot, PRIMARY_TYPE_REGISTRY_FILE), DEFAULT_PRIMARY_TYPES),
    subtypes: readJsonFile(getRegistryPath(repoRoot, SUBTYPE_REGISTRY_FILE), DEFAULT_SUBTYPES),
    tags: readJsonFile(getRegistryPath(repoRoot, TAG_REGISTRY_FILE), DEFAULT_TAGS),
    suggestions: readJsonFile(getRegistryPath(repoRoot, SUGGESTION_QUEUE_FILE), DEFAULT_SUGGESTIONS),
  };
}

function saveSuggestionQueue(repoRoot, queue) {
  writeJsonFile(getRegistryPath(repoRoot, SUGGESTION_QUEUE_FILE), queue);
}

function normalizeRegistryId(value) {
  return normalizeValue(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function matchesRegistryItem(item, value) {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalizeValue(item.id).toLowerCase() === normalized) {
    return true;
  }
  return normalizeList(item.aliases).some((alias) => alias.toLowerCase() === normalized);
}

function findRegistryItem(items, value, options = {}) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }
  return items.find((item) => {
    if (!matchesRegistryItem(item, normalized)) {
      return false;
    }
    if (options.domain) {
      const domains = normalizeList(item.domains);
      if (domains.length && !domains.includes(options.domain)) {
        return false;
      }
    }
    if (options.primaryType) {
      const primaryTypes = normalizeList(item.primary_types || item.primaryTypes);
      if (primaryTypes.length && !primaryTypes.includes(options.primaryType)) {
        return false;
      }
    }
    return item.status !== 'rejected';
  }) || null;
}

function suggestionKey(entry) {
  return [
    normalizeValue(entry.kind),
    normalizeValue(entry.value).toLowerCase(),
    normalizeValue(entry.domain).toLowerCase(),
    normalizeValue(entry.primary_type).toLowerCase(),
  ].join('|');
}

function findSuggestionEntry(queue, options) {
  const kind = normalizeValue(options.kind);
  const value = normalizeValue(options.value);
  const domain = normalizeValue(options.domain);
  const primaryType = normalizeValue(options.primaryType || options.primary_type);
  const matches = queue.items.filter((item) => {
    if (normalizeValue(item.kind) !== kind || normalizeValue(item.value) !== value) {
      return false;
    }
    if (domain && normalizeValue(item.domain) !== domain) {
      return false;
    }
    if (primaryType && normalizeValue(item.primary_type) !== primaryType) {
      return false;
    }
    return true;
  });
  if (!matches.length) {
    return null;
  }
  return matches.find((item) => item.status === 'pending') || matches[0];
}

function recordSuggestions(repoRoot, suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return [];
  }
  const taxonomy = loadTaxonomy(repoRoot);
  const queue = taxonomy.suggestions;
  const now = new Date().toISOString();
  const recorded = [];
  for (const rawEntry of suggestions) {
    const value = normalizeValue(rawEntry.value);
    const kind = normalizeValue(rawEntry.kind);
    if (!value || !kind) {
      continue;
    }
    const entry = {
      kind,
      value,
      domain: normalizeValue(rawEntry.domain) || null,
      primary_type: normalizeValue(rawEntry.primary_type) || null,
      via: normalizeValue(rawEntry.via) || null,
      source_path: normalizeValue(rawEntry.source_path) || null,
    };
    const key = suggestionKey(entry);
    const existing = queue.items.find((item) => suggestionKey(item) === key);
    if (existing) {
      existing.count = Number(existing.count || 0) + 1;
      existing.last_suggested_at = now;
      existing.status = existing.status || 'pending';
      existing.examples = Array.isArray(existing.examples) ? existing.examples : [];
      const exampleKey = `${entry.via || ''}|${entry.source_path || ''}`;
      const alreadyHasExample = existing.examples.some((item) => `${item.via || ''}|${item.source_path || ''}` === exampleKey);
      if (!alreadyHasExample && existing.examples.length < 5) {
        existing.examples.push({ via: entry.via, source_path: entry.source_path });
      }
      recorded.push(existing);
      continue;
    }
    const next = {
      kind: entry.kind,
      value: entry.value,
      domain: entry.domain,
      primary_type: entry.primary_type,
      status: 'pending',
      count: 1,
      first_suggested_at: now,
      last_suggested_at: now,
      examples: entry.via || entry.source_path ? [{ via: entry.via, source_path: entry.source_path }] : [],
    };
    queue.items.push(next);
    recorded.push(next);
  }
  saveSuggestionQueue(repoRoot, queue);
  return recorded;
}

function registerDomain(repoRoot, value) {
  const taxonomy = loadTaxonomy(repoRoot);
  const id = normalizeRegistryId(value);
  if (!id) {
    throw new Error('taxonomy domain value is required');
  }
  if (!findRegistryItem(taxonomy.domains.items, id)) {
    taxonomy.domains.items.push({ id, aliases: [], status: 'active' });
    writeJsonFile(getRegistryPath(repoRoot, DOMAIN_REGISTRY_FILE), taxonomy.domains);
  }
  return id;
}

function registerPrimaryType(repoRoot, value) {
  const taxonomy = loadTaxonomy(repoRoot);
  const id = normalizeRegistryId(value);
  if (!id) {
    throw new Error('taxonomy primary_type value is required');
  }
  if (!findRegistryItem(taxonomy.primaryTypes.items, id)) {
    taxonomy.primaryTypes.items.push({ id, aliases: [], status: 'active' });
    writeJsonFile(getRegistryPath(repoRoot, PRIMARY_TYPE_REGISTRY_FILE), taxonomy.primaryTypes);
  }
  return id;
}

function registerSubtype(repoRoot, value, options = {}) {
  const taxonomy = loadTaxonomy(repoRoot);
  const id = normalizeRegistryId(value);
  if (!id) {
    throw new Error('taxonomy subtype value is required');
  }
  const domain = normalizeValue(options.domain);
  const primaryType = normalizeValue(options.primaryType);
  let item = findRegistryItem(taxonomy.subtypes.items, id, { domain, primaryType });
  if (!item) {
    item = {
      id,
      aliases: [],
      domains: domain ? [domain] : [],
      primary_types: primaryType ? [primaryType] : [],
      status: 'active',
    };
    taxonomy.subtypes.items.push(item);
  } else {
    item.domains = normalizeList(item.domains);
    item.primary_types = normalizeList(item.primary_types || item.primaryTypes);
    if (domain && !item.domains.includes(domain)) {
      item.domains.push(domain);
    }
    if (primaryType && !item.primary_types.includes(primaryType)) {
      item.primary_types.push(primaryType);
    }
    item.status = 'active';
  }
  writeJsonFile(getRegistryPath(repoRoot, SUBTYPE_REGISTRY_FILE), taxonomy.subtypes);
  return id;
}

// Deprecate a taxonomy item (domain, primary_type, or subtype) by setting status='deprecated'.
// Optionally supply replacedBy to record a canonical replacement.
function deprecateTaxonomyItem(repoRoot, kind, id, options = {}) {
  const taxonomy = loadTaxonomy(repoRoot);
  const normalizedId = normalizeRegistryId(id);
  const replacedBy = normalizeValue(options.replacedBy || options.replaced_by) || null;

  let registryKey, registryFile;
  if (kind === 'domain') {
    registryKey = 'domains';
    registryFile = DOMAIN_REGISTRY_FILE;
  } else if (kind === 'primary_type') {
    registryKey = 'primaryTypes';
    registryFile = PRIMARY_TYPE_REGISTRY_FILE;
  } else if (kind === 'subtype') {
    registryKey = 'subtypes';
    registryFile = SUBTYPE_REGISTRY_FILE;
  } else {
    throw new Error(`deprecateTaxonomyItem: kind must be domain, primary_type, or subtype (got '${kind}')`);
  }

  const items = taxonomy[registryKey].items;
  const item = items.find((i) => normalizeRegistryId(i.id) === normalizedId);
  if (!item) {
    throw new Error(`taxonomy ${kind} '${id}' not found in registry`);
  }
  item.status = 'deprecated';
  item.deprecated_at = new Date().toISOString();
  if (replacedBy) {
    item.replaced_by = replacedBy;
  }
  writeJsonFile(getRegistryPath(repoRoot, registryFile), taxonomy[registryKey]);
  return { kind, id: normalizedId, status: 'deprecated', replaced_by: replacedBy };
}

// Validate classification fields against the taxonomy registry.
// Returns { valid: bool, issues: [{field, value, reason}] }
function validateClassification(repoRoot, fields) {
  const taxonomy = loadTaxonomy(repoRoot);
  const domain = normalizeValue(fields.domain);
  const primaryType = normalizeValue(fields.primary_type || fields.primaryType);
  const subtype = normalizeValue(fields.subtype);
  const issues = [];

  function checkField(fieldName, items, value, opts = {}) {
    if (!value) return;
    const item = findRegistryItem(items, value, opts);
    if (!item) {
      issues.push({ field: fieldName, value, reason: 'unknown' });
    } else if (item.status === 'deprecated') {
      issues.push({ field: fieldName, value, reason: 'deprecated', replaced_by: item.replaced_by || null });
    }
  }

  checkField('domain', taxonomy.domains.items, domain);
  checkField('primary_type', taxonomy.primaryTypes.items, primaryType);
  checkField('subtype', taxonomy.subtypes.items, subtype, { domain, primaryType });

  return { valid: issues.length === 0, issues };
}

function applySuggestionDecision(repoRoot, decision, options) {
  const taxonomy = loadTaxonomy(repoRoot);
  const kind = normalizeValue(options.kind);
  const value = normalizeValue(options.value);
  const domain = normalizeValue(options.domain);
  const primaryType = normalizeValue(options.primaryType);
  const target = findSuggestionEntry(taxonomy.suggestions, { kind, value, domain, primaryType });
  if (!target) {
    throw new Error(`taxonomy suggestion not found: ${kind} ${value}`);
  }
  target.status = decision;
  target.decided_at = new Date().toISOString();
  target.reason = normalizeValue(options.reason) || null;
  if (decision === 'accepted') {
    if (kind === 'domain') {
      registerDomain(repoRoot, value);
    } else if (kind === 'primary_type') {
      registerPrimaryType(repoRoot, value);
    } else if (kind === 'subtype') {
      registerSubtype(repoRoot, value, { domain, primaryType });
    }
  }
  saveSuggestionQueue(repoRoot, taxonomy.suggestions);
  return target;
}

function getTaxonomySnapshot(repoRoot) {
  const taxonomy = loadTaxonomy(repoRoot);
  return {
    domains: taxonomy.domains.items,
    primary_types: taxonomy.primaryTypes.items,
    subtypes: taxonomy.subtypes.items,
    tags: taxonomy.tags.items,
    pending_suggestions: taxonomy.suggestions.items.filter((item) => item.status === 'pending').length,
  };
}

function listSuggestions(repoRoot, status = '') {
  const taxonomy = loadTaxonomy(repoRoot);
  return taxonomy.suggestions.items.filter((item) => !status || item.status === status);
}

function normalizeClassification(repoRoot, fields, options = {}) {
  const taxonomy = loadTaxonomy(repoRoot);
  const domain = normalizeValue(fields.domain);
  const primaryType = normalizeValue(fields.primary_type || fields.primaryType);
  const subtype = normalizeValue(fields.subtype);
  const tags = normalizeList(fields.tags);
  const suggestionEntries = [];

  // Check domain: unknown → suggest; deprecated → suggest with replacement hint
  const domainItem = domain ? findRegistryItem(taxonomy.domains.items, domain) : null;
  if (domain && !domainItem) {
    suggestionEntries.push({ kind: 'domain', value: domain, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  } else if (domainItem && domainItem.status === 'deprecated') {
    suggestionEntries.push({ kind: 'domain', value: domainItem.replaced_by || domain, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  }

  const primaryTypeItem = primaryType ? findRegistryItem(taxonomy.primaryTypes.items, primaryType) : null;
  if (primaryType && !primaryTypeItem) {
    suggestionEntries.push({ kind: 'primary_type', value: primaryType, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  } else if (primaryTypeItem && primaryTypeItem.status === 'deprecated') {
    suggestionEntries.push({ kind: 'primary_type', value: primaryTypeItem.replaced_by || primaryType, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  }

  const subtypeItem = subtype ? findRegistryItem(taxonomy.subtypes.items, subtype, { domain, primaryType }) : null;
  if (subtype && !subtypeItem) {
    suggestionEntries.push({ kind: 'subtype', value: subtype, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  } else if (subtypeItem && subtypeItem.status === 'deprecated') {
    suggestionEntries.push({ kind: 'subtype', value: subtypeItem.replaced_by || subtype, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  }

  const suggestedTags = normalizeList(fields.suggested_tags || fields.suggestedTags);
  const suggestedAliases = normalizeList(fields.suggested_aliases || fields.suggestedAliases);
  const suggestedRelatedTerms = normalizeList(fields.suggested_related_terms || fields.suggestedRelatedTerms);
  for (const value of suggestedTags) {
    suggestionEntries.push({ kind: 'tag', value, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  }
  for (const value of suggestedAliases) {
    suggestionEntries.push({ kind: 'alias', value, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  }
  for (const value of suggestedRelatedTerms) {
    suggestionEntries.push({ kind: 'related_term', value, domain, primary_type: primaryType, via: options.via, source_path: options.sourcePath });
  }
  recordSuggestions(repoRoot, suggestionEntries);

  // Collect deprecated warnings for callers that want to surface them
  const deprecatedWarnings = [];
  if (domainItem && domainItem.status === 'deprecated') {
    deprecatedWarnings.push({ field: 'domain', value: domain, replaced_by: domainItem.replaced_by || null });
  }
  if (primaryTypeItem && primaryTypeItem.status === 'deprecated') {
    deprecatedWarnings.push({ field: 'primary_type', value: primaryType, replaced_by: primaryTypeItem.replaced_by || null });
  }
  if (subtypeItem && subtypeItem.status === 'deprecated') {
    deprecatedWarnings.push({ field: 'subtype', value: subtype, replaced_by: subtypeItem.replaced_by || null });
  }

  return {
    domain: domain || null,
    primary_type: primaryType || null,
    subtype: subtype || null,
    tags,
    deprecated_warnings: deprecatedWarnings.length ? deprecatedWarnings : undefined,
  };
}

function tokenizeQuery(query) {
  const normalized = normalizeValue(query).toLowerCase();
  if (!normalized) {
    return [];
  }
  return Array.from(new Set(normalized.split(/[\s/_.-]+/).map((item) => item.trim()).filter(Boolean)));
}

function heuristicPrimaryTypes(queryLower) {
  const hints = [];
  if (/(如何|怎么|步骤|指南|playbook|checklist)/.test(queryLower)) {
    hints.push('guide');
  }
  if (/(对比|比较|区别|\bvs\b|tradeoff)/.test(queryLower)) {
    hints.push('comparison');
  }
  if (/(什么是|定义|概念|原理|meaning|definition)/.test(queryLower)) {
    hints.push('concept');
  }
  if (/(决策|选型|是否|should|choose)/.test(queryLower)) {
    hints.push('decision');
  }
  if (/(来源|依据|证据|原文|source|evidence)/.test(queryLower)) {
    hints.push('source');
  }
  return Array.from(new Set(hints));
}

function inferFocus(queryLower) {
  if (/(来源|依据|证据|原文|source|evidence)/.test(queryLower)) {
    return 'evidence';
  }
  if (/(proposal|提案|补缺|writeback|缺口)/.test(queryLower)) {
    return 'proposal';
  }
  if (/(维护|巡检|健康|maintain|lint|状态)/.test(queryLower)) {
    return 'maintenance';
  }
  return 'answer';
}

function matchItems(items, queryLower, tokens, options = {}) {
  return items
    .filter((item) => {
      if (options.domain) {
        const domains = normalizeList(item.domains);
        if (domains.length && !domains.includes(options.domain)) {
          return false;
        }
      }
      if (options.primaryType) {
        const primaryTypes = normalizeList(item.primary_types || item.primaryTypes);
        if (primaryTypes.length && !primaryTypes.includes(options.primaryType)) {
          return false;
        }
      }
      const candidates = [item.id, ...normalizeList(item.aliases)].map((value) => value.toLowerCase());
      return candidates.some((candidate) => candidate && (queryLower.includes(candidate) || tokens.includes(candidate)));
    })
    .map((item) => item.id);
}

function buildQueryHints(repoRoot, query, options = {}) {
  const taxonomy = loadTaxonomy(repoRoot);
  const normalizedQuery = normalizeValue(query).toLowerCase();
  const tokens = tokenizeQuery(normalizedQuery);
  const runtimeDomains = normalizeList(options.runtimeDomains);
  const runtimeCollections = normalizeList(options.runtimeCollections);
  const registryDomainHints = matchItems(taxonomy.domains.items, normalizedQuery, tokens);
  const runtimeDomainHints = runtimeDomains.filter((domain) => normalizedQuery.includes(domain.toLowerCase()) || tokens.includes(domain.toLowerCase()));
  const domainHints = Array.from(new Set([...registryDomainHints, ...runtimeDomainHints]));
  const primaryTypeHints = Array.from(new Set([
    ...matchItems(taxonomy.primaryTypes.items, normalizedQuery, tokens),
    ...heuristicPrimaryTypes(normalizedQuery),
  ]));
  const subtypeHints = Array.from(new Set(
    taxonomy.subtypes.items.flatMap((item) => matchItems([item], normalizedQuery, tokens, {
      domain: domainHints[0] || '',
      primaryType: primaryTypeHints[0] || '',
    }))
  ));
  // Collection hints: match known runtime collections against query tokens
  const collectionHints = runtimeCollections.filter(
    (col) => normalizedQuery.includes(col.toLowerCase()) || tokens.includes(col.toLowerCase())
  );

  // Tag hints: match registered tags (controlled vocabulary) against query tokens
  const tagHints = Array.from(new Set(
    taxonomy.tags.items
      .filter((item) => item.status !== 'rejected')
      .filter((item) => {
        const tagId = item.id.toLowerCase();
        const allForms = [tagId, ...normalizeList(item.aliases).map((a) => a.toLowerCase())];
        return allForms.some((form) => normalizedQuery.includes(form) || tokens.includes(form));
      })
      .map((item) => item.id)
  ));

  return {
    tokens,
    domain_hints: domainHints,
    primary_type_hints: primaryTypeHints,
    subtype_hints: subtypeHints,
    collection_hints: collectionHints,
    tag_hints: tagHints,
    focus: inferFocus(normalizedQuery),
  };
}

module.exports = {
  applySuggestionDecision,
  buildQueryHints,
  deprecateTaxonomyItem,
  ensureTaxonomyRegistry,
  getRegistryDir,
  getRegistryPath,
  getTaxonomySnapshot,
  listSuggestions,
  loadTaxonomy,
  normalizeClassification,
  normalizeList,
  normalizeValue,
  recordSuggestions,
  registerDomain,
  registerPrimaryType,
  registerSubtype,
  validateClassification,
};
