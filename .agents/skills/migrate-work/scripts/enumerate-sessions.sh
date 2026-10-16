#!/usr/bin/env bash
# enumerate-sessions.sh — READ-ONLY. Emits one JSON object per past Claude or Codex session
# across the four local stores, normalized so sessions can be grouped into projects.
#
#   cowork    ~/Library/Application Support/Claude/local-agent-mode-sessions/**/local_*.json (+ audit.jsonl)
#   desktop   ~/Library/Application Support/Claude/claude-code-sessions/**/local_*.json  (Code tab metadata)
#   cli       ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl                             (Claude Code transcripts)
#   codex     ~/.codex/{sessions/YYYY/MM/DD,archived_sessions}/rollout-*.jsonl + session_index.jsonl
#
# desktop and cli overlap: a desktop session's cliSessionId is the cli transcript's basename.
# Overlapping transcripts are emitted once, as source=desktop with transcript_status=present.
#
# A Codex thread can span several rollout files (one per page); it is emitted once, keyed by its
# session_meta id. Subagent threads are sidechains and are skipped, like Claude's subagents/.
#
# Usage: enumerate-sessions.sh [--workspace-root <abs path>] [--exclude-session <id>]
# Output: JSONL on stdout, one line per session. One line on stderr saying which stores were
# read and how many Codex subagent threads were skipped:
#   {"stores":{"cowork":"read"|"absent",...},"skipped":{"codex_subagent_threads":N}} Never writes anything else.
set -uo pipefail

WS_ROOT=""
EXCLUDE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --workspace-root) WS_ROOT="$2"; shift 2 ;;
    --exclude-session) EXCLUDE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

