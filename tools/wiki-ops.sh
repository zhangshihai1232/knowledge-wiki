#!/usr/bin/env bash
# wiki-ops.sh — Deterministic operations CLI for LLM Wiki
#
# This tool handles ALL file-system mutations in the wiki system.
# Skill/Spec layer calls these subcommands instead of doing raw file I/O.
#
# Design principle: Skill does the THINKING, CLI does the WRITING.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WIKI_ROOT="${WIKI_ROOT:-$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)}"
WIKI_DIR="${WIKI_ROOT}/.wiki"
TODAY="$(date '+%Y-%m-%d')"
NOW="$(date '+%Y-%m-%dT%H:%M:%S%z')"

# ─── Utilities ───────────────────────────────────────────────────────

die() { echo "Error: $*" >&2; exit 1; }

require_wiki() {
  [ -d "$WIKI_DIR" ] || die ".wiki directory not found at ${WIKI_DIR}. Not a wiki repository."
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//' \
    | cut -c1-50
}

ensure_dir() {
  mkdir -p "$(dirname -- "$1")"
}

# Minimal frontmatter reader: extract value for a given key from YAML frontmatter.
# Usage: fm_get <file> <key>
fm_get() {
  local file="$1" key="$2"
  sed -n '/^---$/,/^---$/{ /^'"$key"':/{ s/^'"$key"': *//; s/^"//; s/"$//; s/^'\''//; s/'\''$//; p; q; }; }' "$file"
}

# Minimal frontmatter field setter: replace or add a key-value pair in YAML frontmatter.
# Usage: fm_set <file> <key> <value>
fm_set() {
  local file="$1" key="$2" value="$3"
  local tmp_file
  tmp_file="$(mktemp "${file}.tmp.XXXXXX")"

  if grep -q "^${key}:" "$file" 2>/dev/null; then
    sed "s|^${key}:.*|${key}: ${value}|" "$file" > "$tmp_file"
  else
    # Insert before the closing --- of frontmatter
    awk -v k="$key" -v v="$value" '
      /^---$/ && found_first { print k ": " v; found_close=1 }
      /^---$/ && !found_first { found_first=1 }
      { print }
    ' "$file" > "$tmp_file"
  fi
  mv "$tmp_file" "$file"
}

# Read frontmatter field that is a YAML list (one item per line starting with "  - ")
# Usage: fm_get_list <file> <key>
fm_get_list() {
  local file="$1" key="$2"
  awk '
    /^---$/ && !started { started=1; next }
    /^---$/ && started { exit }
    started && /^'"$key"':/ { in_list=1; next }
    in_list && /^  - / { sub(/^  - /, ""); gsub(/"/, ""); print; next }
    in_list && /^[^ ]/ { exit }
  ' "$file"
}

# Count non-.gitkeep .md files in a directory (recursive)
count_md_files() {
  local dir="$1"
  find "$dir" -name '*.md' ! -name '.gitkeep' ! -name '_index.md' 2>/dev/null | wc -l | tr -d ' '
}

# Count all non-.gitkeep files in a directory (recursive)
count_files() {
  local dir="$1"
  find "$dir" -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' '
}

# Date arithmetic: days between two YYYY-MM-DD dates
# Usage: days_between <earlier_date> <later_date>
days_between() {
  local d1="$1" d2="$2"
  local s1 s2
  # Try GNU date first, fall back to busybox/other
  if date -d "2000-01-01" +%s >/dev/null 2>&1; then
    s1="$(date -d "$d1" +%s 2>/dev/null || echo 0)"
    s2="$(date -d "$d2" +%s 2>/dev/null || echo 0)"
  else
    # Fallback: parse YYYY-MM-DD manually for basic systems
    s1="$(date -j -f '%Y-%m-%d' "$d1" +%s 2>/dev/null || echo 0)"
    s2="$(date -j -f '%Y-%m-%d' "$d2" +%s 2>/dev/null || echo 0)"
  fi
  if [ "$s1" -eq 0 ] || [ "$s2" -eq 0 ]; then
    echo 0
    return
  fi
  echo $(( (s2 - s1) / 86400 ))
}

# ─── Subcommand: create-source ───────────────────────────────────────

cmd_create_source() {
  require_wiki
  local kind="" title="" url="" author="" published_at="" domain="" body_file="" tags=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --kind)       shift; kind="$1" ;;
      --title)      shift; title="$1" ;;
      --url)        shift; url="$1" ;;
      --author)     shift; author="$1" ;;
      --published-at) shift; published_at="$1" ;;
      --domain)     shift; domain="$1" ;;
      --tags)       shift; tags="$1" ;;
      --body-file)  shift; body_file="$1" ;;
      *) die "create-source: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$kind" ]  || die "create-source: --kind is required (article|conversation|note|reference)"
  [ -n "$title" ] || die "create-source: --title is required"
  case "$kind" in
    article|conversation|note|reference) ;;
    *) die "create-source: --kind must be article|conversation|note|reference, got: $kind" ;;
  esac

  local slug
  slug="$(slugify "$title")"
  local subdir="${kind}s"
  [ "$kind" = "reference" ] && subdir="references"
  local filename="${TODAY}-${slug}.md"
  local filepath="${WIKI_DIR}/sources/${subdir}/${filename}"

  ensure_dir "$filepath"

  {
    echo "---"
    echo "type: source"
    echo "source_kind: ${kind}"
    echo "title: \"${title}\""
    [ -n "$url" ]          && echo "url: \"${url}\""
    [ -n "$author" ]       && echo "author: \"${author}\""
    [ -n "$published_at" ] && echo "published_at: \"${published_at}\""
    echo "ingested_at: \"${TODAY}\""
    [ -n "$domain" ]       && echo "domain: \"${domain}\""
    if [ -n "$tags" ]; then
      echo "tags: [${tags}]"
    fi
    echo "extracted: false"
    echo "---"
    echo ""
    echo "## 原始内容"
    echo ""
    if [ -n "$body_file" ] && [ -f "$body_file" ]; then
      cat "$body_file"
    fi
    echo ""
    echo "## 提取声明"
    echo ""
  } > "$filepath"

  echo "$filepath"
}

# ─── Subcommand: create-proposal ─────────────────────────────────────

