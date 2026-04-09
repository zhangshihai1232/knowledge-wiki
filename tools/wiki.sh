#!/usr/bin/env bash

set -euo pipefail

COMMAND_NAME="${WIKI_COMMAND_NAME:-wiki}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_SCRIPT="${SCRIPT_DIR}/bootstrap-wiki-repo.sh"

usage() {
  cat <<EOF
Usage:
  ${COMMAND_NAME} setup NAMESPACE BASE_PATH [--config PATH]
  ${COMMAND_NAME} new REPO_DIR [--name DISPLAY_NAME] [--namespace NAME] [--config PATH] [--force]
  ${COMMAND_NAME} use REPO_REF [--namespace NAME] [--config PATH]
  ${COMMAND_NAME} where [REPO_REF] [--namespace NAME] [--config PATH]
  ${COMMAND_NAME} status [--config PATH]
  ${COMMAND_NAME} guide [--config PATH]
  ${COMMAND_NAME} bootstrap ...

Commands:
  setup     Register a namespace and set it as the default in one step
  new       Create a new repository and select it as the current repo
  use       Select an existing repository as the current repo
  where     Print the current repo path or resolve a repo ref to a path
  status    Print config path, default namespace, namespaces, and current repo
  guide     Print the minimal end-to-end workflow
  bootstrap Pass through to the lower-level bootstrap command
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

[ -f "$BOOTSTRAP_SCRIPT" ] || die "bootstrap script not found: $BOOTSTRAP_SCRIPT"

DEFAULT_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-wiki-toolkit"
CONFIG_PATH="${DEFAULT_CONFIG_DIR}/namespaces.conf"
CONFIG_DIR="${DEFAULT_CONFIG_DIR}"
CONTEXT_PATH="${CONFIG_DIR}/context.conf"

update_config_paths() {
  CONFIG_DIR="$(dirname -- "$CONFIG_PATH")"
  CONTEXT_PATH="${CONFIG_DIR}/context.conf"
}

ensure_context_file() {
  mkdir -p "$CONFIG_DIR"
  if [ ! -f "$CONTEXT_PATH" ]; then
    cat > "$CONTEXT_PATH" <<'EOF'
# LLM Wiki current context
# format: current_repo=/absolute/path
EOF
  fi
}

get_current_repo() {
  local line

  [ -f "$CONTEXT_PATH" ] || return 1

  while IFS= read -r line; do
    case "$line" in
      ''|\#*)
        continue
        ;;
      current_repo=*)
        printf '%s\n' "${line#*=}"
        return 0
        ;;
    esac
  done < "$CONTEXT_PATH"

  return 1
}

set_current_repo() {
  local repo_path="$1"
  local tmp_file

  ensure_context_file
  tmp_file="$(mktemp "${CONTEXT_PATH}.tmp.XXXXXX")"
  grep -v '^current_repo=' "$CONTEXT_PATH" > "$tmp_file" || true
  printf 'current_repo=%s\n' "$repo_path" >> "$tmp_file"
  mv "$tmp_file" "$CONTEXT_PATH"
}

