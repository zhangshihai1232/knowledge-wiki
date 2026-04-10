'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CONFIG_PATH,
  ensureConfigFile,
  readNamespaceConfig,
  resolveRepoRoot,
  readCurrentRepo,
  setCurrentRepo,
  setNamespace,
  setDefaultNamespace,
  resolveRepoPath,
} = require('./lib/config');
const { scaffoldRepo } = require('./lib/bootstrap');
const {
  applyResolve,
  applyReviewDecision,
  computeCheckFindings,
  formatDate,
  getConflictRows,
  getProposalRows,
} = require('./lib/wiki-repo');
const { compileApprovedProposal } = require('./lib/compiler');
const { askWorkflow, importWorkflow, maintainWorkflow, runInternalCommand } = require('./lib/wiki-internal');
const { applySuggestionDecision, deprecateTaxonomyItem, getTaxonomySnapshot, listSuggestions, validateClassification } = require('./lib/taxonomy');
const {
  OPERATION_TYPES,
  applyMigrationPlan,
  createMigrationPlan,
  dryRunMigrationPlan,
  listMigrationPlans,
  loadPlan,
  rollbackMigrationPlan,
} = require('./lib/migration');

const COMMAND_NAME = process.env.WIKI_COMMAND_NAME || 'wiki';
const CONTRACT_VERSION = '1.0';
function die(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseGlobalOptions(argv) {
  const filtered = [];
  let configPath = DEFAULT_CONFIG_PATH;
  let repoOverride = '';

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--config') {
      index += 1;
      if (index >= argv.length) {
        die('--config requires a value');
      }
      configPath = argv[index];
      continue;
    }
    if (token === '--repo') {
      index += 1;
      if (index >= argv.length) {
        die('--repo requires a value');
      }
      repoOverride = argv[index];
      continue;
    }
    filtered.push(token);
  }

  return { configPath, repoOverride, args: filtered };
}

function ensureRepoRoot(configPath, repoOverride) {
  try {
    const repoRoot = resolveRepoRoot(configPath, repoOverride);
    if (!repoRoot) {
      die(`no active wiki repo. Run '${COMMAND_NAME} use <repo>' or cd into a wiki repo first.`);
    }
    return repoRoot;
  } catch (error) {
    die(error.message);
  }
  return '';
}

function printTable(columns, rows) {
  const widths = columns.map((column) => column.length);
  for (const row of rows) {
    row.forEach((value, index) => {
      widths[index] = Math.max(widths[index], String(value).length);
    });
  }
  const render = (row) => row.map((value, index) => String(value).padEnd(widths[index], ' ')).join('  ');
  console.log(render(columns));
  console.log(render(widths.map((width) => '-'.repeat(width))));
  rows.forEach((row) => console.log(render(row)));
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function printJsonResult(kind, repoRoot, data, extra = {}) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        contract_version: CONTRACT_VERSION,
        kind,
        repo: repoRoot || null,
        ...extra,
        ...data,
      },
      null,
      2
    )
  );
}

function readJsonInput(inputFile) {
  if (inputFile === '-') {
    return fs.readFileSync(0, 'utf8');
  }
  return fs.readFileSync(path.resolve(process.cwd(), inputFile), 'utf8');
}