cmd_create_proposal() {
  require_wiki
  local action="" status="inbox" target_page="" target_type="" trigger_source=""
  local confidence="medium" origin="ingest" auto_quality_score="" body_file=""
  local proposed_at="$TODAY"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --action)        shift; action="$1" ;;
      --status)        shift; status="$1" ;;
      --target-page)   shift; target_page="$1" ;;
      --target-type)   shift; target_type="$1" ;;
      --trigger-source) shift; trigger_source="$1" ;;
      --confidence)    shift; confidence="$1" ;;
      --origin)        shift; origin="$1" ;;
      --auto-quality-score) shift; auto_quality_score="$1" ;;
      --body-file)     shift; body_file="$1" ;;
      --proposed-at)   shift; proposed_at="$1" ;;
      *) die "create-proposal: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$action" ]       || die "create-proposal: --action is required (create|update|merge|split|archive)"
  [ -n "$target_page" ]  || die "create-proposal: --target-page is required"
  [ -n "$trigger_source" ] || die "create-proposal: --trigger-source is required"
  case "$action" in
    create|update|merge|split|archive) ;;
    *) die "create-proposal: --action must be create|update|merge|split|archive" ;;
  esac
  case "$status" in
    inbox|review) ;;
    *) die "create-proposal: --status must be inbox|review" ;;
  esac
  case "$confidence" in
    high|medium|low) ;;
    *) die "create-proposal: --confidence must be high|medium|low" ;;
  esac

  local slug
  slug="$(slugify "${target_page##*/}")"
  local filename="${proposed_at}-${action}-${slug}.md"
  local filepath="${WIKI_DIR}/changes/${status}/${filename}"

  ensure_dir "$filepath"

  {
    echo "---"
    echo "type: change-proposal"
    echo "action: ${action}"
    echo "status: ${status}"
    echo "target_page: \"${target_page}\""
    [ -n "$target_type" ]       && echo "target_type: ${target_type}"
    echo "trigger_source: \"${trigger_source}\""
    echo "origin: ${origin}"
    echo "confidence: ${confidence}"
    echo "proposed_at: \"${proposed_at}\""
    [ -n "$auto_quality_score" ] && echo "auto_quality_score: ${auto_quality_score}"
    echo "reviewed_by: ~"
    echo "reviewed_at: ~"
    echo "rejection_reason: ~"
    echo "compiled: false"
    echo "compiled_at: ~"
    echo "---"
    echo ""
    if [ -n "$body_file" ] && [ -f "$body_file" ]; then
      cat "$body_file"
    fi
  } > "$filepath"

  echo "$filepath"
}

# ─── Subcommand: create-canon ────────────────────────────────────────

cmd_create_canon() {
  require_wiki
  local target_page="" page_type="" title="" sources="" confidence="medium" body_file=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --target-page) shift; target_page="$1" ;;
      --type)        shift; page_type="$1" ;;
      --title)       shift; title="$1" ;;
      --sources)     shift; sources="$1" ;;
      --confidence)  shift; confidence="$1" ;;
      --body-file)   shift; body_file="$1" ;;
      *) die "create-canon: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$target_page" ] || die "create-canon: --target-page is required (format: domain/category/slug)"
  [ -n "$page_type" ]   || die "create-canon: --type is required (concept|entity|comparison|guide|decision)"
  [ -n "$title" ]       || die "create-canon: --title is required"
  case "$page_type" in
    concept|entity|comparison|guide|decision) ;;
    *) die "create-canon: --type must be concept|entity|comparison|guide|decision" ;;
  esac

  local domain
  domain="${target_page%%/*}"
  local filepath="${WIKI_DIR}/canon/domains/${target_page}.md"

  ensure_dir "$filepath"

  local source_list=""
  if [ -n "$sources" ]; then
    source_list="$(echo "$sources" | tr ',' '\n' | sed 's/^/  - /')"
  fi

  {
    echo "---"
    echo "type: ${page_type}"
    echo "title: \"${title}\""
    echo "domain: \"${domain}\""
    echo "sources:"
    if [ -n "$source_list" ]; then
      echo "$source_list"
    else
      echo "  - (none)"
    fi
    echo "confidence: ${confidence}"
    echo "last_compiled: \"${TODAY}\""
    echo "staleness_days: 0"
    echo "last_updated: \"${TODAY}\""
    echo "cross_refs: []"
    echo "status: active"
    echo "tags: []"
    echo "last_queried_at: ~"
    echo "query_count: 0"
    echo "---"
    echo ""
    if [ -n "$body_file" ] && [ -f "$body_file" ]; then
      cat "$body_file"
    else
      # Generate template based on type
      case "$page_type" in
        concept)
          echo "## 定义"; echo ""; echo "## 核心特征"; echo ""
          echo "## 相关概念"; echo ""; echo "## 参考来源"; echo "" ;;
        entity)
          echo "## 基本信息"; echo ""; echo "## 关键属性"; echo ""
          echo "## 历史/背景"; echo ""; echo "## 参考来源"; echo "" ;;
        comparison)
          echo "## 对比维度"; echo ""; echo "## 详细对比"; echo ""
          echo "| 维度 | A | B |"; echo "|------|---|---|"; echo ""
          echo "## 选择建议"; echo ""; echo "## 参考来源"; echo "" ;;
        guide)
          echo "## 前提条件"; echo ""; echo "## 步骤"; echo ""
          echo "## 常见问题"; echo ""; echo "## 参考来源"; echo "" ;;
        decision)
          echo "## 背景与约束"; echo ""; echo "## 选项分析"; echo ""
          echo "## 决策结论"; echo ""; echo "## 参考来源"; echo "" ;;
      esac
    fi
  } > "$filepath"

  echo "$filepath"
}

# ─── Subcommand: move-proposal ───────────────────────────────────────