lookup_namespace_path() {
  local namespace="$1"
  local line

  [ -f "$CONFIG_PATH" ] || return 1

  while IFS= read -r line; do
    case "$line" in
      ''|\#*|default_namespace=*)
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

resolve_repo_path() {
  local repo_ref="$1"
  local namespace="${2:-}"
  local base_path=""
  local default_namespace=""
  local candidate_namespace=""
  local candidate_rest=""

  case "$repo_ref" in
    /*)
      printf '%s\n' "$repo_ref"
      return 0
      ;;
  esac

  if [ -n "$namespace" ]; then
    base_path="$(lookup_namespace_path "$namespace" || true)"
    [ -n "$base_path" ] || die "namespace '${namespace}' is not configured. Config file: $CONFIG_PATH"
    printf '%s\n' "${base_path%/}/${repo_ref}"
    return 0
  fi

  if [ "${repo_ref#*/}" != "$repo_ref" ]; then
    candidate_namespace="${repo_ref%%/*}"
    candidate_rest="${repo_ref#*/}"
    base_path="$(lookup_namespace_path "$candidate_namespace" || true)"
    if [ -n "$base_path" ]; then
      [ -n "$candidate_rest" ] || die "invalid repo ref: $repo_ref"
      printf '%s\n' "${base_path%/}/${candidate_rest}"
      return 0
    fi
  fi

  default_namespace="$(get_default_namespace || true)"
  [ -n "$default_namespace" ] || die "no namespace selected. Run '${COMMAND_NAME} setup work /data/wiki/work' first."
  base_path="$(lookup_namespace_path "$default_namespace" || true)"
  [ -n "$base_path" ] || die "default namespace '${default_namespace}' is not configured. Config file: $CONFIG_PATH"
  printf '%s\n' "${base_path%/}/${repo_ref}"
}

print_status() {
  local current_repo

  bash "$BOOTSTRAP_SCRIPT" --config "$CONFIG_PATH" --status
  current_repo="$(get_current_repo || true)"
  if [ -n "$current_repo" ]; then
    echo "Current repo: $current_repo"
    if [ -d "$current_repo/.wiki" ]; then
      echo "Knowledge front door: /wiki"
      echo "Suggested next step: cd \"\$(${COMMAND_NAME} where)\""
    else
      echo "Current repo health: missing .wiki directory"
    fi
  else
    echo "Current repo: (none)"
  fi
}

print_guide() {
  cat <<EOF
Minimal mental model:
  1. Remember one global front door: ${COMMAND_NAME}
  2. Run one setup command once
  3. Use one repo command to create or select a repo
  4. Inside the repo, use one knowledge front door: /wiki

Recommended flow:
  ${COMMAND_NAME} setup work /data/wiki/work
  ${COMMAND_NAME} new my-new-repo --name "My New Wiki"
  cd "\$(${COMMAND_NAME} where)"
  /wiki 请吸收这段资料

Useful commands:
  ${COMMAND_NAME} use my-existing-repo
  ${COMMAND_NAME} where
  ${COMMAND_NAME} status
  ${COMMAND_NAME} guide

Current config file:
  ${CONFIG_PATH}
EOF
}

set_global_config_from_args() {
  local filtered=()

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --config)
        shift
        [ "$#" -gt 0 ] || die "--config requires a value"
        CONFIG_PATH="$1"
        update_config_paths
        ;;
      *)
        filtered+=("$1")
        ;;
    esac
    shift
  done

  set -- "${filtered[@]}"
  printf '%s\0' "$@"
}

mapfile -d '' FILTERED_ARGS < <(set_global_config_from_args "$@")
set -- "${FILTERED_ARGS[@]}"

SUBCOMMAND="${1:-}"
[ -n "$SUBCOMMAND" ] || {
  usage
  exit 0
}
shift