APP="$HOME/Library/Application Support/Claude"
COWORK="$APP/local-agent-mode-sessions"
DESKTOP="$APP/claude-code-sessions"
CLI="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects"
CODEX="${CODEX_HOME:-$HOME/.codex}"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# Shared normalizer: project_key + noise classification. Input fields: cwd, origin, selected.
# Container dirs ($HOME, ~/Desktop, ~/Downloads, ~/Documents) and temp dirs never form a project key.
NORMALIZE='
  "^(/private)?/tmp(/|$)|^(/private)?/var/folders/[^/]+/[^/]+/T/|/scratchpad(/|$)" as $tmp_re
  |
  def strip_wt: sub("/\\.claude/worktrees/[^/]+$"; "");
  def key_from($p):
    if ($p // "") == "" then null
    elif ($p | test("^/sessions/|/local-agent-mode-sessions/|/\\.codex/")) then null
    elif ($p | startswith($home + "/Documents/Codex/")) then null
    elif ($p | test($tmp_re)) then null
    elif ([$home, $home+"/Desktop", $home+"/Downloads", $home+"/Documents"] | index($p)) then null
    else ($p | strip_wt) end;
  . as $s
  | ($s.selected // null) as $sel
  | (key_from($sel) // key_from($s.origin) // key_from($s.cwd)) as $k
  | $s + {
      project_key: $k,
      noise: (
        if $s.scheduled then "scheduled-task"
        elif ($s.cwd // "" | test($tmp_re)) and $k == null then "temp-dir"
        elif $s.entrypoint == "sdk-cli" and (($s.title // "") == "") then "headless-run"
        elif $s.entrypoint == "codex-exec" then "headless-run"
        elif $k == null and (($s.title // "") == "") then "no-cwd-no-title"
        else null end),
      in_workspace: ($ws != "" and $k != null and ($k == $ws or ($k | startswith($ws + "/")))),
      is_workspace_root: ($ws != "" and $k == $ws)
    }
  | del(.selected, .scheduled)
'

# --- 1. cowork -------------------------------------------------------------
if [ -d "$COWORK" ]; then
  find "$COWORK" -maxdepth 3 -name 'local_*.json' -not -path '*/local_*/*' -print0 2>/dev/null |
  while IFS= read -r -d '' meta; do
    dir="${meta%.json}"
    audit="$dir/audit.jsonl"; [ -f "$audit" ] || audit=""
    jq -c --arg audit "$audit" --arg home "$HOME" --arg ws "$WS_ROOT" '
      {source:"cowork", id:.sessionId, title:(.title//""), cwd:(.cwd//""), origin:null,
       selected:((.userSelectedFolders//[])[0]),
       initial_message:((.initialMessage//"")|.[0:200]),
       created_ms:.createdAt, last_ms:.lastActivityAt, entrypoint:"cowork",
       archived:(.isArchived//false), scheduled:((.scheduledTaskId//null)!=null),
       transcript:(if $audit=="" then null else $audit end),
       transcript_status:(if $audit=="" then "none" else "present" end)}
      | '"$NORMALIZE" "$meta" 2>/dev/null
  done
fi

# --- 2. desktop Code tab (metadata; transcript lives in cli store) ----------
SEEN="$(mktemp)"; trap 'rm -f "$SEEN"' EXIT
if [ -d "$DESKTOP" ]; then
  find "$DESKTOP" -name 'local_*.json' -print0 2>/dev/null |
  while IFS= read -r -d '' meta; do
    cli_id="$(jq -r '.cliSessionId // empty' "$meta" 2>/dev/null)"
    [ -n "$EXCLUDE" ] && [ "$cli_id" = "$EXCLUDE" ] && continue
    tr=""
    if [ -n "$cli_id" ]; then
      # dir names start with "-": always glob with a ./ -style absolute prefix, never bare
      for f in "$CLI"/*/"$cli_id.jsonl"; do [ -f "$f" ] && tr="$f" && break; done
      echo "$cli_id" >> "$SEEN"
    fi
    jq -c --arg tr "$tr" --arg home "$HOME" --arg ws "$WS_ROOT" '
      {source:"desktop", id:(.cliSessionId // .sessionId), title:(.title//""), cwd:(.cwd//""),
       origin:(.originCwd//null), selected:null, initial_message:null,
       created_ms:.createdAt, last_ms:.lastActivityAt, entrypoint:"claude-desktop",
       archived:(.isArchived//false), scheduled:((.scheduledTaskId//null)!=null),
       transcript:(if $tr=="" then null else $tr end),
       transcript_status:(if $tr!="" then "present" elif (.cliSessionId//"")!="" then "purged" else "none" end)}
      | '"$NORMALIZE" "$meta" 2>/dev/null
  done
fi

# --- 3. cli transcripts not already covered by desktop metadata --------------
if [ -d "$CLI" ]; then
  # top level only (maxdepth 2): <uuid>/subagents/*.jsonl are sidechains, and project
  # dirs can hold 100k+ tool-results subdirs — never recurse.
  find "$CLI" -mindepth 2 -maxdepth 2 -name '*.jsonl' -print0 2>/dev/null |
  while IFS= read -r -d '' tr; do
    id="$(basename "$tr" .jsonl)"
    [ -n "$EXCLUDE" ] && [ "$id" = "$EXCLUDE" ] && continue
    grep -qxF "$id" "$SEEN" && continue
    jq -nc --arg tr "$tr" --arg id "$id" --arg home "$HOME" --arg ws "$WS_ROOT" '
      def ms: if . == null then null else (sub("\\.[0-9]+Z$";"Z") | fromdateiso8601 * 1000) end;
      reduce inputs as $r ({cwd:null, title:null, first:null, last:null, ep:null};
        .cwd   = (.cwd // $r.cwd)
      | .ep    = (.ep // $r.entrypoint)
      | .first = (.first // $r.timestamp)
      | .last  = ($r.timestamp // .last)
      | .title = (if $r.type=="custom-title" then $r.customTitle
                  elif $r.type=="ai-title" and .title==null then $r.aiTitle
                  elif $r.type=="agent-name" and .title==null then $r.agentName
                  else .title end))
      | {source:"cli", id:$id, title:(.title//""), cwd:(.cwd//""), origin:null, selected:null,
         initial_message:null, created_ms:(.first|ms), last_ms:(.last|ms), entrypoint:(.ep//"unknown"),
         archived:false, scheduled:false, transcript:$tr, transcript_status:"present"}
      | '"$NORMALIZE" "$tr" 2>/dev/null
  done
fi

# --- 4. codex: rollout files, one row per thread ------------------------------
# The first record of every rollout file is session_meta (id, cwd, timestamp, source,
# thread_source, originator). A long thread spans several files that share the id.
# Titles live in session_index.jsonl (last entry wins). A thread listed there with no
# rollout file left is reported as purged: title and date only.
CODEX_STATE=absent
CODEX_SUBS=0
if [ -d "$CODEX/sessions" ] || [ -d "$CODEX/archived_sessions" ] || [ -f "$CODEX/session_index.jsonl" ]; then
  CODEX_STATE=read
  METAS="$(mktemp)"; INDEX="$(mktemp)"; trap 'rm -f "$SEEN" "$METAS" "$INDEX"' EXIT
  if [ -f "$CODEX/session_index.jsonl" ]; then
    jq -c 'select(.id != null) | {id, title:(.thread_name//""), updated:(.updated_at//null)}' \
      "$CODEX/session_index.jsonl" > "$INDEX" 2>/dev/null || :
  fi
  # depth: sessions/YYYY/MM/DD/<file> and archived_sessions/<file>; never recurse further
  {
    find "$CODEX/sessions" -mindepth 4 -maxdepth 4 -name 'rollout-*.jsonl' -print0 2>/dev/null
    find "$CODEX/archived_sessions" -mindepth 1 -maxdepth 1 -name 'rollout-*.jsonl' -print0 2>/dev/null
  } | while IFS= read -r -d '' f; do
    case "$f" in "$CODEX/archived_sessions"/*) arch=true ;; *) arch=false ;; esac
    head -n 1 "$f" 2>/dev/null | jq -c --arg f "$f" --argjson arch "$arch" '
      select(.type == "session_meta") | .payload | select((.id // "") != "")
      | {id, cwd:(.cwd//""), ts:(.timestamp//null), file:$f, archived:$arch,
         remote:(.git.repository_url // null),
         sub:((.source|type) == "object" or .thread_source == "subagent"),
         ep:(if .source == "exec" then "codex-exec"
             elif .source == "cli" then "codex-cli"
             elif ((.originator//"") | ascii_downcase | test("desktop")) then "codex-desktop"
             else "codex-ide" end)}' 2>/dev/null
  done > "$METAS"
  CODEX_SUBS="$(jq -s '[.[] | select(.sub)] | map(.id) | unique | length' "$METAS" 2>/dev/null || echo 0)"

  # one line per thread: files ordered oldest page first; subagent sidechains dropped
  jq -sc --slurpfile idx "$INDEX" '
    ($idx | map({(.id): .}) | add // {}) as $titles
    | (map(select(.sub | not)) | group_by(.id) | map(sort_by(.ts // "")) | map({
        id: .[0].id, cwd: .[0].cwd, created: .[0].ts, ep: .[0].ep,
        remote: (map(.remote) | map(select(. != null)) | last),
        archived: (map(.archived) | any), parts: map(.file),
        title: ($titles[.[0].id].title // "")})) as $threads
    | (map(.id)) as $any
    | $threads[], ($titles[] | select(.id as $i | ($any | index($i)) == null)
        | {id, cwd:"", created:null, ep:"unknown", archived:false, parts:[], remote:null,
           title, purged_last:.updated})
  ' "$METAS" 2>/dev/null |
  while IFS= read -r t; do
    id="$(jq -r .id <<<"$t")"
    [ -n "$EXCLUDE" ] && [ "$id" = "$EXCLUDE" ] && continue
    first="$(jq -r '.parts[0] // empty' <<<"$t")"
    last_file="$(jq -r '.parts[-1] // empty' <<<"$t")"
    last_ts=""; fallback=""
    if [ -n "$last_file" ]; then
      last_ts="$(tail -n 1 "$last_file" 2>/dev/null | jq -r '.timestamp // empty' 2>/dev/null)"
      # no index title: use the first real prompt (harness wrappers and pasted files skipped)
      if [ "$(jq -r .title <<<"$t")" = "" ]; then
        fallback="$(jq -rn 'first(inputs
          | select(.type=="response_item" and .payload.type=="message" and .payload.role=="user")
          | [.payload.content[]? | select(.type=="input_text") | .text] | join(" ")
          | select(length > 0)
          | select(test("^\\s*(<[a-z][a-z_-]*[ >]|# AGENTS\\.md instructions|# Files mentioned by the user)") | not)
          | gsub("\\s+";" ") | .[0:80]) // ""' "$first" 2>/dev/null)"
      fi
    fi
    jq -c --arg last "$last_ts" --arg fb "$fallback" --arg home "$HOME" --arg ws "$WS_ROOT" '
      def ms: if . == null or . == "" then null
              else (sub("\\.[0-9]+";"") | sub("\\+00:?00$";"Z") | (try (fromdateiso8601 * 1000) catch null)) end;
      {source:"codex", id, title:(if .title == "" then $fb else .title end), cwd, origin:null, selected:null,
       initial_message:null, created_ms:(.created|ms),
       last_ms:(if $last != "" then ($last|ms) elif .purged_last then (.purged_last|ms) else (.created|ms) end),
       entrypoint:.ep, archived, scheduled:false, git_remote:.remote,
       transcript:(.parts[-1] // null), transcript_parts:.parts,
       transcript_status:(if (.parts|length) > 0 then "present" else "purged" end)}
      | '"$NORMALIZE" <<<"$t" 2>/dev/null
  done
fi

# --- which stores were read (stderr, so stdout stays pure JSONL) --------------
st() { [ -d "$1" ] && echo read || echo absent; }
printf '{"stores":{"cowork":"%s","desktop":"%s","cli":"%s","codex":"%s"},"skipped":{"codex_subagent_threads":%s}}\n' \
  "$(st "$COWORK")" "$(st "$DESKTOP")" "$(st "$CLI")" "$CODEX_STATE" "$CODEX_SUBS" >&2
