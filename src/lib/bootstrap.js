'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CONFIG_PATH,
  ensureConfigFile,
  lookupNamespacePath,
  readNamespaceConfig,
} = require('./config');

function resolveRepoTarget(configPath, targetDir, namespace = '') {
  if (namespace) {
    const basePath = lookupNamespacePath(configPath, namespace);
    if (!basePath) {
      throw new Error(`namespace '${namespace}' is not configured. Config file: ${configPath}`);
    }
    if (path.isAbsolute(targetDir)) {
      throw new Error('TARGET_DIR must be relative when --namespace is used');
    }
    return path.join(basePath, targetDir);
  }

  if (path.isAbsolute(targetDir)) {
    return targetDir;
  }

  const config = readNamespaceConfig(configPath);
  if (config.defaultNamespace) {
    const basePath = lookupNamespacePath(configPath, config.defaultNamespace);
    if (!basePath) {
      throw new Error(`default namespace '${config.defaultNamespace}' is not configured. Config file: ${configPath}`);
    }
    return path.join(basePath, targetDir);
  }
  return path.resolve(process.cwd(), targetDir);
}

function ensureEmptyOrForced(targetDir, force) {
  if (!fs.existsSync(targetDir)) {
    return;
  }
  const entries = fs.readdirSync(targetDir);
  if (!force) {
    if (entries.length > 0) {
      throw new Error('target directory exists and is not empty; use --force to continue');
    }
    return;
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
}

function copyTree(sourceDir, destinationDir) {
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function touch(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}

function createReadme(repoName, configPath) {
  return `# ${repoName}

## 推荐入口（默认）

\`\`\`text
/wiki {你的问题 / 资料 / 整理请求}
\`\`\`

仓库中的默认前台入口已经就绪：

- \`.claude/skills/wiki.md\`
- \`.wiki/policy/specs/wiki.md\`

\`/wiki\` 会自动判断你是在：

- 提问（走 query）
- 贴资料（走 ingest）
- 请求整理（走 reconcile / refresh / maintain）
- 要看细节（附加 audit 展示）

如果你明确说“看依据 / 展开细节 / 看 proposal / 看内部路由”，系统会在主结果后附加 audit 视图。  
如果本次处理自动触发了补缺、proposal、后台维护或风险提醒，系统会附加一个很短的后台摘要。

## 初始仓结构

\`\`\`
.claude/skills/             # 前台 skill 入口
.wiki/
  sources/                  # 原始资料
  canon/                    # 权威知识
  changes/                  # 变更提案
  runtime/                  # SQLite 运行态索引
  policy/                   # spec / schema / state / log
evaluation/                 # 评测协议与结果目录
package.json
src/
tools/install-global.sh
tools/wiki.js               # 唯一公开 CLI 入口
\`\`\`

## 创建下一套仓库

这个仓库本身也带有建仓能力，但公开入口只有一个命令：\`wiki\`。

先全局安装：

\`\`\`bash
tools/install-global.sh
\`\`\`

然后只用这组命令：

\`\`\`bash
wiki setup work /data/wiki/work
wiki new another-wiki --name "Another Wiki"
cd "\$(wiki where)"
wiki status
\`\`\`

默认配置文件：

\`\`\`text
${configPath}
\`\`\`

如果你想查看最短使用说明：

\`\`\`bash
wiki guide
\`\`\`

如果你想处理确定性队列任务，优先记这几个命令：

\`\`\`bash
wiki check
wiki review
wiki apply
wiki resolve
\`\`\`

如果你是在给 agent 或 \`/wiki\` 做结构化运行时协作，补充记这三条 workflow contract：

\`\`\`bash
wiki ask "你的问题" --json
wiki import --input payload.json --json
wiki maintain --json
\`\`\`

## 最短知识编译 / 蒸馏流程

建仓不是终点。  
进入新仓后，真正的主流程是：

\`\`\`text
/wiki 请吸收这段资料
/wiki 帮我整理这批知识并补缺口
/wiki 这个结论的依据是什么？请展开细节
\`\`\`

\`/wiki\` 会在内部自动路由到：

- ingest
- distill / organize
- reconcile / refresh / maintain
- query / audit

也就是说，**新仓的核心使用面不是 bootstrap，而是仓内的 \`/wiki\`。**

## 初始化状态

当前仓库是一个空白治理内核：

- 不包含当前示例仓的 canon 知识
- 不包含当前示例仓的 sources
- 不包含当前示例仓的 proposal
- 只复制可复用的 skill / spec / schema / 模板 / 评测协议骨架
`;
}

function createStateFile(repoName, today) {
  return `---
type: state
version: 1.0
updated_at: ${today}
---

# ${repoName} 系统状态

## 统计

- total_sources: 0
- total_canon_pages: 0
- total_domains: 0
- pending_proposals: 0
- last_ingest: ~
- last_compile: ~
- last_promote_at: ~
- last_lint: ~

## 活跃领域

- 暂无

## 系统健康

- status: initializing
- last_lint_score: ~
- open_conflicts: 0

## 质量趋势

- confidence_distribution:
    high: 0
    medium: 0
    low: 0
- avg_staleness_days: 0
- archive_rate_30d: ~
- compile_rate_30d: ~
`;
}

function createLogFile(title, today, message) {
  return `---
type: log
version: 1.0
started_at: ${today}
---

# ${title}

## 格式

每条记录格式：\`[时间] [操作类型] [详情]\`

## 日志

- [${today}] [system] ${message}
`;
}

function scaffoldRepo(options) {
  const repoRoot = options.repoRoot;
  const configPath = options.configPath || DEFAULT_CONFIG_PATH;
  const targetDir = resolveRepoTarget(configPath, options.targetDir, options.namespace || '');
  const repoName = options.repoName || path.basename(targetDir);
  const today = new Date().toISOString().slice(0, 10);

  ensureConfigFile(configPath);
  ensureEmptyOrForced(targetDir, Boolean(options.force));

  fs.mkdirSync(targetDir, { recursive: true });
  const requiredDirs = [
    '.claude/skills',
    '.wiki/canon/domains',
    '.wiki/changes/approved',
    '.wiki/changes/inbox',
    '.wiki/changes/rejected',
    '.wiki/changes/review',
    '.wiki/policy/schemas',
    '.wiki/policy/specs',
    '.wiki/policy/templates',
    '.wiki/runtime',
    '.wiki/sources/articles',
    '.wiki/sources/conversations',
    '.wiki/sources/notes',
    '.wiki/sources/references',
    'evaluation/benchmark/fixtures/templates',
    'evaluation/protocols',
    'evaluation/results',
    'src/lib',
    'tools',
  ];
  requiredDirs.forEach((dir) => fs.mkdirSync(path.join(targetDir, dir), { recursive: true }));

  copyTree(path.join(repoRoot, '.claude/skills'), path.join(targetDir, '.claude/skills'));
  copyTree(path.join(repoRoot, '.wiki/policy/specs'), path.join(targetDir, '.wiki/policy/specs'));
  copyTree(path.join(repoRoot, '.wiki/policy/schemas'), path.join(targetDir, '.wiki/policy/schemas'));
  copyTree(path.join(repoRoot, '.wiki/policy/templates'), path.join(targetDir, '.wiki/policy/templates'));
  copyTree(path.join(repoRoot, 'evaluation/protocols'), path.join(targetDir, 'evaluation/protocols'));
  fs.copyFileSync(
    path.join(repoRoot, 'evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md'),
    path.join(targetDir, 'evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md')
  );
  ['.gitignore', 'package.json'].forEach((file) => fs.copyFileSync(path.join(repoRoot, file), path.join(targetDir, file)));
  fs.copyFileSync(path.join(repoRoot, 'src/bootstrap-cli.js'), path.join(targetDir, 'src/bootstrap-cli.js'));
  fs.copyFileSync(path.join(repoRoot, 'src/cli.js'), path.join(targetDir, 'src/cli.js'));
  ['bootstrap.js', 'config.js', 'frontmatter.js', 'runtime-index.js', 'utils.js', 'wiki-internal.js', 'wiki-repo.js'].forEach((file) =>
    fs.copyFileSync(path.join(repoRoot, 'src/lib', file), path.join(targetDir, 'src/lib', file))
  );
  ['bootstrap-wiki-repo.sh', 'install-global.sh', 'wiki.js'].forEach((file) => {
    fs.copyFileSync(path.join(repoRoot, 'tools', file), path.join(targetDir, 'tools', file));
    fs.chmodSync(path.join(targetDir, 'tools', file), 0o755);
  });

  writeFile(path.join(targetDir, 'README.md'), createReadme(repoName, configPath));
  writeFile(path.join(targetDir, '.wiki/policy/STATE.md'), createStateFile(repoName, today));
  writeFile(path.join(targetDir, '.wiki/policy/LOG.md'), createLogFile('操作日志', today, `${repoName} 初始化完成`));
  writeFile(path.join(targetDir, '.wiki/changes/LOG.md'), createLogFile('变更日志', today, '变更区初始化完成'));
  writeFile(
    path.join(targetDir, '.wiki/canon/_index.md'),
    `---\ntype: index\ntitle: Canon Index\nupdated_at: ${today}\nstatus: active\n---\n\n# Canon Index\n\n当前暂无活跃领域。\n\n## 领域\n\n- 暂无\n`
  );
  writeFile(
    path.join(targetDir, 'evaluation/README.md'),
    '# Evaluation\n\n这里保留的是可复用的评测骨架，而不是当前示例仓的实验结果。\n\n已初始化内容：\n\n- `evaluation/protocols/rater-consistency-protocol.md`\n- `evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md`\n- `evaluation/results/`\n'
  );

  [
    '.wiki/canon/domains/.gitkeep',
    '.wiki/changes/approved/.gitkeep',
    '.wiki/changes/inbox/.gitkeep',
    '.wiki/changes/rejected/.gitkeep',
    '.wiki/changes/review/.gitkeep',
    '.wiki/sources/articles/.gitkeep',
    '.wiki/sources/conversations/.gitkeep',
    '.wiki/sources/notes/.gitkeep',
    '.wiki/sources/references/.gitkeep',
    'evaluation/results/.gitkeep',
  ].forEach((file) => touch(path.join(targetDir, file)));

  return { targetDir, repoName, configPath };
}

function printNamespaceStatus(configPath = DEFAULT_CONFIG_PATH) {
  ensureConfigFile(configPath);
  const config = readNamespaceConfig(configPath);
  const lines = [
    `Config file: ${configPath}`,
    `Default namespace: ${config.defaultNamespace || '(none)'}`,
    'Namespaces:',
  ];
  if (!config.namespaces.length) {
    lines.push('  (no namespaces configured)');
  } else {
    config.namespaces.forEach((entry) => lines.push(`  ${entry.name}=${entry.path}`));
  }
  return lines.join('\n');
}

function listNamespaces(configPath = DEFAULT_CONFIG_PATH) {
  ensureConfigFile(configPath);
  const config = readNamespaceConfig(configPath);
  const lines = [`Namespace config: ${configPath}`];
  if (config.defaultNamespace) {
    lines.push(`default_namespace=${config.defaultNamespace}`);
  }
  if (!config.namespaces.length) {
    lines.push('(no namespaces configured)');
  } else {
    config.namespaces.forEach((entry) => lines.push(`${entry.name}=${entry.path}`));
  }
  return lines.join('\n');
}

module.exports = {
  listNamespaces,
  printNamespaceStatus,
  resolveRepoTarget,
  scaffoldRepo,
};
