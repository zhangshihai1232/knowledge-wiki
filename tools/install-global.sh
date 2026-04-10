#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  tools/install-global.sh [--prefix PREFIX] [--main-name NAME] [--force]

Installs the reusable LLM Wiki toolkit into a global prefix and exposes
one public command: wiki.

Defaults:
  PREFIX   ~/.local
  MAIN     wiki
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

if [ "$FORCE" -eq 0 ]; then
  if [ -e "$MAIN_COMMAND_PATH" ]; then
    die "command already exists at ${MAIN_COMMAND_PATH}; use --force to overwrite"
  fi
  if [ -d "$SHARE_DIR" ] && [ -n "$(find "$SHARE_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ]; then
    die "install root already exists at ${SHARE_DIR}; use --force to overwrite"
  fi
fi

if [ "$FORCE" -eq 1 ]; then
  rm -rf "$SHARE_DIR"
  rm -f "$MAIN_COMMAND_PATH"
fi

mkdir -p \
  "$BIN_DIR" \
  "$SHARE_DIR/.claude" \
  "$SHARE_DIR/.wiki/policy" \
  "$SHARE_DIR/evaluation/benchmark/fixtures" \
  "$SHARE_DIR/evaluation" \
  "$SHARE_DIR/src/lib" \
  "$SHARE_DIR/tools"

cp -R "$REPO_ROOT/.claude/skills" "$SHARE_DIR/.claude/"
cp "$REPO_ROOT/.gitignore" "$SHARE_DIR/.gitignore"
cp -R "$REPO_ROOT/.wiki/policy/specs" "$SHARE_DIR/.wiki/policy/"
cp -R "$REPO_ROOT/.wiki/policy/schemas" "$SHARE_DIR/.wiki/policy/"
cp -R "$REPO_ROOT/.wiki/policy/templates" "$SHARE_DIR/.wiki/policy/"
cp -R "$REPO_ROOT/evaluation/protocols" "$SHARE_DIR/evaluation/"
cp "$REPO_ROOT/package.json" "$SHARE_DIR/package.json"
cp "$REPO_ROOT/src/bootstrap-cli.js" "$SHARE_DIR/src/bootstrap-cli.js"
cp "$REPO_ROOT/src/cli.js" "$SHARE_DIR/src/cli.js"
cp "$REPO_ROOT/src/lib/bootstrap.js" "$SHARE_DIR/src/lib/bootstrap.js"
cp "$REPO_ROOT/src/lib/config.js" "$SHARE_DIR/src/lib/config.js"
cp "$REPO_ROOT/src/lib/frontmatter.js" "$SHARE_DIR/src/lib/frontmatter.js"
cp "$REPO_ROOT/src/lib/runtime-index.js" "$SHARE_DIR/src/lib/runtime-index.js"
cp "$REPO_ROOT/src/lib/wiki-internal.js" "$SHARE_DIR/src/lib/wiki-internal.js"
cp "$REPO_ROOT/src/lib/utils.js" "$SHARE_DIR/src/lib/utils.js"
cp "$REPO_ROOT/src/lib/wiki-repo.js" "$SHARE_DIR/src/lib/wiki-repo.js"
mkdir -p "$SHARE_DIR/evaluation/benchmark/fixtures/templates"
cp "$REPO_ROOT/evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md" \
  "$SHARE_DIR/evaluation/benchmark/fixtures/templates/"
cp "$REPO_ROOT/tools/bootstrap-wiki-repo.sh" "$SHARE_DIR/tools/"
cp "$REPO_ROOT/tools/install-global.sh" "$SHARE_DIR/tools/"
cp "$REPO_ROOT/tools/wiki.js" "$SHARE_DIR/tools/"
chmod +x \
  "$SHARE_DIR/tools/bootstrap-wiki-repo.sh" \
  "$SHARE_DIR/tools/install-global.sh" \
  "$SHARE_DIR/tools/wiki.js"

cat > "$MAIN_COMMAND_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export WIKI_COMMAND_NAME="${MAIN_NAME}"
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required for ${MAIN_NAME}" >&2
  exit 1
fi
exec node --no-warnings "${SHARE_DIR}/tools/wiki.js" "\$@"
EOF

chmod +x "$MAIN_COMMAND_PATH"

mkdir -p "$CONFIG_ROOT"
if [ ! -f "$CONFIG_PATH" ]; then
  cat > "$CONFIG_PATH" <<'EOF'
# LLM Wiki namespace config
# format: namespace=/absolute/path
# special key: default_namespace=work
EOF
fi

echo "Installed global command: ${MAIN_COMMAND_PATH}"
echo "Toolkit assets: ${SHARE_DIR}"
echo "Namespace config: ${CONFIG_PATH}"
echo "Run it with:"
echo "  ${MAIN_NAME} setup work /data/wiki/work"
echo "  ${MAIN_NAME} new my-new-wiki --name \"My New Wiki\""
echo "Check current status with:"
echo "  ${MAIN_NAME} status"
echo "Run a structural health check with:"
echo "  ${MAIN_NAME} check"
echo "Open the deterministic review queue with:"
echo "  ${MAIN_NAME} review"
echo "Locate the selected repo with:"
echo "  ${MAIN_NAME} where"
echo "After the repo is created, enter it and use the knowledge front door:"
echo "  /wiki 请吸收这段资料"
echo "Show the quick guide with:"
echo "  ${MAIN_NAME} guide"

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    ;;
  *)
    echo
    echo "Note: ${BIN_DIR} is not currently in PATH."
    echo "Add it to PATH before calling ${MAIN_NAME} directly."
    ;;
esac