function usage() {
  console.log(`Usage:
  ${COMMAND_NAME} setup NAMESPACE BASE_PATH [--config PATH]
  ${COMMAND_NAME} new REPO_DIR [--name DISPLAY_NAME] [--namespace NAME] [--config PATH] [--force]
  ${COMMAND_NAME} use REPO_REF [--namespace NAME] [--config PATH]
  ${COMMAND_NAME} where [REPO_REF] [--namespace NAME] [--config PATH]

  ${COMMAND_NAME} status [--repo PATH] [--config PATH] [--json]
  ${COMMAND_NAME} check [--repo PATH] [--json]
  ${COMMAND_NAME} ask QUERY [--repo PATH] [--json] [--limit N]
  ${COMMAND_NAME} import --input FILE [--repo PATH] [--json]
  ${COMMAND_NAME} maintain [--repo PATH] [--json] [--apply-decay]
  ${COMMAND_NAME} taxonomy [list] [--repo PATH] [--json]
  ${COMMAND_NAME} taxonomy suggestions [--status pending|accepted|rejected] [--json]
  ${COMMAND_NAME} taxonomy accept KIND VALUE [--domain NAME] [--primary-type NAME] [--json]
  ${COMMAND_NAME} taxonomy reject KIND VALUE [--domain NAME] [--primary-type NAME] [--reason TEXT] [--json]
  ${COMMAND_NAME} taxonomy deprecate KIND ID [--replaced-by VALUE] [--json]
  ${COMMAND_NAME} taxonomy validate DOMAIN [--primary-type TYPE] [--subtype SUBTYPE] [--json]
  ${COMMAND_NAME} review [list] [--json]
  ${COMMAND_NAME} review approve PROPOSAL --by NAME --note TEXT [--json]
  ${COMMAND_NAME} review reject PROPOSAL --by NAME --reason TEXT [--json]
  ${COMMAND_NAME} review reopen PROPOSAL [--reason TEXT] [--json]
  ${COMMAND_NAME} review revise PROPOSAL --note TEXT [--json]
  ${COMMAND_NAME} apply [run [PROPOSAL] | list] [--json]
  ${COMMAND_NAME} resolve [list] [--json]
  ${COMMAND_NAME} resolve apply PROPOSAL --merged-file FILE --by NAME --as TEXT [--page FILE] [--confidence VALUE] [--json]
  ${COMMAND_NAME} migrate list [--status STATUS] [--json]
  ${COMMAND_NAME} migrate plan --op TYPE --scope TEXT --from KEY=VALUE... --to KEY=VALUE... [--reason TEXT] [--json]
  ${COMMAND_NAME} migrate dry-run PLAN_ID [--json]
  ${COMMAND_NAME} migrate apply PLAN_ID [--force] [--json]
  ${COMMAND_NAME} migrate rollback PLAN_ID [--json]
  ${COMMAND_NAME} migrate show PLAN_ID [--json]
  ${COMMAND_NAME} guide

Public mental model:
  /wiki     semantic front door inside a repo
  ${COMMAND_NAME}      deterministic task front door

Task words:
  status  check  taxonomy  review  apply  resolve  migrate

Agent workflow contracts:
  ask  import  maintain`);
}

function printStatus(configPath, repoOverride) {
  const repoRoot = resolveRepoRoot(configPath, repoOverride);
  if (!repoRoot) {
    return {
      mode: 'lifecycle',
      repo: null,
      workspace: null,
      review_queue: 0,
      apply_queue: 0,
      resolve_queue: 0,
      next: `${COMMAND_NAME} setup work /data/wiki/work`,
    };
  }

  const reviewRows = getProposalRows(repoRoot, ['inbox', 'review']);
  const applyRows = getProposalRows(repoRoot, ['approved']).filter((row) => row.compiled !== 'true');
  const conflictRows = getConflictRows(repoRoot);
  const config = readNamespaceConfig(configPath);
  return {
    mode: 'repo',
    repo: repoRoot,
    workspace: config.defaultNamespace || null,
    review_queue: reviewRows.length,
    apply_queue: applyRows.length,
    resolve_queue: conflictRows.length,
    next: reviewRows.length
      ? `${COMMAND_NAME} review`
      : applyRows.length
        ? `${COMMAND_NAME} apply`
        : conflictRows.length
          ? `${COMMAND_NAME} resolve`
          : '/wiki 请吸收这段资料',
  };
}

function runCheck(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const json = hasFlag(args, '--json');
  const findings = computeCheckFindings(repoRoot);
  const score = findings.length === 0 ? 100 : Math.max(0, 100 - findings.filter((item) => item.severity !== 'info').length * 3);

  if (json) {
    printJsonResult('wiki.check.result', repoRoot, { score, findings });
    return;
  }

  console.log(`Check score: ${score}%`);
  if (findings.length === 0) {
    console.log('No structural findings.');
    return;
  }

  printTable(
    ['severity', 'rule', 'target', 'message'],
    findings.map((item) => [item.severity, item.ruleId, item.targetPath, item.message])
  );
}

function runAsk(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  let json = false;
  let limit = 5;
  const terms = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--limit') {
      limit = parseNumber(args[index + 1], '--limit');
      index += 1;
      continue;
    }
    terms.push(token);
  }
  const query = terms.join(' ').trim();
  if (!query) {
    die('ask requires QUERY');
  }
  const result = askWorkflow(repoRoot, query, limit || 5);
  if (json) {
    printJsonResult('wiki.ask.result', repoRoot, {
      query,
      retrieval: result.retrieval,
      pages: result.pages,
      proposals: result.proposals,
      sources: result.sources,
    });
    return;
  }
  console.log(`Query: ${query}`);
  const sections = [
    ['Pages', result.pages.map((row) => [row.path, row.title || '~', row.domain || '~'])],
    ['Proposals', result.proposals.map((row) => [row.path, row.action || '~', row.target_page || '~'])],
    ['Sources', result.sources.map((row) => [row.path, row.source_kind || '~', row.title || '~'])],
  ];
  for (const [label, rows] of sections) {
    console.log(`${label}:`);
    if (!rows.length) {
      console.log('  (none)');
      continue;
    }
    rows.forEach((row) => console.log(`  - ${row.join(' | ')}`));
  }
}