cmd_move_proposal() {
  require_wiki
  local proposal_path="" dest="" reviewed_by="" reviewed_at="" approve_note=""
  local rejection_reason="" conflict_location="" resolved_by="" resolution=""
  local reopen_reason="" modify_note=""

  # First arg is the proposal path
  [ "$#" -gt 0 ] || die "move-proposal: requires <proposal-path> --to <destination>"
  proposal_path="$1"; shift

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --to)                shift; dest="$1" ;;
      --reviewed-by)       shift; reviewed_by="$1" ;;
      --reviewed-at)       shift; reviewed_at="$1" ;;
      --approve-note)      shift; approve_note="$1" ;;
      --rejection-reason)  shift; rejection_reason="$1" ;;
      --conflict-location) shift; conflict_location="$1" ;;
      --resolved-by)       shift; resolved_by="$1" ;;
      --resolution)        shift; resolution="$1" ;;
      --reopen-reason)     shift; reopen_reason="$1" ;;
      --modify-note)       shift; modify_note="$1" ;;
      *) die "move-proposal: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$dest" ] || die "move-proposal: --to is required"
  [ -f "$proposal_path" ] || die "move-proposal: file not found: $proposal_path"

  case "$dest" in
    approved)
      [ -n "$reviewed_by" ]  || die "move-proposal --to approved: --reviewed-by is required"
      [ -n "$approve_note" ] || die "move-proposal --to approved: --approve-note is required"
      local note_len=${#approve_note}
      [ "$note_len" -ge 20 ] || die "move-proposal --to approved: --approve-note must be >= 20 chars (got ${note_len})"
      reviewed_at="${reviewed_at:-$NOW}"
      fm_set "$proposal_path" "status" "approved"
      fm_set "$proposal_path" "reviewed_by" "\"${reviewed_by}\""
      fm_set "$proposal_path" "reviewed_at" "\"${reviewed_at}\""
      fm_set "$proposal_path" "approve_note" "\"${approve_note}\""
      ;;
    rejected)
      [ -n "$reviewed_by" ]      || die "move-proposal --to rejected: --reviewed-by is required"
      [ -n "$rejection_reason" ] || die "move-proposal --to rejected: --rejection-reason is required"
      reviewed_at="${reviewed_at:-$NOW}"
      fm_set "$proposal_path" "status" "rejected"
      fm_set "$proposal_path" "reviewed_by" "\"${reviewed_by}\""
      fm_set "$proposal_path" "reviewed_at" "\"${reviewed_at}\""
      fm_set "$proposal_path" "rejection_reason" "\"${rejection_reason}\""
      ;;
    review)
      fm_set "$proposal_path" "status" "review"
      [ -n "$modify_note" ] && fm_set "$proposal_path" "modify_note" "\"${modify_note}\""
      [ -n "$modify_note" ] && fm_set "$proposal_path" "modified_at" "\"${NOW}\""
      ;;
    inbox)
      fm_set "$proposal_path" "status" "inbox"
      [ -n "$reopen_reason" ] && fm_set "$proposal_path" "reopen_reason" "\"${reopen_reason}\""
      [ -n "$reopen_reason" ] && fm_set "$proposal_path" "reopened_at" "\"${NOW}\""
      # Clear review fields on reopen
      fm_set "$proposal_path" "reviewed_by" "~"
      fm_set "$proposal_path" "reviewed_at" "~"
      fm_set "$proposal_path" "rejection_reason" "~"
      ;;
    conflicts)
      fm_set "$proposal_path" "status" "conflict"
      [ -n "$conflict_location" ] && fm_set "$proposal_path" "conflict_location" "\"${conflict_location}\""
      mkdir -p "${WIKI_DIR}/changes/conflicts"
      mkdir -p "${WIKI_DIR}/changes/resolved"
      ;;
    resolved)
      [ -n "$resolved_by" ] || die "move-proposal --to resolved: --resolved-by is required"
      [ -n "$resolution" ]  || die "move-proposal --to resolved: --resolution is required"
      fm_set "$proposal_path" "status" "resolved"
      fm_set "$proposal_path" "resolved_at" "\"${TODAY}\""
      fm_set "$proposal_path" "resolved_by" "\"${resolved_by}\""
      fm_set "$proposal_path" "resolution" "\"${resolution}\""
      mkdir -p "${WIKI_DIR}/changes/resolved"
      ;;
    *) die "move-proposal: --to must be approved|rejected|review|inbox|conflicts|resolved" ;;
  esac

  local dest_dir="${WIKI_DIR}/changes/${dest}"
  local filename
  filename="$(basename -- "$proposal_path")"
  local dest_path="${dest_dir}/${filename}"

  mkdir -p "$dest_dir"

  if [ "$(dirname -- "$proposal_path")" != "$dest_dir" ]; then
    mv "$proposal_path" "$dest_path"
  fi

  echo "$dest_path"
}

# ─── Subcommand: mark-extracted ──────────────────────────────────────

cmd_mark_extracted() {
  require_wiki
  [ "$#" -ge 1 ] || die "mark-extracted: requires <source-path>"
  local source_path="$1"
  [ -f "$source_path" ] || die "mark-extracted: file not found: $source_path"

  fm_set "$source_path" "extracted" "true"
  echo "ok"
}

# ─── Subcommand: mark-compiled ───────────────────────────────────────

cmd_mark_compiled() {
  require_wiki
  [ "$#" -ge 1 ] || die "mark-compiled: requires <proposal-path>"
  local proposal_path="$1"
  [ -f "$proposal_path" ] || die "mark-compiled: file not found: $proposal_path"

  fm_set "$proposal_path" "compiled" "true"
  fm_set "$proposal_path" "compiled_at" "\"${TODAY}\""
  echo "ok"
}

# ─── Subcommand: frontmatter ────────────────────────────────────────

cmd_frontmatter() {
  local subcmd="${1:-}"
  shift 2>/dev/null || true

  case "$subcmd" in
    get)
      [ "$#" -ge 2 ] || die "frontmatter get: requires <file> <key>"
      fm_get "$1" "$2"
      ;;
    set)
      [ "$#" -ge 3 ] || die "frontmatter set: requires <file> <key> <value>"
      fm_set "$1" "$2" "$3"
      echo "ok"
      ;;
    get-list)
      [ "$#" -ge 2 ] || die "frontmatter get-list: requires <file> <key>"
      fm_get_list "$1" "$2"
      ;;
    *)
      die "frontmatter: requires subcommand: get|set|get-list"
      ;;
  esac
}

# ─── Subcommand: update-index ────────────────────────────────────────

