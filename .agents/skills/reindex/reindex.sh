#!/usr/bin/env bash
# reindex.sh — regenerate machine-generated OKF index.md across a workspace subtree.
#
# The index is a derived
# view of each file's frontmatter — never hand-edited. This rebuilds it in bulk;
# the okf-index-regen.mjs PostToolUse hook keeps it fresh on live edits.
#
# Usage:
#   reindex.sh <dir>               recursively reindex <dir> (the dir itself is a bundle root)
#   reindex.sh <dir> --each-child  reindex each immediate subdir of <dir> as its own bundle root
#                                  (use for 1-Projects/ and 2-Areas/ — never index those roots themselves)
set -euo pipefail

# Repo root is three levels up whether this runs as .claude/skills/reindex/ or .agents/skills/reindex/.
GEN="$(cd "$(dirname "$0")/../../.." && pwd)/.claude/hooks/lib/okf-index.mjs"
DIR="${1:?usage: reindex.sh <dir> [--each-child]}"
MODE="${2:-}"

if [[ ! -d "$DIR" ]]; then
  echo "reindex: not a directory: $DIR" >&2
  exit 1
fi

# Collection roots (Projects, Areas, Archive) hold many bundles and must never be
# indexed as one bundle: doing so rewrites every heading and sprays index.md
# files into every subfolder. Names come from the root CLAUDE.md Configuration.
# okf-index.mjs finds the outer repo by walking up the path; a relative path
# ends at "." and every directory gets skipped as a nested repo.
DIR="$(cd "$DIR" && pwd)"

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
token() { sed -nE "s/^- \`workspace\.$1\` = \`([^\`]+)\`.*/\1/p" "$ROOT/CLAUDE.md" 2>/dev/null | head -1; }
if [[ "$MODE" != "--each-child" ]]; then
  base="$(basename "$(cd "$DIR" && pwd)")"
  for t in projects areas archive; do
    if [[ -n "$(token "$t")" && "$base" == "$(token "$t")" ]]; then
      echo "reindex: $DIR is a collection root; run: reindex.sh $DIR --each-child" >&2
      exit 2
    fi
  done
fi

if [[ "$MODE" == "--each-child" ]]; then
  shopt -s nullglob
  for child in "$DIR"/*/; do
    [ -d "$child" ] || continue
    node "$GEN" "${child%/}" --recursive
  done
else
  node "$GEN" "$DIR" --recursive
fi