function runImport(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  let inputFile = '';
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--input') {
      inputFile = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--json') {
      json = true;
      continue;
    }
    die(`unknown option for import: ${token}`);
  }
  if (!inputFile) {
    die('import requires --input FILE (use --input - to read JSON from stdin)');
  }
  try {
    const payload = JSON.parse(readJsonInput(inputFile));
    const result = importWorkflow(repoRoot, payload);
    if (json) {
      printJsonResult('wiki.import.result', repoRoot, {
        source: result.source,
        proposal: result.proposal,
        duplicate: result.duplicate,
      }, { input: inputFile });
      return;
    }
    console.log(`source: ${result.source}`);
    if (result.proposal) {
      console.log(`proposal: ${result.proposal}`);
    }
    if (result.duplicate.duplicate) {
      console.log(`duplicate: ${result.duplicate.path}`);
    }
  } catch (error) {
    die(error.message);
  }
}

function runMaintain(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const json = hasFlag(args, '--json');
  const applyDecay = hasFlag(args, '--apply-decay');
  const result = maintainWorkflow(repoRoot, { applyDecay });
  if (json) {
    printJsonResult('wiki.maintain.result', repoRoot, result, { apply_decay: applyDecay });
    return;
  }
  console.log(`Counts: sources=${result.counts.sources} canon=${result.counts.canon} pending=${result.counts.pending} conflicts=${result.counts.conflicts}`);
  console.log(`Findings: ${result.findings.length}`);
  if (result.structural_signals.length) {
    console.log(`Structural signals: ${result.structural_signals.length}`);
    for (const sig of result.structural_signals) {
      console.log(`  [${sig.ruleId}] ${sig.message}`);
    }
  }
  console.log(`Decay actions: ${result.decays.length}`);
  console.log(`Taxonomy pending suggestions: ${result.taxonomy.pending_suggestions}`);
}

function runTaxonomy(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const subcommand = !args[0] || args[0].startsWith('--') ? 'list' : args[0];
  const json = hasFlag(args, '--json');

  if (subcommand === 'list') {
    const snapshot = getTaxonomySnapshot(repoRoot);
    if (json) {
      printJsonResult('wiki.taxonomy.list', repoRoot, snapshot);
      return;
    }
    console.log(`Domains: ${snapshot.domains.length}`);
    console.log(`Primary types: ${snapshot.primary_types.length}`);
    console.log(`Subtypes: ${snapshot.subtypes.length}`);
    console.log(`Pending suggestions: ${snapshot.pending_suggestions}`);
    return;
  }

  if (subcommand === 'suggestions') {
    let status = '';
    for (let index = 1; index < args.length; index += 1) {
      if (args[index] === '--status') {
        status = args[index + 1] || '';
        index += 1;
        continue;
      }
      if (args[index] !== '--json') {
        die(`unknown option for taxonomy suggestions: ${args[index]}`);
      }
    }
    const rows = listSuggestions(repoRoot, status);
    if (json) {
      printJsonResult('wiki.taxonomy.suggestions', repoRoot, { rows, total: rows.length, status: status || null });
      return;
    }
    if (!rows.length) {
      console.log('No taxonomy suggestions.');
      return;
    }
    printTable(
      ['#', 'kind', 'value', 'domain', 'primary_type', 'status', 'count'],
      rows.map((row, index) => [index + 1, row.kind, row.value, row.domain || '~', row.primary_type || '~', row.status, row.count || 0])
    );
    return;
  }

  if (!['accept', 'reject', 'deprecate', 'validate'].includes(subcommand)) {
    die(`unknown subcommand for taxonomy: ${subcommand}`);
  }

  // taxonomy validate DOMAIN [--primary-type TYPE] [--subtype SUBTYPE] [--json]
  if (subcommand === 'validate') {
    const fields = { domain: args[1] || '' };
    for (let index = 2; index < args.length; index += 1) {
      const token = args[index];
      if (token === '--primary-type') { fields.primary_type = args[index + 1] || ''; index += 1; }
      else if (token === '--subtype') { fields.subtype = args[index + 1] || ''; index += 1; }
      else if (token !== '--json') { die(`unknown option for taxonomy validate: ${token}`); }
    }
    try {
      const result = validateClassification(repoRoot, fields);
      if (json) { printJsonResult('wiki.taxonomy.validate', repoRoot, result); return; }
      if (result.valid) { console.log('Classification is valid.'); return; }
      for (const issue of result.issues) {
        console.log(`[${issue.reason.toUpperCase()}] ${issue.field}: ${issue.value}${issue.replaced_by ? ` → use '${issue.replaced_by}'` : ''}`);
      }
    } catch (error) { die(error.message); }
    return;
  }

  // taxonomy deprecate KIND ID [--replaced-by VALUE] [--json]
  if (subcommand === 'deprecate') {
    const kind = args[1];
    const id = args[2];
    if (!kind || !id) { die('taxonomy deprecate requires KIND and ID'); }
    const opts = {};
    for (let index = 3; index < args.length; index += 1) {
      const token = args[index];
      if (token === '--replaced-by') { opts.replacedBy = args[index + 1] || ''; index += 1; }
      else if (token !== '--json') { die(`unknown option for taxonomy deprecate: ${token}`); }
    }
    try {
      const result = deprecateTaxonomyItem(repoRoot, kind, id, opts);
      if (json) { printJsonResult('wiki.taxonomy.deprecate', repoRoot, result); return; }
      console.log(`${result.kind}:${result.id} deprecated${result.replaced_by ? ` → replaced by '${result.replaced_by}'` : ''}`);
    } catch (error) { die(error.message); }
    return;
  }

  const kind = args[1];
  const value = args[2];
  if (!kind || !value) {
    die(`taxonomy ${subcommand} requires KIND and VALUE`);
  }

  const options = {
    kind,
    value,
    domain: '',
    primaryType: '',
    reason: '',
  };
  for (let index = 3; index < args.length; index += 1) {
    const token = args[index];
    switch (token) {
      case '--domain':
        options.domain = args[index + 1] || '';
        index += 1;
        break;
      case '--primary-type':
        options.primaryType = args[index + 1] || '';
        index += 1;
        break;
      case '--reason':
        options.reason = args[index + 1] || '';
        index += 1;
        break;
      case '--json':
        break;
      default:
        die(`unknown option for taxonomy ${subcommand}: ${token}`);
    }
  }

  try {
    const result = applySuggestionDecision(repoRoot, subcommand === 'accept' ? 'accepted' : 'rejected', options);
    if (json) {
      printJsonResult('wiki.taxonomy.result', repoRoot, { decision: subcommand, suggestion: result });
      return;
    }
    console.log(`${result.kind}:${result.value} -> ${result.status}`);
  } catch (error) {
    die(error.message);
  }
}

