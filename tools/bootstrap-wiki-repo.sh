#!/usr/bin/env bash

set -euo pipefail

COMMAND_NAME="${BOOTSTRAP_COMMAND_NAME:-$(basename -- "$0")}"

usage() {
  cat <<EOF
Usage:
  ${COMMAND_NAME} TARGET_DIR [--name REPO_NAME] [--namespace NAME] [--config PATH] [--force]
  ${COMMAND_NAME} --setup NAME BASE_PATH [--config PATH]
  ${COMMAND_NAME} --set-namespace NAME BASE_PATH [--config PATH]
  ${COMMAND_NAME} --set-default-namespace NAME [--config PATH]
  ${COMMAND_NAME} --clear-default-namespace [--config PATH]
  ${COMMAND_NAME} --remove-namespace NAME [--config PATH]
  ${COMMAND_NAME} --status [--config PATH]
  ${COMMAND_NAME} --list-namespaces [--config PATH]
  ${COMMAND_NAME} --show-config [--config PATH]
  ${COMMAND_NAME} --guide [--config PATH]

Creates a fresh LLM Wiki repository scaffold without copying the current repo's
canon knowledge, sources, proposals, or experiment results.

Options:
  --name            Human-readable repository name written into starter files
  --namespace       Resolve TARGET_DIR under a configured namespace base path
  --config          Override the namespace config file path
  --setup           Register namespace => base path and set it as default
  --set-namespace   Register namespace => base path
  --set-default-namespace Mark one namespace as the default namespace
  --clear-default-namespace Remove the default namespace mapping
  --remove-namespace Remove a namespace mapping
  --status          Print config path, default namespace, and namespace mappings
  --list-namespaces Print configured namespace mappings
  --show-config     Print the current namespace config file path
  --guide           Print the minimal recommended usage flow
  --force           Allow scaffolding into an existing non-empty directory
  -h                Show this help message
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

DEFAULT_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-wiki-toolkit"
CONFIG_PATH="${DEFAULT_CONFIG_DIR}/namespaces.conf"
CONFIG_DIR="${DEFAULT_CONFIG_DIR}"

ensure_config_file() {
  mkdir -p "$CONFIG_DIR"
  if [ ! -f "$CONFIG_PATH" ]; then
    cat > "$CONFIG_PATH" <<'EOF'
# LLM Wiki namespace config
# format: namespace=/absolute/path
# special key: default_namespace=work
EOF
  fi
}

validate_namespace() {
  case "$1" in
    ''|*[!A-Za-z0-9._-]*)
      die "invalid namespace: $1 (allowed: letters, digits, dot, underscore, dash)"
      ;;
  esac
}