case "$SUBCOMMAND" in
  setup)
    [ "$#" -eq 2 ] || die "setup requires NAMESPACE and BASE_PATH"
    bash "$BOOTSTRAP_SCRIPT" --config "$CONFIG_PATH" --setup "$1" "$2"
    echo "Next: ${COMMAND_NAME} new my-new-repo --name \"My New Wiki\""
    ;;
  new)
    REPO_REF=""
    DISPLAY_NAME=""
    NAMESPACE=""
    FORCE_ARGS=()

    while [ "$#" -gt 0 ]; do
      case "$1" in
        --name)
          shift
          [ "$#" -gt 0 ] || die "--name requires a value"
          DISPLAY_NAME="$1"
          ;;
        --namespace)
          shift
          [ "$#" -gt 0 ] || die "--namespace requires a value"
          NAMESPACE="$1"
          ;;
        --force)
          FORCE_ARGS+=(--force)
          ;;
        -*)
          die "unknown option for new: $1"
          ;;
        *)
          if [ -z "$REPO_REF" ]; then
            REPO_REF="$1"
          else
            die "unexpected argument for new: $1"
          fi
          ;;
      esac
      shift
    done

    [ -n "$REPO_REF" ] || die "new requires REPO_DIR"

    CMD=(bash "$BOOTSTRAP_SCRIPT" --config "$CONFIG_PATH")
    if [ -n "$DISPLAY_NAME" ]; then
      CMD+=(--name "$DISPLAY_NAME")
    fi
    if [ -n "$NAMESPACE" ]; then
      CMD+=(--namespace "$NAMESPACE")
    fi
    CMD+=("${FORCE_ARGS[@]}" "$REPO_REF")

    if ! OUTPUT="$("${CMD[@]}" 2>&1)"; then
      printf '%s\n' "$OUTPUT" >&2
      exit 1
    fi

    printf '%s\n' "$OUTPUT"
    REPO_PATH="$(printf '%s\n' "$OUTPUT" | sed -n 's/^Scaffolded new wiki repository at: //p' | tail -n 1)"
    if [ -n "$REPO_PATH" ]; then
      set_current_repo "$REPO_PATH"
      echo "Current repo: $REPO_PATH"
      echo "Next: cd \"\$(${COMMAND_NAME} where)\""
      echo "Knowledge front door: /wiki 请吸收这段资料"
    fi
    ;;
  use)
    REPO_REF=""
    NAMESPACE=""

    while [ "$#" -gt 0 ]; do
      case "$1" in
        --namespace)
          shift
          [ "$#" -gt 0 ] || die "--namespace requires a value"
          NAMESPACE="$1"
          ;;
        -*)
          die "unknown option for use: $1"
          ;;
        *)
          if [ -z "$REPO_REF" ]; then
            REPO_REF="$1"
          else
            die "unexpected argument for use: $1"
          fi
          ;;
      esac
      shift
    done

    [ -n "$REPO_REF" ] || die "use requires REPO_REF"
    REPO_PATH="$(resolve_repo_path "$REPO_REF" "$NAMESPACE")"
    [ -d "$REPO_PATH/.wiki" ] || die "not a wiki repository: $REPO_PATH"
    set_current_repo "$REPO_PATH"
    echo "Current repo: $REPO_PATH"
    echo "Knowledge front door: /wiki"
    ;;
  where)
    if [ "$#" -eq 0 ]; then
      CURRENT_REPO="$(get_current_repo || true)"
      [ -n "$CURRENT_REPO" ] || die "no current repo selected"
      printf '%s\n' "$CURRENT_REPO"
      exit 0
    fi

    REPO_REF=""
    NAMESPACE=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --namespace)
          shift
          [ "$#" -gt 0 ] || die "--namespace requires a value"
          NAMESPACE="$1"
          ;;
        -*)
          die "unknown option for where: $1"
          ;;
        *)
          if [ -z "$REPO_REF" ]; then
            REPO_REF="$1"
          else
            die "unexpected argument for where: $1"
          fi
          ;;
      esac
      shift
    done

    [ -n "$REPO_REF" ] || die "where requires REPO_REF when arguments are provided"
    resolve_repo_path "$REPO_REF" "$NAMESPACE"
    ;;
  status)
    [ "$#" -eq 0 ] || die "status does not accept positional arguments"
    print_status
    ;;
  guide)
    [ "$#" -eq 0 ] || die "guide does not accept positional arguments"
    print_guide
    ;;
  bootstrap)
    export BOOTSTRAP_COMMAND_NAME="${COMMAND_NAME} bootstrap"
    exec bash "$BOOTSTRAP_SCRIPT" --config "$CONFIG_PATH" "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    die "unknown subcommand: $SUBCOMMAND"
    ;;
esac