function runReview(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const subcommand = !args[0] || args[0].startsWith('--') ? 'list' : args[0];
  const json = hasFlag(args, '--json');

  if (subcommand === 'list') {
    const rows = getProposalRows(repoRoot, ['inbox', 'review']);
    if (json) {
      printJsonResult('wiki.review.list', repoRoot, { rows, total: rows.length });
      return;
    }
    if (rows.length === 0) {
      console.log('No proposals waiting for review.');
      return;
    }
    printTable(
      ['#', 'stage', 'proposal', 'action', 'target', 'proposed_at'],
      rows.map((row, index) => [index + 1, row.stage, row.proposal, row.action, row.targetPage, row.proposedAt])
    );
    return;
  }

  const proposal = args[1];
  if (!proposal) {
    die(`review ${subcommand} requires PROPOSAL`);
  }

  let reviewedBy = '';
  let note = '';
  let reason = '';
  let reviewedAt = '';

  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    switch (token) {
      case '--by':
        reviewedBy = args[index + 1] || '';
        index += 1;
        break;
      case '--note':
        note = args[index + 1] || '';
        index += 1;
        break;
      case '--reason':
        reason = args[index + 1] || '';
        index += 1;
        break;
      case '--at':
        reviewedAt = args[index + 1] || '';
        index += 1;
        break;
      case '--json':
        break;
      default:
        die(`unknown option for review ${subcommand}: ${token}`);
    }
  }

  if (subcommand === 'approve' && (!reviewedBy || !note)) {
    die('review approve requires --by and --note');
  }
  if (subcommand === 'reject' && (!reviewedBy || !reason)) {
    die('review reject requires --by and --reason');
  }
  if (subcommand === 'revise' && !note) {
    die('review revise requires --note');
  }

  try {
    const destination = applyReviewDecision(repoRoot, subcommand, proposal, {
      reviewedBy,
      reviewedAt,
      note,
      reason,
    });
    if (json) {
      printJsonResult('wiki.review.result', repoRoot, {
        decision: subcommand,
        proposal,
        output: destination.replace(`${repoRoot}/.wiki/`, ''),
      });
      return;
    }
    console.log(destination.replace(`${repoRoot}/.wiki/`, ''));
  } catch (error) {
    die(error.message);
  }
}

function parseNumber(value, flag) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    die(`${flag} must be a non-negative integer`);
  }
  return parsed;
}

