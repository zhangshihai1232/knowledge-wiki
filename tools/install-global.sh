#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  tools/install-global.sh [--prefix PREFIX] [--main-name NAME] [--bin-name NAME] [--force]

Installs the reusable LLM Wiki toolkit into a global prefix and exposes:
1. a primary repo lifecycle command
2. an optional legacy bootstrap alias

Defaults:
  PREFIX   ~/.local
  MAIN     wiki
  NAME     wiki-bootstrap
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
CONFIG_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-wiki-toolkit"
CONFIG_PATH="${CONFIG_ROOT}/namespaces.conf"

PREFIX="${HOME}/.local"
MAIN_NAME="wiki"
BIN_NAME="wiki-bootstrap"
FORCE=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix)
      shift
      [ "$#" -gt 0 ] || die "--prefix requires a value"
      PREFIX="$1"
      ;;
    --main-name)
      shift
      [ "$#" -gt 0 ] || die "--main-name requires a value"
      MAIN_NAME="$1"
      ;;
    --bin-name)
      shift
      [ "$#" -gt 0 ] || die "--bin-name requires a value"
      BIN_NAME="$1"
      ;;
    --force)
      FORCE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
  shift
done

BIN_DIR="${PREFIX}/bin"
SHARE_DIR="${PREFIX}/share/knowledge-wiki-toolkit"
MAIN_COMMAND_PATH="${BIN_DIR}/${MAIN_NAME}"
ALIAS_COMMAND_PATH="${BIN_DIR}/${BIN_NAME}"

if [ "$FORCE" -eq 0 ]; then
  if [ -e "$MAIN_COMMAND_PATH" ]; then
    die "command already exists at ${MAIN_COMMAND_PATH}; use --force to overwrite"
  fi
  if [ "$ALIAS_COMMAND_PATH" != "$MAIN_COMMAND_PATH" ] && [ -e "$ALIAS_COMMAND_PATH" ]; then
    die "command already exists at ${ALIAS_COMMAND_PATH}; use --force to overwrite"
  fi
  if [ -d "$SHARE_DIR" ] && [ -n "$(find "$SHARE_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ]; then
    die "install root already exists at ${SHARE_DIR}; use --force to overwrite"
  fi
fi

if [ "$FORCE" -eq 1 ]; then
  rm -rf "$SHARE_DIR"
  rm -f "$MAIN_COMMAND_PATH" "$ALIAS_COMMAND_PATH"
fi

mkdir -p \
  "$BIN_DIR" \
  "$SHARE_DIR/.claude" \
  "$SHARE_DIR/.wiki/policy" \
  "$SHARE_DIR/evaluation/benchmark/fixtures" \
  "$SHARE_DIR/evaluation" \
  "$SHARE_DIR/tools"

cp -R "$REPO_ROOT/.claude/skills" "$SHARE_DIR/.claude/"
cp -R "$REPO_ROOT/.wiki/policy/specs" "$SHARE_DIR/.wiki/policy/"
cp -R "$REPO_ROOT/.wiki/policy/schemas" "$SHARE_DIR/.wiki/policy/"
cp -R "$REPO_ROOT/.wiki/policy/templates" "$SHARE_DIR/.wiki/policy/"
cp -R "$REPO_ROOT/evaluation/protocols" "$SHARE_DIR/evaluation/"
mkdir -p "$SHARE_DIR/evaluation/benchmark/fixtures/templates"
cp "$REPO_ROOT/evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md" \
  "$SHARE_DIR/evaluation/benchmark/fixtures/templates/"
cp "$REPO_ROOT/tools/bootstrap-wiki-repo.sh" "$SHARE_DIR/tools/"
cp "$REPO_ROOT/tools/install-global.sh" "$SHARE_DIR/tools/"
cp "$REPO_ROOT/tools/wiki.sh" "$SHARE_DIR/tools/"
chmod +x \
  "$SHARE_DIR/tools/bootstrap-wiki-repo.sh" \
  "$SHARE_DIR/tools/install-global.sh" \
  "$SHARE_DIR/tools/wiki.sh"

cat > "$MAIN_COMMAND_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export WIKI_COMMAND_NAME="${MAIN_NAME}"
exec "${SHARE_DIR}/tools/wiki.sh" "\$@"
EOF

chmod +x "$MAIN_COMMAND_PATH"

if [ "$ALIAS_COMMAND_PATH" != "$MAIN_COMMAND_PATH" ]; then
  cat > "$ALIAS_COMMAND_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export BOOTSTRAP_COMMAND_NAME="${BIN_NAME}"
exec "${SHARE_DIR}/tools/bootstrap-wiki-repo.sh" "\$@"
EOF

  chmod +x "$ALIAS_COMMAND_PATH"
fi

mkdir -p "$CONFIG_ROOT"
if [ ! -f "$CONFIG_PATH" ]; then
  cat > "$CONFIG_PATH" <<'EOF'
# LLM Wiki namespace config
# format: namespace=/absolute/path
# special key: default_namespace=work
EOF
fi

echo "Installed global command: ${MAIN_COMMAND_PATH}"
if [ "$ALIAS_COMMAND_PATH" != "$MAIN_COMMAND_PATH" ]; then
  echo "Installed legacy alias: ${ALIAS_COMMAND_PATH}"
fi
echo "Toolkit assets: ${SHARE_DIR}"
echo "Namespace config: ${CONFIG_PATH}"
echo "Run it with:"
echo "  ${MAIN_NAME} setup work /data/wiki/work"
echo "  ${MAIN_NAME} new my-new-wiki --name \"My New Wiki\""
echo "Check current status with:"
echo "  ${MAIN_NAME} status"
echo "Locate the selected repo with:"
echo "  ${MAIN_NAME} where"
echo "After the repo is created, enter it and use the knowledge front door:"
echo "  /wiki 请吸收这段资料"
echo "Show the quick guide with:"
echo "  ${MAIN_NAME} guide"
if [ "$ALIAS_COMMAND_PATH" != "$MAIN_COMMAND_PATH" ]; then
  echo "Legacy bootstrap alias still available as:"
  echo "  ${BIN_NAME} --help"
fi

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    ;;
  *)
    echo
    echo "Note: ${BIN_DIR} is not currently in PATH."
    echo "Add it to PATH before calling ${MAIN_NAME} directly."
    ;;
esac