cmd_update_index() {
  require_wiki
  local domain="" add_slug="" add_title="" remove_slug="" sync_mode=0

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --domain) shift; domain="$1" ;;
      --add)    shift; add_slug="${1%%:*}"; add_title="${1#*:}" ;;
      --remove) shift; remove_slug="$1" ;;
      --sync)   sync_mode=1 ;;
      *) die "update-index: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$domain" ] || die "update-index: --domain is required"

  local domain_dir="${WIKI_DIR}/canon/domains/${domain}"
  local index_file="${domain_dir}/_index.md"
  local top_index="${WIKI_DIR}/canon/_index.md"

  # Create domain _index.md if missing
  if [ ! -f "$index_file" ]; then
    mkdir -p "$domain_dir"
    cat > "$index_file" <<EOF
---
type: index
domain: ${domain}
title: "${domain} 领域索引"
updated_at: ${TODAY}
pages: []
status: active
---

# ${domain} 领域
EOF
    # Register in top-level _index.md
    if [ -f "$top_index" ]; then
      if ! grep -q "domains/${domain}/_index.md" "$top_index" 2>/dev/null; then
        echo "- [${domain}](domains/${domain}/_index.md)" >> "$top_index"
      fi
    fi
  fi

  if [ "$sync_mode" -eq 1 ]; then
    # Rebuild pages list from filesystem
    local pages_yaml=""
    local body_entries=""
    local current_category=""

    while IFS= read -r page_file; do
      local rel_path="${page_file#${WIKI_DIR}/canon/domains/}"
      rel_path="${rel_path%.md}"
      local page_title
      page_title="$(fm_get "$page_file" "title" 2>/dev/null || basename "${page_file%.md}")"
      local page_slug
      page_slug="$(basename "${page_file%.md}")"
      local category
      category="$(dirname "$rel_path")"
      category="${category#${domain}/}"

      pages_yaml="${pages_yaml}  - ${rel_path}\n"
      if [ "$category" != "$current_category" ]; then
        body_entries="${body_entries}\n## ${category}\n\n"
        current_category="$category"
      fi
      body_entries="${body_entries}- [[${page_slug}]] — ${page_title}\n"
    done < <(find "$domain_dir" -name '*.md' ! -name '_index.md' -type f 2>/dev/null | sort)

    # Rewrite index file
    cat > "$index_file" <<EOF
---
type: index
domain: ${domain}
title: "${domain} 领域索引"
updated_at: ${TODAY}
pages:
$(printf '%b' "$pages_yaml")status: active
---

# ${domain} 领域
$(printf '%b' "$body_entries")
EOF
    echo "synced"
    return
  fi

  if [ -n "$add_slug" ]; then
    # Add to pages list in frontmatter
    local page_path="${domain}/${add_slug}"
    if ! grep -q "  - ${page_path}" "$index_file" 2>/dev/null; then
      # Add to pages list (before the closing of pages block)
      local tmp_file
      tmp_file="$(mktemp "${index_file}.tmp.XXXXXX")"
      awk -v entry="  - ${page_path}" '
        /^pages:/ { in_pages=1 }
        in_pages && /^[^ ]/ && !/^pages:/ { print entry; in_pages=0 }
        in_pages && /^---$/ { print entry; in_pages=0 }
        { print }
      ' "$index_file" > "$tmp_file"
      mv "$tmp_file" "$index_file"
    fi

    # Add body entry
    if ! grep -q "\\[\\[${add_slug}\\]\\]" "$index_file" 2>/dev/null; then
      echo "- [[${add_slug}]] — ${add_title}" >> "$index_file"
    fi

    fm_set "$index_file" "updated_at" "\"${TODAY}\""
    echo "added"
    return
  fi

  if [ -n "$remove_slug" ]; then
    local tmp_file
    tmp_file="$(mktemp "${index_file}.tmp.XXXXXX")"
    grep -v "  - .*${remove_slug}" "$index_file" | grep -v "\\[\\[${remove_slug}\\]\\]" > "$tmp_file" || true
    mv "$tmp_file" "$index_file"
    fm_set "$index_file" "updated_at" "\"${TODAY}\""
    echo "removed"
    return
  fi

  die "update-index: specify --add, --remove, or --sync"
}

# ─── Subcommand: update-state ────────────────────────────────────────

cmd_update_state() {
  require_wiki
  local state_file="${WIKI_DIR}/policy/STATE.md"
  [ -f "$state_file" ] || die "update-state: STATE.md not found"

  local total_sources total_canon total_domains pending_proposals

  total_sources="$(count_files "${WIKI_DIR}/sources")"
  total_canon="$(count_md_files "${WIKI_DIR}/canon/domains")"
  total_domains="$(find "${WIKI_DIR}/canon/domains" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"

  local inbox_count review_count
  inbox_count="$(find "${WIKI_DIR}/changes/inbox" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  review_count="$(find "${WIKI_DIR}/changes/review" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  pending_proposals=$((inbox_count + review_count))

  fm_set "$state_file" "total_sources" "$total_sources"
  fm_set "$state_file" "total_canon_pages" "$total_canon"
  fm_set "$state_file" "total_domains" "$total_domains"
  fm_set "$state_file" "pending_proposals" "$pending_proposals"
  fm_set "$state_file" "updated_at" "\"${TODAY}\""

  echo "total_sources=${total_sources}"
  echo "total_canon_pages=${total_canon}"
  echo "total_domains=${total_domains}"
  echo "pending_proposals=${pending_proposals}"
}

# ─── Subcommand: append-log ──────────────────────────────────────────

cmd_append_log() {
  require_wiki
  local target="" spec="" message="" fields=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --to)      shift; target="$1" ;;
      --spec)    shift; spec="$1" ;;
      --message) shift; message="$1" ;;
      --fields)  shift; fields="$1" ;;
      *) die "append-log: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$target" ]  || die "append-log: --to is required (policy|changes)"
  [ -n "$spec" ]    || die "append-log: --spec is required"
  [ -n "$message" ] || die "append-log: --message is required"

  local log_file
  case "$target" in
    policy)  log_file="${WIKI_DIR}/policy/LOG.md" ;;
    changes) log_file="${WIKI_DIR}/changes/LOG.md" ;;
    *) die "append-log: --to must be policy|changes" ;;
  esac

  [ -f "$log_file" ] || die "append-log: log file not found: $log_file"

  {
    echo ""
    echo "## ${TODAY} ${spec}"
    echo ""
    echo "- ${message}"
    if [ -n "$fields" ]; then
      echo "$fields" | tr '|' '\n' | while IFS= read -r field; do
        [ -n "$field" ] && echo "- ${field}"
      done
    fi
  } >> "$log_file"

  echo "ok"
}