function runApply(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const subcommand = !args[0] || args[0].startsWith('--') ? 'run' : args[0];
  const json = hasFlag(args, '--json');

  if (subcommand === 'list') {
    const rows = getProposalRows(repoRoot, ['approved']).filter((row) => row.compiled !== 'true');
    if (json) {
      printJsonResult('wiki.apply.list', repoRoot, { rows, total: rows.length });
      return;
    }
    if (rows.length === 0) {
      console.log('No approved proposals waiting for apply.');
      return;
    }
    printTable(
      ['#', 'proposal', 'action', 'target', 'proposed_at'],
      rows.map((row, index) => [index + 1, row.proposal, row.action, row.targetPage, row.proposedAt])
    );
    return;
  }

  if (subcommand !== 'run') {
    die(`unknown subcommand for apply: ${subcommand}`);
  }

  const proposal = args[1] && !args[1].startsWith('--') ? args[1] : '';
  const pendingRows = getProposalRows(repoRoot, ['approved']).filter((row) => row.compiled !== 'true');
  const targets = proposal ? [proposal] : pendingRows.map((row) => row.proposal);
  if (!targets.length) {
    if (json) {
      printJsonResult('wiki.apply.result', repoRoot, { applied: [], total: 0 });
      return;
    }
    console.log('No approved proposals waiting for apply.');
    return;
  }
  try {
    const applied = targets.map((target) => compileApprovedProposal(repoRoot, target));
    if (json) {
      printJsonResult('wiki.apply.result', repoRoot, { applied, total: applied.length });
      return;
    }
    applied.forEach((entry) => console.log(`${entry.proposal} -> ${entry.page}`));
  } catch (error) {
    die(error.message);
  }
}

function runResolve(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const subcommand = !args[0] || args[0].startsWith('--') ? 'list' : args[0];
  const json = hasFlag(args, '--json');

  if (subcommand === 'list') {
    const rows = getConflictRows(repoRoot);
    if (json) {
      printJsonResult('wiki.resolve.list', repoRoot, { rows, total: rows.length });
      return;
    }
    if (rows.length === 0) {
      console.log('No conflicts waiting for resolve.');
      return;
    }
    printTable(
      ['#', 'proposal', 'target', 'location', 'trigger_source'],
      rows.map((row, index) => [index + 1, row.proposal, row.targetPage, row.conflictLocation, row.triggerSource])
    );
    return;
  }

  if (subcommand !== 'apply') {
    die(`unknown subcommand for resolve: ${subcommand}`);
  }
  const proposal = args[1];
  if (!proposal) {
    die('resolve apply requires PROPOSAL');
  }

  const options = {
    mergedFile: '',
    resolvedBy: '',
    resolution: '',
    page: '',
    confidence: '',
  };

  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    switch (token) {
      case '--merged-file':
        options.mergedFile = args[index + 1] || '';
        index += 1;
        break;
      case '--by':
        options.resolvedBy = args[index + 1] || '';
        index += 1;
        break;
      case '--as':
        options.resolution = args[index + 1] || '';
        index += 1;
        break;
      case '--page':
        options.page = args[index + 1] || '';
        index += 1;
        break;
      case '--confidence':
        options.confidence = args[index + 1] || '';
        index += 1;
        break;
      case '--json':
        break;
      default:
        die(`unknown option for resolve apply: ${token}`);
    }
  }

  if (!options.mergedFile || !options.resolvedBy || !options.resolution) {
    die('resolve apply requires --merged-file, --by, and --as');
  }

  try {
    const result = applyResolve(repoRoot, proposal, options);
    if (json) {
      printJsonResult('wiki.resolve.result', repoRoot, {
        proposal,
        page: result.pagePath.replace(`${repoRoot}/`, ''),
        resolved_proposal: result.resolvedPath.replace(`${repoRoot}/.wiki/`, ''),
        resolution: options.resolution,
      });
      return;
    }
    console.log(result.pagePath.replace(`${repoRoot}/`, ''));
  } catch (error) {
    die(error.message);
  }
}