normalize_namespace_path() {
  case "$1" in
    ~/*)
      printf '%s\n' "$HOME/${1#~/}"
      ;;
    /*)
      printf '%s\n' "$1"
      ;;
    *)
      die "namespace path must be absolute: $1"
      ;;
  esac
}

set_namespace() {
  local namespace="$1"
  local base_path="$2"
  local tmp_file

  validate_namespace "$namespace"
  base_path="$(normalize_namespace_path "$base_path")"
  ensure_config_file

  tmp_file="$(mktemp "${CONFIG_PATH}.tmp.XXXXXX")"
  grep -v "^${namespace}=" "$CONFIG_PATH" > "$tmp_file" || true
  printf '%s=%s\n' "$namespace" "$base_path" >> "$tmp_file"
  mv "$tmp_file" "$CONFIG_PATH"
}

remove_namespace() {
  local namespace="$1"
  local tmp_file

  validate_namespace "$namespace"
  ensure_config_file

  tmp_file="$(mktemp "${CONFIG_PATH}.tmp.XXXXXX")"
  grep -v "^${namespace}=" "$CONFIG_PATH" > "$tmp_file" || true
  mv "$tmp_file" "$CONFIG_PATH"
}

lookup_namespace_path() {
  local namespace="$1"
  local line

  validate_namespace "$namespace"
  [ -f "$CONFIG_PATH" ] || return 1

  while IFS= read -r line; do
    case "$line" in
      ''|\#*)
        continue
        ;;
      "${namespace}"=*)
        printf '%s\n' "${line#*=}"
        return 0
        ;;
    esac
  done < "$CONFIG_PATH"

  return 1
}

get_default_namespace() {
  local line

  [ -f "$CONFIG_PATH" ] || return 1

  while IFS= read -r line; do
    case "$line" in
      ''|\#*)
        continue
        ;;
      default_namespace=*)
        printf '%s\n' "${line#*=}"
        return 0
        ;;
    esac
  done < "$CONFIG_PATH"

  return 1
}

set_default_namespace() {
  local namespace="$1"
  local tmp_file

  validate_namespace "$namespace"
  ensure_config_file
  lookup_namespace_path "$namespace" >/dev/null 2>&1 || die "namespace '${namespace}' is not configured"

  tmp_file="$(mktemp "${CONFIG_PATH}.tmp.XXXXXX")"
  grep -v '^default_namespace=' "$CONFIG_PATH" > "$tmp_file" || true
  printf 'default_namespace=%s\n' "$namespace" >> "$tmp_file"
  mv "$tmp_file" "$CONFIG_PATH"
}

clear_default_namespace() {
  local tmp_file

  ensure_config_file
  tmp_file="$(mktemp "${CONFIG_PATH}.tmp.XXXXXX")"
  grep -v '^default_namespace=' "$CONFIG_PATH" > "$tmp_file" || true
  mv "$tmp_file" "$CONFIG_PATH"
}

list_namespaces() {
  local line
  local found=0
  local default_namespace

  ensure_config_file
  echo "Namespace config: $CONFIG_PATH"
  default_namespace="$(get_default_namespace || true)"
  if [ -n "$default_namespace" ]; then
    echo "default_namespace=$default_namespace"
  fi

  while IFS= read -r line; do
    case "$line" in
      ''|\#*|default_namespace=*)
        continue
        ;;
      *)
        printf '%s\n' "$line"
        found=1
        ;;
    esac
  done < "$CONFIG_PATH"

  if [ "$found" -eq 0 ]; then
    echo "(no namespaces configured)"
  fi
}

print_status() {
  local line
  local found=0
  local default_namespace

  ensure_config_file
  default_namespace="$(get_default_namespace || true)"

  echo "Config file: $CONFIG_PATH"
  if [ -n "$default_namespace" ]; then
    echo "Default namespace: $default_namespace"
  else
    echo "Default namespace: (none)"
  fi
  echo "Namespaces:"

  while IFS= read -r line; do
    case "$line" in
      ''|\#*|default_namespace=*)
        continue
        ;;
      *)
        echo "  $line"
        found=1
        ;;
    esac
  done < "$CONFIG_PATH"

  if [ "$found" -eq 0 ]; then
    echo "  (no namespaces configured)"
  fi
}

print_guide() {
  cat <<EOF
Minimal mental model:
  1. Remember one command: ${COMMAND_NAME}
  2. Run one setup command once
  3. After that, daily usage is just one command + one repo name

Recommended flow:
  ${COMMAND_NAME} --setup work /data/wiki/work
  ${COMMAND_NAME} my-new-repo --name "My New Wiki"

If you need multiple namespaces:
  ${COMMAND_NAME} --set-namespace personal /data/wiki/personal
  ${COMMAND_NAME} --namespace personal private-repo --name "Private Wiki"

Useful checks:
  ${COMMAND_NAME} --status
  ${COMMAND_NAME} --list-namespaces
  ${COMMAND_NAME} --show-config

After the repo is created, the main knowledge distillation flow is inside the repo:
  /wiki 请吸收这段资料
  /wiki 帮我整理这批知识并补缺口
  /wiki 这个结论的依据是什么？请展开细节

The /wiki entry is the front door for:
  ingest / distill / reconcile / refresh / maintain / query

Config file:
  ${CONFIG_PATH}
EOF
}

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
SCRIPT_PATH="${SCRIPT_DIR}/$(basename -- "${BASH_SOURCE[0]}")"

TARGET_DIR=""
REPO_NAME=""
FORCE=0
NAMESPACE=""
LIST_NAMESPACES=0
SHOW_CONFIG=0
SET_NAMESPACE_NAME=""
SET_NAMESPACE_PATH=""
REMOVE_NAMESPACE_NAME=""
SET_DEFAULT_NAMESPACE_NAME=""
CLEAR_DEFAULT_NAMESPACE=0
GUIDE=0
SETUP_NAMESPACE_NAME=""
SETUP_NAMESPACE_PATH=""
STATUS=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      shift
      [ "$#" -gt 0 ] || die "--name requires a value"
      REPO_NAME="$1"
      ;;
    --namespace)
      shift
      [ "$#" -gt 0 ] || die "--namespace requires a value"
      NAMESPACE="$1"
      ;;
    --config)
      shift
      [ "$#" -gt 0 ] || die "--config requires a value"
      CONFIG_PATH="$1"
      CONFIG_DIR="$(dirname -- "$CONFIG_PATH")"
      ;;
    --setup)
      shift
      [ "$#" -gt 1 ] || die "--setup requires NAME and BASE_PATH"
      SETUP_NAMESPACE_NAME="$1"
      shift
      [ "$#" -gt 0 ] || die "--setup requires BASE_PATH"
      SETUP_NAMESPACE_PATH="$1"
      ;;
    --set-namespace)
      shift
      [ "$#" -gt 1 ] || die "--set-namespace requires NAME and BASE_PATH"
      SET_NAMESPACE_NAME="$1"
      shift
      [ "$#" -gt 0 ] || die "--set-namespace requires BASE_PATH"
      SET_NAMESPACE_PATH="$1"
      ;;
    --set-default-namespace)
      shift
      [ "$#" -gt 0 ] || die "--set-default-namespace requires NAME"
      SET_DEFAULT_NAMESPACE_NAME="$1"
      ;;
    --clear-default-namespace)
      CLEAR_DEFAULT_NAMESPACE=1
      ;;
    --remove-namespace)
      shift
      [ "$#" -gt 0 ] || die "--remove-namespace requires NAME"
      REMOVE_NAMESPACE_NAME="$1"
      ;;
    --list-namespaces)
      LIST_NAMESPACES=1
      ;;
    --show-config)
      SHOW_CONFIG=1
      ;;
    --status)
      STATUS=1
      ;;
    --guide)
      GUIDE=1
      ;;
    --force)
      FORCE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      die "unknown option: $1"
      ;;
    *)
      if [ -z "$TARGET_DIR" ]; then
        TARGET_DIR="$1"
      else
        die "unexpected argument: $1"
      fi
      ;;
  esac
  shift
done

if [ "$SHOW_CONFIG" -eq 1 ]; then
  ensure_config_file
  echo "$CONFIG_PATH"
  exit 0
fi

if [ "$GUIDE" -eq 1 ]; then
  ensure_config_file
  print_guide
  exit 0
fi

if [ "$STATUS" -eq 1 ]; then
  ensure_config_file
  print_status
  exit 0
fi

if [ -n "$SETUP_NAMESPACE_NAME" ]; then
  set_namespace "$SETUP_NAMESPACE_NAME" "$SETUP_NAMESPACE_PATH"
  set_default_namespace "$SETUP_NAMESPACE_NAME"
  echo "Setup complete: ${SETUP_NAMESPACE_NAME}=$(lookup_namespace_path "$SETUP_NAMESPACE_NAME")"
  echo "Default namespace: $SETUP_NAMESPACE_NAME"
  echo "Config file: $CONFIG_PATH"
  exit 0
fi

if [ -n "$SET_NAMESPACE_NAME" ]; then
  set_namespace "$SET_NAMESPACE_NAME" "$SET_NAMESPACE_PATH"
  echo "Configured namespace: ${SET_NAMESPACE_NAME}=$(lookup_namespace_path "$SET_NAMESPACE_NAME")"
  echo "Config file: $CONFIG_PATH"
  exit 0
fi

if [ -n "$SET_DEFAULT_NAMESPACE_NAME" ]; then
  set_default_namespace "$SET_DEFAULT_NAMESPACE_NAME"
  echo "Configured default namespace: $SET_DEFAULT_NAMESPACE_NAME"
  echo "Config file: $CONFIG_PATH"
  exit 0
fi

if [ "$CLEAR_DEFAULT_NAMESPACE" -eq 1 ]; then
  clear_default_namespace
  echo "Cleared default namespace"
  echo "Config file: $CONFIG_PATH"
  exit 0
fi

if [ -n "$REMOVE_NAMESPACE_NAME" ]; then
  CURRENT_DEFAULT_NAMESPACE="$(get_default_namespace || true)"
  remove_namespace "$REMOVE_NAMESPACE_NAME"
  if [ "$CURRENT_DEFAULT_NAMESPACE" = "$REMOVE_NAMESPACE_NAME" ]; then
    clear_default_namespace
    echo "Removed namespace: $REMOVE_NAMESPACE_NAME (default namespace cleared)"
  else
    echo "Removed namespace: $REMOVE_NAMESPACE_NAME"
  fi
  echo "Config file: $CONFIG_PATH"
  exit 0
fi

if [ "$LIST_NAMESPACES" -eq 1 ]; then
  list_namespaces
  exit 0
fi

[ -n "$TARGET_DIR" ] || {
  usage >&2
  exit 1
}

[ -n "$REPO_NAME" ] || REPO_NAME="$(basename -- "$TARGET_DIR")"

RESOLVED_NAMESPACE="$NAMESPACE"
if [ -z "$RESOLVED_NAMESPACE" ] && [ "${TARGET_DIR#/}" = "$TARGET_DIR" ]; then
  RESOLVED_NAMESPACE="$(get_default_namespace || true)"
fi

if [ -n "$RESOLVED_NAMESPACE" ]; then
  NAMESPACE_BASE_PATH="$(lookup_namespace_path "$RESOLVED_NAMESPACE" || true)"
  [ -n "$NAMESPACE_BASE_PATH" ] || die "namespace '${RESOLVED_NAMESPACE}' is not configured. Config file: $CONFIG_PATH"
  case "$TARGET_DIR" in
    /*)
      die "TARGET_DIR must be relative when --namespace is used"
      ;;
  esac
  TARGET_DIR="${NAMESPACE_BASE_PATH%/}/${TARGET_DIR}"
fi

if [ -e "$TARGET_DIR" ] && [ "$FORCE" -ne 1 ]; then
  if [ -n "$(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ]; then
    die "target directory exists and is not empty; use --force to continue"
  fi
fi

TODAY="$(date '+%Y-%m-%d')"

mkdir -p \
  "$TARGET_DIR/.claude/skills" \
  "$TARGET_DIR/.wiki/canon/domains" \
  "$TARGET_DIR/.wiki/changes/approved" \
  "$TARGET_DIR/.wiki/changes/inbox" \
  "$TARGET_DIR/.wiki/changes/rejected" \
  "$TARGET_DIR/.wiki/changes/review" \
  "$TARGET_DIR/.wiki/policy/schemas" \
  "$TARGET_DIR/.wiki/policy/specs" \
  "$TARGET_DIR/.wiki/policy/templates" \
  "$TARGET_DIR/.wiki/sources/articles" \
  "$TARGET_DIR/.wiki/sources/conversations" \
  "$TARGET_DIR/.wiki/sources/notes" \
  "$TARGET_DIR/.wiki/sources/references" \
  "$TARGET_DIR/evaluation/benchmark/fixtures/templates" \
  "$TARGET_DIR/evaluation/protocols" \
  "$TARGET_DIR/evaluation/results" \
  "$TARGET_DIR/tools"

for file in "$REPO_ROOT"/.claude/skills/*.md; do
  cp "$file" "$TARGET_DIR/.claude/skills/"
done

for file in "$REPO_ROOT"/.wiki/policy/specs/*.md; do
  cp "$file" "$TARGET_DIR/.wiki/policy/specs/"
done

for file in "$REPO_ROOT"/.wiki/policy/schemas/*.md; do
  cp "$file" "$TARGET_DIR/.wiki/policy/schemas/"
done

for file in "$REPO_ROOT"/.wiki/policy/templates/*.md; do
  cp "$file" "$TARGET_DIR/.wiki/policy/templates/"
done

cp "$REPO_ROOT/evaluation/protocols/rater-consistency-protocol.md" \
  "$TARGET_DIR/evaluation/protocols/"
cp "$REPO_ROOT/evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md" \
  "$TARGET_DIR/evaluation/benchmark/fixtures/templates/"
cp "$SCRIPT_PATH" "$TARGET_DIR/tools/bootstrap-wiki-repo.sh"
cp "$REPO_ROOT/tools/install-global.sh" "$TARGET_DIR/tools/install-global.sh"
cp "$REPO_ROOT/tools/wiki.sh" "$TARGET_DIR/tools/wiki.sh"
cp "$REPO_ROOT/tools/wiki-ops.sh" "$TARGET_DIR/tools/wiki-ops.sh"
chmod +x "$TARGET_DIR/tools/bootstrap-wiki-repo.sh"
chmod +x "$TARGET_DIR/tools/install-global.sh"
chmod +x "$TARGET_DIR/tools/wiki.sh"
chmod +x "$TARGET_DIR/tools/wiki-ops.sh"

cat > "$TARGET_DIR/README.md" <<EOF
# ${REPO_NAME}

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
  policy/                   # spec / schema / state / log
evaluation/                 # 评测协议与结果目录
tools/bootstrap-wiki-repo.sh
tools/install-global.sh
tools/wiki.sh
tools/wiki-ops.sh              # 确定性操作 CLI 工具层
\`\`\`

## 搭建下一套仓库

这个仓库本身也带有建仓工具。  
如果你要继续搭建另一套同类仓库：

\`\`\`bash
tools/bootstrap-wiki-repo.sh ../another-wiki --name "Another Wiki"
\`\`\`

或者在支持 repo-local skills 的环境里使用：

\`\`\`text
/wiki-bootstrap ../another-wiki --name "Another Wiki"
\`\`\`

## 全局安装（可选）

如果你不想每次都进入 repo 再执行脚本，可以把这个工具包安装成全局命令：

\`\`\`bash
tools/install-global.sh
\`\`\`

安装完成后直接执行：

\`\`\`bash
wiki setup work /data/wiki/work
wiki new another-wiki --name "Another Wiki"
\`\`\`

查看当前上下文：

\`\`\`bash
wiki status
\`\`\`

定位当前选中的 repo：

\`\`\`bash
cd "\$(wiki where)"
\`\`\`

## Namespace（可选）

全局命令支持 namespace 路径映射。  
默认配置文件：

\`\`\`text
${CONFIG_PATH}
\`\`\`

例如，先配置：

\`\`\`bash
wiki setup work /data/wiki/work
wiki bootstrap --set-namespace personal /data/wiki/personal
\`\`\`

如果你想把认知负担压到最低，再设一个默认 namespace：

\`\`\`bash
wiki bootstrap --set-default-namespace work
\`\`\`

或者更直接，用一条命令同时完成：

\`\`\`bash
wiki setup work /data/wiki/work
\`\`\`

之后就可以直接：

\`\`\`bash
wiki new new-repo --name "Work Wiki"
\`\`\`

查看当前 namespace：

\`\`\`bash
wiki status
\`\`\`

之后可以直接按 namespace 建仓：

\`\`\`bash
wiki new new-repo --namespace work --name "Work Wiki"
\`\`\`

如果你想看最短使用说明：

\`\`\`bash
wiki guide
\`\`\`

如果你想查看当前配置状态：

\`\`\`bash
wiki status
\`\`\`

\`wiki-bootstrap\` 现在只保留为兼容别名；对普通使用者，主入口应视为 \`wiki\`。

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
EOF

cat > "$TARGET_DIR/.wiki/policy/STATE.md" <<EOF
---
type: state
version: 1.0
updated_at: ${TODAY}
---

# ${REPO_NAME} 系统状态

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
EOF

cat > "$TARGET_DIR/.wiki/policy/LOG.md" <<EOF
---
type: log
version: 1.0
started_at: ${TODAY}
---

# 操作日志

## 格式

每条记录格式：\`[时间] [操作类型] [详情]\`

## 日志

- [${TODAY}] [system] ${REPO_NAME} 初始化完成
EOF

cat > "$TARGET_DIR/.wiki/changes/LOG.md" <<EOF
---
type: log
version: 1.0
started_at: ${TODAY}
---

# 变更日志

## 格式

每条记录格式：\`[时间] [变更类型] [详情]\`

## 日志

- [${TODAY}] [system] 变更区初始化完成
EOF

cat > "$TARGET_DIR/.wiki/canon/_index.md" <<EOF
---
type: index
title: Canon Index
updated_at: ${TODAY}
status: active
---

# Canon Index

当前暂无活跃领域。

## 领域

- 暂无
EOF

cat > "$TARGET_DIR/evaluation/README.md" <<EOF
# Evaluation

这里保留的是可复用的评测骨架，而不是当前示例仓的实验结果。

已初始化内容：

- \`evaluation/protocols/rater-consistency-protocol.md\`
- \`evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md\`
- \`evaluation/results/\`
EOF

touch \
  "$TARGET_DIR/.wiki/canon/domains/.gitkeep" \
  "$TARGET_DIR/.wiki/changes/approved/.gitkeep" \
  "$TARGET_DIR/.wiki/changes/inbox/.gitkeep" \
  "$TARGET_DIR/.wiki/changes/rejected/.gitkeep" \
  "$TARGET_DIR/.wiki/changes/review/.gitkeep" \
  "$TARGET_DIR/.wiki/sources/articles/.gitkeep" \
  "$TARGET_DIR/.wiki/sources/conversations/.gitkeep" \
  "$TARGET_DIR/.wiki/sources/notes/.gitkeep" \
  "$TARGET_DIR/.wiki/sources/references/.gitkeep" \
  "$TARGET_DIR/evaluation/results/.gitkeep"

echo "Scaffolded new wiki repository at: $TARGET_DIR"
echo "Default entry: /wiki"
echo "Repo lifecycle command after global install: wiki"
echo "Legacy bootstrap skill: /wiki-bootstrap"
echo "Global install helper: tools/install-global.sh"
echo "Namespace config: $CONFIG_PATH"