# ─── Subcommand: scan ────────────────────────────────────────────────

cmd_scan() {
  require_wiki
  local domain="" rules="" format="text" scope="full"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --domain) shift; domain="$1" ;;
      --rules)  shift; rules="$1" ;;
      --format) shift; format="$1" ;;
      --scope)  shift; scope="$1" ;;
      *) die "scan: unknown option: $1" ;;
    esac
    shift
  done

  local scan_dir="${WIKI_DIR}/canon/domains"
  [ -n "$domain" ] && scan_dir="${WIKI_DIR}/canon/domains/${domain}"

  local total_checks=0 passed_checks=0
  local errors="" warnings="" infos=""

  should_run_rule() {
    [ -z "$rules" ] && return 0
    echo ",$rules," | grep -q ",${1}," && return 0
    return 1
  }

  # Build pages set from all _index.md files
  local indexed_pages=""
  while IFS= read -r idx_file; do
    indexed_pages="${indexed_pages}$(fm_get_list "$idx_file" "pages" 2>/dev/null)"$'\n'
  done < <(find "${WIKI_DIR}/canon" -name '_index.md' 2>/dev/null)

  # Scan canon pages
  while IFS= read -r page_file; do
    local rel_path="${page_file#${WIKI_DIR}/canon/domains/}"
    rel_path="${rel_path%.md}"
    local page_status
    page_status="$(fm_get "$page_file" "status" 2>/dev/null || echo "active")"
    [ "$page_status" = "archived" ] && continue

    # L001: Orphan page
    if should_run_rule "L001" && [ "$scope" = "full" ]; then
      total_checks=$((total_checks + 1))
      if ! echo "$indexed_pages" | grep -q "$rel_path" 2>/dev/null; then
        warnings="${warnings}[WARN]  L001 ${rel_path} — 未被任何 _index.md 引用\n"
      else
        passed_checks=$((passed_checks + 1))
      fi
    fi

    # L002: Stale page
    if should_run_rule "L002"; then
      total_checks=$((total_checks + 1))
      local last_updated
      last_updated="$(fm_get "$page_file" "last_updated" 2>/dev/null || echo "")"
      local eff_staleness=0
      if [ -n "$last_updated" ]; then
        eff_staleness="$(days_between "$last_updated" "$TODAY")"
      else
        eff_staleness="$(fm_get "$page_file" "staleness_days" 2>/dev/null || echo 0)"
      fi
      if [ "$eff_staleness" -gt 90 ] 2>/dev/null; then
        warnings="${warnings}[WARN]  L002 ${rel_path} — effective_staleness_days=${eff_staleness}\n"
      else
        passed_checks=$((passed_checks + 1))
      fi
    fi

    # L003: No source
    if should_run_rule "L003"; then
      total_checks=$((total_checks + 1))
      local sources_val
      sources_val="$(fm_get "$page_file" "sources" 2>/dev/null || echo "")"
      local source_count
      source_count="$(fm_get_list "$page_file" "sources" 2>/dev/null | grep -c . 2>/dev/null || echo 0)"
      source_count="$(echo "$source_count" | tr -d '[:space:]')"
      if [ "$source_count" -eq 0 ]; then
        errors="${errors}[ERROR] L003 ${rel_path} — sources 列表为空\n"
      else
        passed_checks=$((passed_checks + 1))
      fi
    fi

    # L004: Broken ref
    if should_run_rule "L004"; then
      local refs
      refs="$(fm_get_list "$page_file" "cross_refs" 2>/dev/null || true)"
      if [ -n "$refs" ]; then
        while IFS= read -r ref_slug; do
          [ -z "$ref_slug" ] && continue
          total_checks=$((total_checks + 1))
          if ! find "${WIKI_DIR}/canon/domains" -name "${ref_slug}.md" 2>/dev/null | grep -q .; then
            errors="${errors}[ERROR] L004 ${rel_path} — cross_refs 引用不存在: ${ref_slug}\n"
          else
            passed_checks=$((passed_checks + 1))
          fi
        done <<< "$refs"
      fi
    fi

    # L005: Low confidence overdue
    if should_run_rule "L005"; then
      local conf
      conf="$(fm_get "$page_file" "confidence" 2>/dev/null || echo "")"
      if [ "$conf" = "low" ]; then
        total_checks=$((total_checks + 1))
        local last_upd
        last_upd="$(fm_get "$page_file" "last_updated" 2>/dev/null || echo "")"
        local stale=0
        if [ -n "$last_upd" ]; then
          stale="$(days_between "$last_upd" "$TODAY")"
        fi
        if [ "$stale" -gt 30 ] 2>/dev/null; then
          warnings="${warnings}[WARN]  L005 ${rel_path} — confidence=low, ${stale}天未更新\n"
        else
          passed_checks=$((passed_checks + 1))
        fi
      fi
    fi

    # L006: Conflict markers (structural check only)
    if should_run_rule "L006"; then
      total_checks=$((total_checks + 1))
      if grep -q '<<<CONFLICT>>>' "$page_file" 2>/dev/null; then
        warnings="${warnings}[WARN]  L006 ${rel_path} — 正文含 <<<CONFLICT>>> 标记\n"
      else
        passed_checks=$((passed_checks + 1))
      fi
    fi

    # L010: Type-path mismatch
    if should_run_rule "L010"; then
      total_checks=$((total_checks + 1))
      local file_type
      file_type="$(fm_get "$page_file" "type" 2>/dev/null || echo "")"
      case "$page_file" in
        */canon/*) [ "$file_type" != "source" ] && [ "$file_type" != "change-proposal" ] && passed_checks=$((passed_checks + 1)) \
                   || warnings="${warnings}[WARN]  L010 ${rel_path} — type=${file_type} 与 canon/ 路径不匹配\n" ;;
        *) passed_checks=$((passed_checks + 1)) ;;
      esac
    fi

  done < <(find "$scan_dir" -name '*.md' ! -name '_index.md' -type f 2>/dev/null | sort)

  # L007: Domain overflow
  if should_run_rule "L007" && [ "$scope" = "full" ]; then
    while IFS= read -r dom_dir; do
      local dom_name
      dom_name="$(basename "$dom_dir")"
      local page_count
      page_count="$(count_md_files "$dom_dir")"
      total_checks=$((total_checks + 1))
      if [ "$page_count" -gt 50 ] 2>/dev/null; then
        infos="${infos}[INFO]  L007 domain:${dom_name} — ${page_count}个页面，超出阈值50\n"
      else
        passed_checks=$((passed_checks + 1))
      fi
    done < <(find "${WIKI_DIR}/canon/domains" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
  fi

  # L008: Stale proposals
  if should_run_rule "L008" && [ "$scope" = "full" ]; then
    for pdir in "${WIKI_DIR}/changes/inbox" "${WIKI_DIR}/changes/review"; do
      [ -d "$pdir" ] || continue
      while IFS= read -r proposal_file; do
        [ -z "$proposal_file" ] && continue
        total_checks=$((total_checks + 1))
        local proposed_at
        proposed_at="$(fm_get "$proposal_file" "proposed_at" 2>/dev/null || echo "")"
        local prop_origin
        prop_origin="$(fm_get "$proposal_file" "origin" 2>/dev/null || echo "")"
        if [ -n "$proposed_at" ]; then
          local age
          age="$(days_between "$proposed_at" "$TODAY")"
          local threshold=7
          [ "$prop_origin" = "query-writeback" ] && threshold=14
          if [ "$age" -gt "$threshold" ] 2>/dev/null; then
            local prel
            prel="${proposal_file#${WIKI_DIR}/}"
            warnings="${warnings}[WARN]  L008 ${prel} — 已持续${age}天\n"
          else
            passed_checks=$((passed_checks + 1))
          fi
        else
          passed_checks=$((passed_checks + 1))
        fi
      done < <(find "$pdir" -name '*.md' 2>/dev/null)
    done
  fi

  # L009: Missing index
  if should_run_rule "L009" && [ "$scope" = "full" ]; then
    while IFS= read -r dom_dir; do
      total_checks=$((total_checks + 1))
      if [ ! -f "${dom_dir}/_index.md" ]; then
        local dom_name
        dom_name="$(basename "$dom_dir")"
        errors="${errors}[ERROR] L009 canon/domains/${dom_name}/ — 目录缺少 _index.md\n"
      else
        passed_checks=$((passed_checks + 1))
      fi
    done < <(find "${WIKI_DIR}/canon/domains" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
  fi

  # L011: Consecutive approve
  if should_run_rule "L011" && [ "$scope" = "full" ]; then
    total_checks=$((total_checks + 1))
    local consecutive=0
    while IFS= read -r approved_file; do
      consecutive=$((consecutive + 1))
    done < <(find "${WIKI_DIR}/changes/approved" -name '*.md' 2>/dev/null | sort -r)
    # Check for any rejections
    local has_rejection=0
    if [ -d "${WIKI_DIR}/changes/rejected" ]; then
      has_rejection="$(find "${WIKI_DIR}/changes/rejected" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
    fi
    if [ "$has_rejection" -eq 0 ] && [ "$consecutive" -ge 10 ]; then
      warnings="${warnings}[WARN]  L011 — 连续批准${consecutive}次，无拒绝记录\n"
    else
      passed_checks=$((passed_checks + 1))
    fi
  fi

  # Output report
  if [ "$format" = "json" ]; then
    echo "{"
    echo "  \"total_checks\": ${total_checks},"
    echo "  \"passed_checks\": ${passed_checks},"
    local score=100
    [ "$total_checks" -gt 0 ] && score=$((passed_checks * 100 / total_checks))
    echo "  \"health_score\": ${score},"
    echo "  \"errors\": \"$(printf '%b' "$errors" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\n')\"",
    echo "  \"warnings\": \"$(printf '%b' "$warnings" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\n')\"",
    echo "  \"infos\": \"$(printf '%b' "$infos" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\n')\""
    echo "}"
  else
    echo "========== WIKI LINT REPORT (structural) =========="
    echo "运行时间: ${NOW}"
    echo ""
    if [ -n "$errors" ]; then
      echo "---------- ERROR ----------"
      printf '%b' "$errors"
      echo ""
    fi
    if [ -n "$warnings" ]; then
      echo "---------- WARNING ----------"
      printf '%b' "$warnings"
      echo ""
    fi
    if [ -n "$infos" ]; then
      echo "---------- INFO ----------"
      printf '%b' "$infos"
      echo ""
    fi
    if [ -z "$errors" ] && [ -z "$warnings" ] && [ -z "$infos" ]; then
      echo "未发现问题。"
      echo ""
    fi
    local score=100
    [ "$total_checks" -gt 0 ] && score=$((passed_checks * 100 / total_checks))
    echo "=============================="
    echo "通过检查: ${passed_checks} / ${total_checks}"
    echo "健康分数: ${score}%"
    echo "=============================="
  fi
}

# ─── Subcommand: decay ───────────────────────────────────────────────

cmd_decay() {
  require_wiki
  local dry_run=0
  [ "${1:-}" = "--dry-run" ] && dry_run=1

  local decayed=0

  while IFS= read -r page_file; do
    local page_status
    page_status="$(fm_get "$page_file" "status" 2>/dev/null || echo "active")"
    [ "$page_status" = "archived" ] && continue

    local confidence
    confidence="$(fm_get "$page_file" "confidence" 2>/dev/null || echo "")"
    [ -z "$confidence" ] && continue
    [ "$confidence" = "low" ] && continue

    local last_updated
    last_updated="$(fm_get "$page_file" "last_updated" 2>/dev/null || echo "")"
    local eff_staleness=0
    if [ -n "$last_updated" ]; then
      eff_staleness="$(days_between "$last_updated" "$TODAY")"
    else
      eff_staleness="$(fm_get "$page_file" "staleness_days" 2>/dev/null || echo 0)"
    fi

    local new_confidence=""
    if [ "$confidence" = "high" ] && [ "$eff_staleness" -gt 90 ] 2>/dev/null; then
      new_confidence="medium"
    elif [ "$confidence" = "medium" ] && [ "$eff_staleness" -gt 180 ] 2>/dev/null; then
      new_confidence="low"
    fi

    if [ -n "$new_confidence" ]; then
      local rel_path="${page_file#${WIKI_DIR}/canon/domains/}"
      if [ "$dry_run" -eq 1 ]; then
        echo "[DRY-RUN] ${rel_path} confidence: ${confidence} → ${new_confidence} (staleness=${eff_staleness})"
      else
        fm_set "$page_file" "confidence" "$new_confidence"
        echo "[DECAY] ${rel_path} confidence: ${confidence} → ${new_confidence} (staleness=${eff_staleness})"
      fi
      decayed=$((decayed + 1))
    fi
  done < <(find "${WIKI_DIR}/canon/domains" -name '*.md' ! -name '_index.md' -type f 2>/dev/null)

  echo "decayed_count=${decayed}"
}

# ─── Subcommand: dedup-check ────────────────────────────────────────

cmd_dedup_check() {
  require_wiki
  local target_page=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --target-page) shift; target_page="$1" ;;
      *) die "dedup-check: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$target_page" ] || die "dedup-check: --target-page is required"

  local found=""
  for dir in "${WIKI_DIR}/changes/inbox" "${WIKI_DIR}/changes/review"; do
    [ -d "$dir" ] || continue
    while IFS= read -r proposal_file; do
      [ -z "$proposal_file" ] && continue
      local tp
      tp="$(fm_get "$proposal_file" "target_page" 2>/dev/null || echo "")"
      if [ "$tp" = "$target_page" ]; then
        found="$proposal_file"
        break 2
      fi
    done < <(find "$dir" -name '*.md' 2>/dev/null)
  done

  if [ -n "$found" ]; then
    echo "duplicate:${found}"
    return 1
  else
    echo "unique"
    return 0
  fi
}

# ─── Subcommand: resolve-conflict ────────────────────────────────────

cmd_resolve_conflict() {
  require_wiki
  local canon_path="" content_file=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --canon-path)   shift; canon_path="$1" ;;
      --content-file) shift; content_file="$1" ;;
      *) die "resolve-conflict: unknown option: $1" ;;
    esac
    shift
  done

  [ -n "$canon_path" ]   || die "resolve-conflict: --canon-path is required"
  [ -f "$canon_path" ]   || die "resolve-conflict: file not found: $canon_path"
  [ -n "$content_file" ] || die "resolve-conflict: --content-file is required"
  [ -f "$content_file" ] || die "resolve-conflict: content file not found: $content_file"

  if ! grep -q '<<<CONFLICT>>>' "$canon_path" 2>/dev/null; then
    die "resolve-conflict: no <<<CONFLICT>>> marker found in $canon_path"
  fi

  local tmp_file
  tmp_file="$(mktemp "${canon_path}.tmp.XXXXXX")"
  local merged_content
  merged_content="$(cat "$content_file")"

  awk -v replacement="$merged_content" '
    /<<<CONFLICT>>>/ { in_conflict=1; print replacement; next }
    /<<<END_CONFLICT>>>/ { in_conflict=0; next }
    !in_conflict { print }
  ' "$canon_path" > "$tmp_file"

  mv "$tmp_file" "$canon_path"
  echo "ok"
}

# ─── Subcommand: count ──────────────────────────────────────────────

cmd_count() {
  require_wiki
  local target="${1:-all}"

  case "$target" in
    sources)
      count_files "${WIKI_DIR}/sources"
      ;;
    canon)
      count_md_files "${WIKI_DIR}/canon/domains"
      ;;
    domains)
      find "${WIKI_DIR}/canon/domains" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' '
      ;;
    inbox)
      find "${WIKI_DIR}/changes/inbox" -name '*.md' 2>/dev/null | wc -l | tr -d ' '
      ;;
    review)
      find "${WIKI_DIR}/changes/review" -name '*.md' 2>/dev/null | wc -l | tr -d ' '
      ;;
    approved)
      find "${WIKI_DIR}/changes/approved" -name '*.md' 2>/dev/null | wc -l | tr -d ' '
      ;;
    pending)
      local i r
      i="$(find "${WIKI_DIR}/changes/inbox" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      r="$(find "${WIKI_DIR}/changes/review" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      echo $((i + r))
      ;;
    conflicts)
      find "${WIKI_DIR}/changes/conflicts" -name '*.md' 2>/dev/null | wc -l | tr -d ' '
      ;;
    all)
      echo "sources=$(count_files "${WIKI_DIR}/sources")"
      echo "canon=$(count_md_files "${WIKI_DIR}/canon/domains")"
      echo "domains=$(find "${WIKI_DIR}/canon/domains" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
      echo "inbox=$(find "${WIKI_DIR}/changes/inbox" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      echo "review=$(find "${WIKI_DIR}/changes/review" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      echo "approved=$(find "${WIKI_DIR}/changes/approved" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      echo "rejected=$(find "${WIKI_DIR}/changes/rejected" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      echo "conflicts=$(find "${WIKI_DIR}/changes/conflicts" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
      ;;
    *)
      die "count: unknown target: $target (use: sources|canon|domains|inbox|review|approved|pending|conflicts|all)"
      ;;
  esac
}

# ─── Subcommand: validate ───────────────────────────────────────────

cmd_validate() {
  require_wiki
  local file_path="" schema=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --schema) shift; schema="$1" ;;
      *)
        if [ -z "$file_path" ]; then
          file_path="$1"
        else
          die "validate: unexpected argument: $1"
        fi
        ;;
    esac
    shift
  done

  [ -n "$file_path" ] || die "validate: requires <file-path>"
  [ -f "$file_path" ] || die "validate: file not found: $file_path"

  # Auto-detect schema from type field if not specified
  if [ -z "$schema" ]; then
    schema="$(fm_get "$file_path" "type" 2>/dev/null || echo "")"
  fi

  local errors=""

  check_field() {
    local val
    val="$(fm_get "$file_path" "$1" 2>/dev/null || echo "")"
    if [ -z "$val" ] || [ "$val" = "~" ]; then
      errors="${errors}  MISSING: ${1}\n"
    fi
  }

  check_enum() {
    local val
    val="$(fm_get "$file_path" "$1" 2>/dev/null || echo "")"
    local valid="$2"
    if [ -n "$val" ] && [ "$val" != "~" ]; then
      if ! echo ",$valid," | grep -q ",${val},"; then
        errors="${errors}  INVALID: ${1}=${val} (expected: ${valid})\n"
      fi
    fi
  }

  case "$schema" in
    source)
      check_field "type"
      check_field "source_kind"
      check_field "title"
      check_field "ingested_at"
      check_field "extracted"
      check_enum "source_kind" "article,conversation,note,reference"
      ;;
    change-proposal)
      check_field "type"
      check_field "action"
      check_field "status"
      check_field "target_page"
      check_field "trigger_source"
      check_field "confidence"
      check_field "proposed_at"
      check_enum "action" "create,update,merge,split,archive"
      check_enum "status" "inbox,review,approved,rejected,conflict,resolved,deferred"
      check_enum "confidence" "high,medium,low"
      ;;
    concept|entity|comparison|guide|decision)
      check_field "type"
      check_field "title"
      check_field "domain"
      check_field "confidence"
      check_field "last_compiled"
      check_field "status"
      check_enum "confidence" "high,medium,low"
      check_enum "status" "active,archived,draft"
      local src_count
      src_count="$(fm_get_list "$file_path" "sources" 2>/dev/null | grep -c . || echo 0)"
      [ "$src_count" -eq 0 ] && errors="${errors}  MISSING: sources (list is empty)\n"
      ;;
    index)
      check_field "type"
      check_field "domain"
      ;;
    *)
      errors="${errors}  UNKNOWN_SCHEMA: cannot validate type=${schema}\n"
      ;;
  esac

  if [ -n "$errors" ]; then
    echo "INVALID"
    printf '%b' "$errors"
    return 1
  else
    echo "VALID"
    return 0
  fi
}

# ─── Subcommand: consecutive-approve-count ───────────────────────────

cmd_consecutive_approve_count() {
  require_wiki
  local approved_dir="${WIKI_DIR}/changes/approved"
  local rejected_dir="${WIKI_DIR}/changes/rejected"

  # Get the most recent rejection date
  local last_reject_date=""
  if [ -d "$rejected_dir" ]; then
    while IFS= read -r rej_file; do
      [ -z "$rej_file" ] && continue
      local rat
      rat="$(fm_get "$rej_file" "reviewed_at" 2>/dev/null || echo "")"
      if [ -n "$rat" ] && [ "$rat" != "~" ]; then
        if [ -z "$last_reject_date" ] || [ "$rat" \> "$last_reject_date" ]; then
          last_reject_date="$rat"
        fi
      fi
    done < <(find "$rejected_dir" -name '*.md' 2>/dev/null)
  fi

  # Count approvals after last rejection
  local count=0
  if [ -d "$approved_dir" ]; then
    while IFS= read -r app_file; do
      [ -z "$app_file" ] && continue
      local aat
      aat="$(fm_get "$app_file" "reviewed_at" 2>/dev/null || echo "")"
      if [ -n "$aat" ] && [ "$aat" != "~" ]; then
        if [ -z "$last_reject_date" ] || [ "$aat" \> "$last_reject_date" ]; then
          count=$((count + 1))
        fi
      fi
    done < <(find "$approved_dir" -name '*.md' 2>/dev/null)
  fi

  echo "$count"
}

# ─── Main dispatcher ─────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Usage: wiki-ops <subcommand> [options]

File creation:
  create-source       Create a source file with validated frontmatter
  create-proposal     Create a proposal file with validated frontmatter
  create-canon        Create a canon page from template

Lifecycle transitions:
  move-proposal       Move proposal between lifecycle stages (inbox→approved etc.)
  mark-extracted      Set source file extracted=true
  mark-compiled       Set proposal compiled=true with timestamp

Frontmatter operations:
  frontmatter         Read/write frontmatter fields (get|set|get-list)
  validate            Validate file against schema

Index & state management:
  update-index        Add/remove/sync domain _index.md entries
  update-state        Recalculate STATE.md from filesystem
  append-log          Append structured entry to LOG.md

Scanning & analysis:
  scan                Run deterministic lint rules (L001-L011 structural subset)
  decay               Apply staleness-based confidence decay
  dedup-check         Check if proposal for target_page already exists
  count               Count files by category
  consecutive-approve-count  Count consecutive approves since last reject

Conflict resolution:
  resolve-conflict    Replace <<<CONFLICT>>> markers with merged content

Environment:
  WIKI_ROOT           Override wiki repository root (default: script parent dir)
EOF
}

SUBCOMMAND="${1:-}"
[ -n "$SUBCOMMAND" ] || { usage; exit 0; }
shift

case "$SUBCOMMAND" in
  create-source)              cmd_create_source "$@" ;;
  create-proposal)            cmd_create_proposal "$@" ;;
  create-canon)               cmd_create_canon "$@" ;;
  move-proposal)              cmd_move_proposal "$@" ;;
  mark-extracted)             cmd_mark_extracted "$@" ;;
  mark-compiled)              cmd_mark_compiled "$@" ;;
  frontmatter)                cmd_frontmatter "$@" ;;
  update-index)               cmd_update_index "$@" ;;
  update-state)               cmd_update_state "$@" ;;
  append-log)                 cmd_append_log "$@" ;;
  scan)                       cmd_scan "$@" ;;
  decay)                      cmd_decay "$@" ;;
  dedup-check)                cmd_dedup_check "$@" ;;
  resolve-conflict)           cmd_resolve_conflict "$@" ;;
  count)                      cmd_count "$@" ;;
  validate)                   cmd_validate "$@" ;;
  consecutive-approve-count)  cmd_consecutive_approve_count ;;
  help|-h|--help)             usage ;;
  *) die "unknown subcommand: $SUBCOMMAND" ;;
esac