function runMigrate(configPath, repoOverride, args) {
  const repoRoot = ensureRepoRoot(configPath, repoOverride);
  const subcommand = !args[0] || args[0].startsWith('--') ? 'list' : args[0];
  const json = hasFlag(args, '--json');

  if (subcommand === 'list') {
    let filterStatus = '';
    for (let index = 1; index < args.length; index += 1) {
      if (args[index] === '--status') {
        filterStatus = args[index + 1] || '';
        index += 1;
      }
    }
    const plans = listMigrationPlans(repoRoot, filterStatus);
    if (json) {
      printJsonResult('wiki.migrate.list', repoRoot, { plans, total: plans.length });
      return;
    }
    if (!plans.length) {
      console.log('No migration plans found.');
      return;
    }
    printTable(
      ['plan_id', 'op', 'scope', 'risk', 'status', 'pages', 'created'],
      plans.map((plan) => [plan.plan_id, plan.operation_type, plan.scope, plan.risk_level, plan.status, plan.affected_count, (plan.created_at || '').slice(0, 10)])
    );
    return;
  }

  if (subcommand === 'plan') {
    const options = { from: {}, to: {}, filter: {} };
    let parsingFrom = false;
    let parsingTo = false;
    let parsingFilter = false;
    for (let index = 1; index < args.length; index += 1) {
      const token = args[index];
      switch (token) {
        case '--op':
          options.operation_type = args[index + 1] || '';
          index += 1;
          parsingFrom = false;
          parsingTo = false;
          parsingFilter = false;
          break;
        case '--scope':
          options.scope = args[index + 1] || '';
          index += 1;
          parsingFrom = false;
          parsingTo = false;
          parsingFilter = false;
          break;
        case '--reason':
          options.reason = args[index + 1] || '';
          index += 1;
          parsingFrom = false;
          parsingTo = false;
          parsingFilter = false;
          break;
        case '--from':
          parsingFrom = true;
          parsingTo = false;
          parsingFilter = false;
          break;
        case '--to':
          parsingTo = true;
          parsingFrom = false;
          parsingFilter = false;
          break;
        case '--filter':
          parsingFilter = true;
          parsingFrom = false;
          parsingTo = false;
          break;
        case '--json':
          break;
        default:
          if (token.includes('=')) {
            const eqIdx = token.indexOf('=');
            const key = token.slice(0, eqIdx);
            const val = token.slice(eqIdx + 1);
            if (parsingFrom) {
              options.from[key] = val;
            } else if (parsingTo) {
              options.to[key] = val;
            } else if (parsingFilter) {
              // coerce boolean strings
              options.filter[key] = val === 'true' ? true : val === 'false' ? false : val;
            }
          }
      }
    }
    if (!options.operation_type) {
      die(`migrate plan requires --op (one of: ${OPERATION_TYPES.join(', ')})`);
    }
    // Merge --filter entries into options.from so findMatchingPages receives them
    // e.g. --filter subtype_is_null=true → options.from.subtype_is_null = true
    if (options.filter && Object.keys(options.filter).length > 0) {
      options.from = Object.assign({}, options.from, options.filter);
    }
    try {
      const plan = createMigrationPlan(repoRoot, options);
      if (json) {
        printJsonResult('wiki.migrate.plan', repoRoot, { plan });
        return;
      }
      console.log(`Created migration plan: ${plan.plan_id}`);
      console.log(`  op: ${plan.operation_type}`);
      console.log(`  scope: ${plan.scope}`);
      console.log(`  risk: ${plan.risk_level}`);
      console.log(`  affected pages: ${plan.affected_page_paths.length}`);
      console.log(`  status: ${plan.status}`);
      console.log(`Next: wiki migrate dry-run ${plan.plan_id}`);
    } catch (error) {
      die(error.message);
    }
    return;
  }

  if (subcommand === 'dry-run') {
    const planId = args[1];
    if (!planId) {
      die('migrate dry-run requires PLAN_ID');
    }
    try {
      const report = dryRunMigrationPlan(repoRoot, planId);
      if (json) {
        printJsonResult('wiki.migrate.dry-run', repoRoot, { report });
        return;
      }
      console.log(`Dry-run: ${planId}`);
      console.log(`  operation: ${report.operation_type}`);
      console.log(`  affected: ${report.affected_count} pages`);
      console.log(`  path changes: ${report.path_changes.length}`);
      console.log(`  taxonomy changes: ${report.taxonomy_changes.length}`);
      console.log(`  aliases needed: ${report.aliases_needed.length}`);
      console.log(`  risk: ${report.risk_level}`);
      if (report.path_changes.length) {
        console.log('  Path changes:');
        report.path_changes.slice(0, 5).forEach((item) => console.log(`    ${item.old_path} -> ${item.new_path}`));
        if (report.path_changes.length > 5) {
          console.log(`    ... and ${report.path_changes.length - 5} more`);
        }
      }
      console.log(`Next: wiki migrate apply ${planId}`);
    } catch (error) {
      die(error.message);
    }
    return;
  }

  if (subcommand === 'apply') {
    const planId = args[1];
    if (!planId) {
      die('migrate apply requires PLAN_ID');
    }
    const force = hasFlag(args, '--force');
    try {
      const result = applyMigrationPlan(repoRoot, planId, { force });
      if (json) {
        printJsonResult('wiki.migrate.apply', repoRoot, { result });
        return;
      }
      console.log(`Applied migration: ${planId}`);
      console.log(`  changed pages: ${result.applied}`);
    } catch (error) {
      die(error.message);
    }
    return;
  }

  if (subcommand === 'rollback') {
    const planId = args[1];
    if (!planId) {
      die('migrate rollback requires PLAN_ID');
    }
    try {
      const result = rollbackMigrationPlan(repoRoot, planId);
      if (json) {
        printJsonResult('wiki.migrate.rollback', repoRoot, { result });
        return;
      }
      console.log(`Rolled back: ${planId}`);
      console.log(`  restored pages: ${result.rolled_back}`);
    } catch (error) {
      die(error.message);
    }
    return;
  }

  if (subcommand === 'show') {
    const planId = args[1];
    if (!planId) {
      die('migrate show requires PLAN_ID');
    }
    try {
      const plan = loadPlan(repoRoot, planId);
      if (json) {
        printJsonResult('wiki.migrate.show', repoRoot, { plan });
        return;
      }
      console.log(JSON.stringify(plan, null, 2));
    } catch (error) {
      die(error.message);
    }
    return;
  }

  die(`unknown subcommand for migrate: ${subcommand}`);
}

