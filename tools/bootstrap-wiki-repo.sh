#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required for bootstrap-wiki-repo.sh" >&2
  exit 1
fi

exec node "${REPO_ROOT}/src/bootstrap-cli.js" "$@"
