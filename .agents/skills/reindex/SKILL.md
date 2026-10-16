---
name: reindex
context: fork
description: Rebuild machine-generated OKF `index.md` files or audit Area app manifests. Use for "/reindex", "rebuild the indexes", "regenerate index.md", "the project index is stale", "sync indexes", "check for orphan repos", or "audit app manifests". Default mode deterministically rebuilds Projects, Areas, and Resources indexes. App-audit mode lists app folders under `<workspace.area_apps>` that lack an `app.manifest.json` and writes a manifest only after explicit approval.
allowed-tools: Bash Read Edit AskUserQuestion
---

# reindex

Regenerates the OKF `index.md` files across the workspace. Each `index.md` is a **machine-generated, never-hand-edited** view of the markdown files in its directory — file name, OKF `type`, and one-line `description` pulled from frontmatter, plus a subdirectory listing. It answers "what already exists here and where do new files go" cheaply, which stops the same file being recreated under a new name.

**Why a generated index is fine when hand-kept index files aren't:** hand-maintained index files drift. A machine-generated index is a derived cache of the frontmatter, which stays the source of truth, so it cannot drift; it just gets regenerated. Every `index.md` carries an `AUTO-GENERATED` header; the generator refuses to clobber any `index.md` that lacks it (so a human-authored one is surfaced, never overwritten).

## When to use

- After moving / renaming files in bulk (the live hook only fires on single edits).
- When older projects never had an index — generating one for each.
- When an `index.md` looks stale or you want a full rebuild.
- `/reindex` with no args = full rebuild of each child bundle under `1-Projects/`, `2-Areas/`, and `4-Resources/`.
- `/reindex app-audit` or "sync indexes" = audit Area app manifests; do not generate OKF files.

The everyday case is handled automatically by `.claude/hooks/okf-index-regen.mjs` (PostToolUse) — you rarely need to run this by hand.

## Process

All paths resolve from the Configuration section in root CLAUDE.md (`workspace.root`, `workspace.projects`, `workspace.areas`). The runner script is at `.claude/skills/reindex/reindex.sh`; the generator it calls is `.claude/hooks/lib/okf-index.mjs`.

### Default — full rebuild (no args)

Reindex every project under `1-Projects/`, every Area under `2-Areas/`, and every Resources subfolder under `4-Resources/` (the primary OKF surface) as its own bundle root. **Never** generate an `index.md` at the `1-Projects/` or `2-Areas/` root itself — those roots are managed by `inject-projects.mjs` (project discovery) and are too broad for a file-level index.

```bash
bash .claude/skills/reindex/reindex.sh "<workspace.root>/<workspace.projects>" --each-child
bash .claude/skills/reindex/reindex.sh "<workspace.root>/<workspace.areas>" --each-child
bash .claude/skills/reindex/reindex.sh "<workspace.root>/<workspace.resources>" --each-child
```

### Area indexes (thin-Areas model)

Each `<workspace.areas>/<name>/index.md` is generated differently from a project index: it's a **project listing for that Area**, built from project `CLAUDE.md` frontmatter (`parent_hq: <name>`) scanned across BOTH `1-Projects/` (active) AND `5-Archive/` (done). It lists active + archived projects with status and one-line description, so an Area's history stays discoverable after projects archive whole. Same rules as every other index: machine-generated, `AUTO-GENERATED` header, never hand-edited — `/archive-project` Step 8 and this skill regenerate it. `parent_hq` may be the bare name, the `2-Areas/<name>` path, or either with a trailing `# comment`; it must sit in the frontmatter block. Area indexes are generator-owned, so the generator always rewrites them and never reports them as `refused`.

**Code repos are auto-skipped.** The generator skips Area apps (`<workspace.area_apps>/*`), project `app/` subtrees (`<workspace.project_apps>` and `<workspace.archive>/*/app`), cloned forks in `4-Resources/github-forks/`, and any directory inside a nested git repo — those are external repos, not OKF knowledge bundles. Don't special-case them; the skip is built into the generator.

### Targeted — one project or path

```bash
bash .claude/skills/reindex/reindex.sh "<workspace.root>/<workspace.projects>/<slug>"
```

This recursively reindexes that one bundle (its root and every subfolder).

### App-audit mode

Shipped apps are discovered by their `app.manifest.json` (the session-start inventory reads them), so an app folder without one is invisible.

1. Read root Configuration. List direct, non-hidden directories under every `<workspace.root>/<workspace.area_apps>` and flag those without `app.manifest.json`. Also flag manifests that fail to parse as JSON.
2. For each flagged folder, best-effort read `git remote get-url origin`, the last commit date, and the repo README's first line. Propose a manifest with `schema_version`, `app_id`, `name`, `owner_area`, `kind` (`mcp` for MCP servers, otherwise `app`), `status`, `visibility`, `stack`, `purpose` and `repo`; leave unknown fields as `"needs review"`.
3. Display the proposals. Make no changes when the user asked only to audit. Write a manifest only after explicit approval for that app.
4. Report written, skipped, and still-missing counts.

### Report

The generator prints `written\t<path>` for each changed index, `refused\t<path>` for any hand-written index it left alone, and a `done: N written, M refused` summary. Relay that to the user — especially any `refused` lines, which mean a human-authored `index.md` exists where the generator expected to manage one (resolve by renaming the human file or converting it).

## Boundaries

- **Default mode only mutates generated `index.md` files.** App-audit mode may only create `app.manifest.json` files after approval. Never touches concept docs, frontmatter, or folder structure.
- **Never overwrites a hand-written `index.md`** (one without the `AUTO-GENERATED` marker or the older `MACHINE-GENERATED (thin-Areas index)` marker, and not the headerless `# <dir>` + `* [name](link) - …` bullet format an older index script wrote) — it's reported as `refused`. Area indexes are the exception: always generator-owned.
- **Never indexes code repos** — Area apps, project `app/` subtrees, cloned forks, and anything inside a nested `.git` are skipped automatically. They're external repos, not OKF bundles.
- Deterministic + idempotent: re-running with no file changes writes nothing.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `not a directory` | Wrong path / typo | Check the path resolves under the workspace |
| `refused` lines in output | A hand-written `index.md` exists | Rename it (e.g. `overview.md`) or delete it so the generator can manage `index.md` |
| Index lists `—` for type/description | Source file lacks OKF frontmatter | Add `type:` + `description:` to that file's frontmatter, then reindex |
| `node: command not found` | Node not on PATH in this shell | Generator requires Node (same as every other hook); ensure Node is installed |