function printGuide(configPath) {
  const repoRoot = resolveRepoRoot(configPath, '');
  console.log('Minimal mental model:');
  console.log(`1. Outside a repo, use ${COMMAND_NAME} to choose/create the workspace repo.`);
  console.log('2. Inside a repo, use /wiki for semantic work.');
  console.log(`3. Use ${COMMAND_NAME} only for deterministic queue work: status / check / taxonomy / review / apply / resolve.`);
  console.log(`4. If you need structured runtime hooks, use ${COMMAND_NAME} ask / import / maintain.`);
  if (repoRoot) {
    console.log(`Current repo: ${repoRoot}`);
  }
}

function parseNamedOption(args, index, flag) {
  if (index + 1 >= args.length) {
    die(`${flag} requires a value`);
  }
  return args[index + 1];
}

function runSetup(configPath, args) {
  if (args.length !== 3) {
    die('usage: wiki setup NAMESPACE BASE_PATH');
  }
  const namespace = args[1];
  const basePath = args[2];
  try {
    const resolvedBasePath = setNamespace(configPath, namespace, basePath);
    setDefaultNamespace(configPath, namespace);
    console.log(`Setup complete: ${namespace}=${resolvedBasePath}`);
    console.log(`Default namespace: ${namespace}`);
  } catch (error) {
    die(error.message);
  }
}

function runUse(configPath, args) {
  if (args.length < 2) {
    die('usage: wiki use REPO_REF [--namespace NAME]');
  }
  const repoRef = args[1];
  let namespace = '';
  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--namespace') {
      namespace = parseNamedOption(args, index, '--namespace');
      index += 1;
      continue;
    }
    die(`unknown option for use: ${token}`);
  }
  try {
    const repoPath = resolveRepoPath(configPath, repoRef, namespace);
    if (!fs.existsSync(path.join(repoPath, '.wiki'))) {
      die(`not a wiki repo: ${repoPath}`);
    }
    setCurrentRepo(configPath, repoPath);
    console.log(repoPath);
  } catch (error) {
    die(error.message);
  }
}

function runWhere(configPath, args) {
  let namespace = '';
  let repoRef = '';
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--namespace') {
      namespace = parseNamedOption(args, index, '--namespace');
      index += 1;
      continue;
    }
    if (!repoRef) {
      repoRef = token;
      continue;
    }
    die(`unknown option for where: ${token}`);
  }

  try {
    const resolved = repoRef ? resolveRepoPath(configPath, repoRef, namespace) : readCurrentRepo(configPath);
    if (!resolved) {
      die(`no active wiki repo. Run '${COMMAND_NAME} use <repo>' or cd into a wiki repo first.`);
    }
    console.log(resolved);
  } catch (error) {
    die(error.message);
  }
}

function printNamespaceStatus(configPath) {
  ensureConfigFile(configPath);
  const config = readNamespaceConfig(configPath);
  console.log(`Config file: ${configPath}`);
  console.log(`Default namespace: ${config.defaultNamespace || '(none)'}`);
  console.log('Namespaces:');
  if (!config.namespaces.length) {
    console.log('  (no namespaces configured)');
    return;
  }
  config.namespaces.forEach((entry) => {
    console.log(`  ${entry.name}=${entry.path}`);
  });
}

function runLifecycleStatus(configPath) {
  const currentRepo = readCurrentRepo(configPath);
  const config = readNamespaceConfig(configPath);
  return {
    config_path: configPath,
    default_namespace: config.defaultNamespace || null,
    namespaces: config.namespaces,
    current_repo: currentRepo || null,
    knowledge_front_door: currentRepo && fs.existsSync(path.join(currentRepo, '.wiki')) ? '/wiki' : null,
    suggested_next_step: currentRepo ? `cd "$(${COMMAND_NAME} where)"` : null,
    repo_health: currentRepo && !fs.existsSync(path.join(currentRepo, '.wiki')) ? 'missing .wiki directory' : 'ok',
  };
}

function runNew(configPath, args) {
  if (args.length < 2) {
    die('usage: wiki new REPO_DIR [--name DISPLAY_NAME] [--namespace NAME] [--force]');
  }
  let namespace = '';
  let force = false;
  let repoName = '';
  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    switch (token) {
      case '--name':
        repoName = parseNamedOption(args, index, '--name');
        index += 1;
        break;
      case '--namespace':
        namespace = parseNamedOption(args, index, '--namespace');
        index += 1;
        break;
      case '--force':
        force = true;
        break;
      default:
        die(`unknown option for new: ${token}`);
    }
  }

  const targetArg = args[1];
  try {
    const result = scaffoldRepo({
      repoRoot: path.resolve(__dirname, '..'),
      configPath,
      targetDir: targetArg,
      repoName,
      namespace,
      force,
    });
    setCurrentRepo(configPath, result.targetDir);
    console.log(`Scaffolded new wiki repository at: ${result.targetDir}`);
    console.log(`Current repo: ${result.targetDir}`);
  } catch (error) {
    die(error.message);
  }
}

function run(argv) {
  const parsed = parseGlobalOptions(argv);
  const { configPath, repoOverride, args } = parsed;
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    usage();
    return;
  }

  switch (subcommand) {
    case 'setup':
      runSetup(configPath, args);
      return;
    case 'new':
      runNew(configPath, args);
      return;
    case 'use':
      runUse(configPath, args);
      return;
    case 'where':
      runWhere(configPath, args);
      return;
    case 'status':
      if (repoOverride || resolveRepoRoot(configPath, '')) {
        const result = printStatus(configPath, repoOverride);
        if (hasFlag(args.slice(1), '--json')) {
          printJsonResult('wiki.status.result', result.repo, result);
          return;
        }
        console.log(`Repo: ${result.repo}`);
        if (result.workspace) {
          console.log(`Workspace: ${result.workspace}`);
        }
        console.log(`Review queue: ${result.review_queue}`);
        console.log(`Apply queue: ${result.apply_queue}`);
        console.log(`Resolve queue: ${result.resolve_queue}`);
        console.log(`Next: ${result.next}`);
      } else {
        const result = runLifecycleStatus(configPath);
        if (hasFlag(args.slice(1), '--json')) {
          printJsonResult('wiki.lifecycle-status.result', result.current_repo, result);
          return;
        }
        console.log(`Config file: ${result.config_path}`);
        console.log(`Default namespace: ${result.default_namespace || '(none)'}`);
        console.log('Namespaces:');
        if (!result.namespaces.length) {
          console.log('  (no namespaces configured)');
        } else {
          result.namespaces.forEach((entry) => console.log(`  ${entry.name}=${entry.path}`));
        }
        console.log(`Current repo: ${result.current_repo || '(none)'}`);
        if (result.knowledge_front_door) {
          console.log(`Knowledge front door: ${result.knowledge_front_door}`);
          console.log(`Suggested next step: ${result.suggested_next_step}`);
        } else if (result.repo_health !== 'ok') {
          console.log(`Current repo health: ${result.repo_health}`);
        }
      }
      return;
    case 'guide':
      printGuide(configPath);
      return;
    case 'check':
      runCheck(configPath, repoOverride, args.slice(1));
      return;
    case 'ask':
      runAsk(configPath, repoOverride, args.slice(1));
      return;
    case 'import':
      runImport(configPath, repoOverride, args.slice(1));
      return;
    case 'maintain':
      runMaintain(configPath, repoOverride, args.slice(1));
      return;
    case 'taxonomy':
      runTaxonomy(configPath, repoOverride, args.slice(1));
      return;
    case 'review':
      runReview(configPath, repoOverride, args.slice(1));
      return;
    case 'apply':
      runApply(configPath, repoOverride, args.slice(1));
      return;
    case 'resolve':
      runResolve(configPath, repoOverride, args.slice(1));
      return;
    case 'migrate':
      runMigrate(configPath, repoOverride, args.slice(1));
      return;
    case 'internal':
      try {
        const repoRoot = ensureRepoRoot(configPath, repoOverride);
        const result = runInternalCommand(repoRoot, args.slice(1));
        if (typeof result === 'object') {
          console.log(JSON.stringify(result, null, 2));
        } else if (result !== undefined) {
          console.log(result);
        }
      } catch (error) {
        die(error.message);
      }
      return;
    default:
      die(`unknown subcommand: ${subcommand}`);
  }
}

module.exports = { run };
