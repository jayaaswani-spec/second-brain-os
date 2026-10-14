---
name: new-project
description: "Give new multi-session work a home: a PROJ or COD project under 1-Projects, or an Area-owned app repo, after checking for existing work to continue or revive. Use when bounded work will outlast this conversation, even unnamed as a project (a backlog push, an event or campaign, an onboarding package, a new app, MCP server, agent or repo), and before creating any folder under 1-Projects/ or apps/. Not for one-off tasks, existing projects, or specs and tickets (/to-spec, /to-tickets)."
allowed-tools: Read Write Bash AskUserQuestion Skill
---

# new-project

Scaffolds any new project: a `PROJ-` project, a `COD-` project for code still being built, or a repo for a shipped app that an existing Area owns. They share most of the logic; the differences (folder location, git init, GitHub repo, app manifest) live in one branch on the project-type question.

**Before you begin: read the Configuration section in root CLAUDE.md.** All paths, the user's name, and their GitHub username come from there. Throughout this skill, references like `<workspace.projects>` and `<user.github>` resolve to whatever's defined in that section. Don't hardcode.

## Why this exists

Per-project YAML frontmatter is the source of truth for project discovery. Every new project must start with that frontmatter populated correctly, or `/prune-projects` and frontmatter queries break. Doing this by hand is error-prone — date prefix, status field, project-type enum, template selection, and (for code) GitHub remote setup all need to be right. This skill makes the happy path one command.

**OKF structure:** every project under `<workspace.projects>/` scaffolds a machine-generated `index.md` alongside `CLAUDE.md` + `memory.md`. The index is a *derived view* of frontmatter and is never hand-edited. It answers "what exists here", the fix for ad-hoc file recreation. **Do NOT pre-create folders**: no forced `inputs/`/`working/`/`outputs/` layout (OKF organizes by *concept*, not lifecycle). Concept folders emerge as the project's content arrives, named for what they hold (see the naming conventions in root CLAUDE.md).

Code projects fold into this skill rather than living in a separate `/new-code-project` because the *shape* is the same: a folder with CLAUDE.md + memory.md + status frontmatter. New code starts as a `COD-` project (the `code-effort` type): the project folder holds the plan, notes and outputs, and the code lives in the project's own ignored `app/` (`<workspace.project_apps>`). Once an app ships and an Area owns it, it moves to `<workspace.area_apps>`; the `code-repo` type scaffolds that kind of Area-owned repo directly, with its own git, an optional GitHub remote, and an `app.manifest.json` for discovery.

## When to use

Trigger on **intent, not vocabulary.** <user.name> rarely says "project". The test is one question: *will this work need a home that outlasts this conversation?* If it will, this skill runs. Over-triggering is cheap, because Step 0 offers "continue the existing one" and "capture to Inbox" before anything gets scaffolded. Missing is expensive. A hand-made folder skips the `/find` dedup, the frontmatter, the `parent_hq:` link and the index, and `/prune-projects` can't see it.

**Intent signals** (any one is enough):
- **A goal with a finish line.** Something to get through, deliver, launch or hand off over days or weeks, such as a backlog, a rollout, a package, a plan, an event, a migration or a hire.
- **"Properly", "diligently" or "set this up".** The user wants a durable setup, not a one-time answer.
- **Multiple sources to gather and keep.** Slack threads, meeting notes, docs and repos that will feed ongoing work.
- **Something to build.** An app, MCP server, agent, bot, CLI, library, dashboard or repo (the `code-effort` type, or `code-repo` for a shipped app an existing Area owns).
- **A home is assumed but missing.** "Save this in our project" or "put it with the other X stuff", and no project owns the work yet.
- **You are about to create a new folder** under `<workspace.projects>/` or an Area's `apps/`. Route through this skill instead of `mkdir` or `Write`.

**Mid-conversation triggering.** Work often starts as a question and becomes a project. When a debugging session, research question or review has clearly grown past one sitting, with a plan forming, follow-ups queued and files worth keeping, offer: *"This is turning into real work. Want me to set it up as a project?"* Run the skill if the user agrees.

**Code-flavored phrasings** default to the `code-effort` type (a `COD-` project with the code in its ignored `app/`). Examples are "new MCP server for X", "scaffold an agent", "spin up a repo", "build a CLI/bot/library" and "new TypeScript/Python project". Use `code-repo` only when the app is already shipped, or about to be, and an existing Area will own it.

Do NOT trigger for:
- **One-sitting tasks.** "Draft an email", "summarize this transcript" or "fix this bug" need no home, even when they're substantial.
- **Continuing existing work.** When a project already owns the work, append to its `memory.md` and work inside it. If you're unsure whether one exists, trigger anyway, because Step 0's `/find` answers that.
- **Planning artifacts for existing work.** Use `/to-spec`, `/to-tickets` or `/wayfinder`.
- **One-off scripts that don't deserve their own repo.** Put them in the owning project, or in `<workspace.inbox>/` if nothing owns them yet.

## Process

The skill is interactive. Confirm before writing files — the user can correct typos.

### Step 0: Connect before create — `/find` first

**Before any scaffolding, search.** Per SOUL.md Operating Principles ("Connect before create" / "Revive before scaffold" / "Capture before commit"), the second brain's whole purpose is knowing what already exists — AND not promoting half-formed ideas to full project scaffolds.

Run `/find <proposed-slug>` and `/find <topic-keywords>` across `<workspace.root>/<workspace.projects>/`, `<workspace.root>/<workspace.archive>/`, and `<workspace.root>/<workspace.areas>/*/apps/`. Then ask the user via `AskUserQuestion` — the option set depends on what was found:

**If matches surface:**
```
Found existing work that may match:
  · 1-Projects/PROJ-2026-01-q1-hiring-plan/   (active, last touched 2026-04-14)
  · 5-Archive/PROJ-2025-12-hiring-pilot/       (archived, last touched 2025-12-15)

How do you want to proceed?
  [1] Continue in the active project (open <path>)
  [2] Revive the archived one (mv to <workspace.projects>/, flip frontmatter status: done → active,
      append "revived: <date> — <reason>" to memory.md)
  [3] Start fresh — this is genuinely a different scope
  [4] Capture to <workspace.inbox>/<slug>/ — uncertain, decide later via /inbox-process
  [5] Cancel — I'll pick the existing path manually
```

**If no matches:**
```
No existing work found for "<topic>".

How do you want to proceed?
  [1] Scaffold a full project now — this is real, scoped work
  [2] Capture to <workspace.inbox>/<slug>/ — uncertain or exploratory, decide later
  [3] Cancel
```

**The "capture to Inbox" branch (option [4] with-matches / [2] without-matches):** create `<workspace.root>/<workspace.inbox>/<slug>/` (or single `<slug>.md` file if the user is capturing a thought, not a folder of material) — NO `CLAUDE.md`, NO frontmatter, NO `memory.md`. Just the slug folder/file with whatever initial content the user has. Then stop. `/inbox-process` (Friday triage) will revisit and either promote to `<workspace.projects>/`, file in `<workspace.resources>/`, or archive. The signal that something belongs in Inbox vs Projects: **uncertainty about whether it's a project at all.** Half-formed ideas, exploratory captures, "I might want to look at this later," generated artifacts (decks/dashboards/reports) without a project owner — all Inbox. Things with a clear scope, deliverables, and commitment to follow through — those earn the `<workspace.projects>/` scaffold.

**Step 0 is mandatory — not skippable on a judgement call.** The only waiver is an explicit, in-the-prompt user statement (*"yes, start a fresh project — I know <topic> exists / I'm sure this is project-scoped"*). Absent that exact signal, the `/find` + capture-vs-commit precheck always runs. Backstop: even if this step is somehow skipped, the `connect-before-create` PreToolUse guard fires when the skill writes to a new `<workspace.projects>/` path and surfaces the closest existing matches for confirmation — so dedup is enforced at two layers, not one. The cost is one /find call (cheap); the benefit is preventing two failure modes: (a) `<topic>-revival` / `<topic>-v2` siblings that fragment lineage, AND (b) the unmigrated-folder graveyard in `<workspace.projects>/` (folders without CLAUDE.md that should have been Inbox captures).

For the app-repo branch, `/find` should hit every Area's `apps/` subtree plus COD project and archive `app/` folders to surface existing repos. The `<topic>-revival` anti-pattern applies there too. App repos do NOT have a "capture to Inbox" branch — by the time you're scaffolding a repo, you've committed. Code uncertainty stays in chat or a scratch file.

If the user picks "scaffold full project" (or there were matches and they picked [3] start fresh) → proceed to Step 1. If they picked "capture to Inbox" → execute the capture (mkdir or write file), confirm to user, stop.

### Step 1: Get the project name

`AskUserQuestion` is multi-choice only — don't use it for free text:

1. **Check the invocation context first.** If the user named the thing in the trigger prompt ("let's start a project on the Q3 newsletter" or "scaffold an MCP server for the Anthropic admin API"), extract the name. For code projects, derive a reasonable kebab-case identifier (`anthropic-admin-mcp`).
2. **If the trigger was implicit, propose a name from the goal.** A prompt like "I'm behind on expense receipts" never names a project, so name it for the outcome (`expense-catchup`), not the first noun. The Step 4 confirmation lets the user correct it.
3. **Otherwise ask in plain chat.** Print the question and wait for the next user message. Don't call `AskUserQuestion` for a free-text response — that creates a stutter (forces "Other → type" pattern).

### Step 2: Ask for the project type

Use `AskUserQuestion` with these choices:

- `design` — system design, architecture, planning meta-work
- `research` — exploratory investigation, deep-dives, literature reviews
- `execution` — operational rollout, project management, delivering an outcome
- `content` — YouTube, writing, talks, decks
- `meeting` — single-meeting prep packages
- `ongoing` — recurring duties (manager 1:1s, office hours, etc.)
- `code-effort` — code still being built: an app, service, MCP server, agent, library, CLI or prototype. Makes a `COD-` project whose code lives in its own ignored `app/`. The default for new code.
- `code-repo` — a shipped app, service or MCP server that an existing Area owns, with its own git repo under that Area's `apps/`

Why force the choice: this drives folder location, template selection, and downstream lifecycle. An `ongoing` project is never stale at 90 days; an `execution` project usually is; a `code-effort` project keeps its code in its own ignored `app/`; a `code-repo` lives under its owning Area's ignored `apps/` subtree. Misclassification breaks the lifecycle.

**If type = `code-repo`, run Step 2c (owning Area) first, then Steps 2a–2b. Every other type, `code-effort` included, continues to Step 3.**

New app repos are grouped by owning Area: `<workspace.root>/<workspace.areas>/<area>/apps/<name>/`. The repository folder itself remains stable lowercase-kebab. (Third-party clones kept for reference go to `<workspace.root>/<workspace.resources>/github-forks/`, created on first use; they're reference material, not active development.)

### Step 2a (code-repo only): Ask for stack

`AskUserQuestion` with options + Other:

- TypeScript / Node
- Python
- Rust
- Markdown only (for docs / reading-list / reference repos)
- TBD (when the user is exploring and doesn't know yet — agent loops, prototypes, anything that might pivot)
- Other (free text in next chat message)

`TBD` is intentional. Forcing a commitment at scaffold time is wrong for exploratory work. If TBD, write `stack: []` (empty YAML array) and the user fills it in once the repo's purpose firms up.

### Step 2b (code-repo only): GitHub repo?

`AskUserQuestion` with two choices:

- `yes` — create a private GitHub repo under `<user.github>` and push the initial commit
- `no` — local repo only; the user can `gh repo create` later

### Step 2c (code-repo only, asked first): Choose the owning Area

Scan `<workspace.root>/<workspace.areas>/*/` and select the Area whose responsibility owns the app. This is required for a `code-repo`.

If no Area exists (a fresh fork starts with none) or none fits, switch the type to `code-effort` and continue at Step 3 without asking Steps 2a–2b: the code lives in the new `COD-` project's `app/` until it ships and an Area owns it. Tell the user about the switch in the Step 4 confirmation. Offer a standalone repository outside the committed workspace only if the user doesn't want a project at all.

### Step 3 (every type except code-repo): Compute the prefixed, date-based slug

Choose the prefix before creating the path (the naming conventions in root CLAUDE.md):

- `COD-` when the type is `code-effort`. The project folder holds the plan, notes and outputs; while the code is being built it lives in the project's own ignored `app/` (`<workspace.project_apps>`), and once it ships it moves to the owning Area's `apps/` (the `code-repo` shape).
- `PROJ-` for every other non-video project.
- `VID-YYYY-MM-<slug>` for a single video project.

Then add today's month (`date +%Y-%m`) and slugify the name (lowercase, spaces→hyphens, strip non-alphanum-hyphen, collapse hyphens, trim).

```bash
slug=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 -]//g' | tr -s ' ' '-' | sed 's/^-*//;s/-*$//')
date_prefix=$(date +%Y-%m)
# COD for the code-effort type; otherwise PROJ.
project_prefix="PROJ"
[ "$TYPE" = "code-effort" ] && project_prefix="COD"
folder="<workspace.root>/<workspace.projects>/${project_prefix}-${date_prefix}-${slug}"
```

For code-repos, **don't** date-prefix the folder — repo names are stable identifiers (and become GitHub identifiers). Use the name as-is, just kebab-case it lightly. Path: `<workspace.root>/<workspace.areas>/<area>/apps/<name>/`.

### Step 4: Confirm the path with the user

Show the full plan via `AskUserQuestion` (yes/no), substituting the resolved paths from root CLAUDE.md:

**Project (every type except code-repo):**
```
Will create: <workspace.root>/<workspace.projects>/<PROJ|COD>-2026-MM-<slug>/
  Type: <type>
  Code: app/ (ignored by the outer repo; code-effort only)
Proceed?
```

**Code-repo:**
```
Will create:
  Owner:  <workspace.areas>/<area>/
  Path:   <workspace.root>/<workspace.areas>/<area>/apps/<name>/
  Stack:  <stack or "TBD">
  GitHub: <github.com/<user.github>/<name> or "local-only">
  Discovery: app.manifest.json
Proceed?
```

If no, ask for a corrected name and retry from Step 1.

### Step 5: Validate uniqueness

```bash
[ -d "$folder" ] && error "already exists"
```

Don't auto-rename. Tell the user the path, ask for a different name.

For code-repos, create the owning Area's `apps/` directory if it is missing. The outer workspace `.gitignore` must ignore `<workspace.root>/<workspace.areas>/*/apps/*` before writing app source. For `code-effort`, it must ignore `<workspace.root>/<workspace.projects>/COD-*/app/`; check before creating `app/`.

### Step 6: Read the right template

Templates live at `<workspace.root>/<workspace.resources>/templates/`:

| Type | CLAUDE template | Memory template |
|------|-----------------|-----------------|
| Every type except `code-repo` | `<templates.project_claude>` | `<templates.project_memory>` |
| `code-repo` | `<templates.code_claude>` | `<templates.project_memory>` (same) |

Read both with the `Read` tool.

### Step 7: Populate frontmatter and write `CLAUDE.md`

**Project substitutions (every type except code-repo):**
- `status: active`, or `paused` when the caller already confirmed that (for example `/migrate-work` passes the status the user approved at its gate)
- `created: <today YYYY-MM-DD>`
- `project-type: <chosen type from Step 2>`; for `code-effort` write `execution` (the template's type list has no code type; the `COD-` prefix carries it)
- `stakeholders: [<user.name>]` (default — user can add more later)
- `parent_hq: <area-name | none>` — see "Area linkage" below
- `# <project-slug>` heading replaced with actual slug

**Area linkage:**

Before writing the frontmatter, detect existing Areas by scanning `<workspace.root>/<workspace.areas>/*/`. If at least one Area exists, ask via `AskUserQuestion`:

> *"Which Area does this project belong under?"*

Options = each Area found (for example `operations`, `hiring`, `client-work`) + `none` (standalone). Default to the Area whose routing rules best match the project name and description (e.g., "q3-hiring-plan" → `hiring`). Single-select.

Write the chosen Area's folder name to `parent_hq:` (the field keeps its historical name). If the user picks "none", write `parent_hq: none`. The Area's `index.md` lists the project after the next regeneration (the okf-index-regen hook or `/reindex`); nothing in the Area is edited by hand.

If no Areas exist (fresh fork), skip the prompt and write `parent_hq: none`.

**Code-repo substitutions:**
- `status: active`
- `created: <today YYYY-MM-DD>`
- `stack: [<chosen stack>]` (proper YAML array — `[TypeScript, Node]`, `[Python]`, etc.; or empty `[]` if TBD)
- `github: github.com/<user.github>/<name>` if Step 2b = yes, else `github: <none>`
- `deploy: local-only` (placeholder; user edits later)
- `# <repo-name>` heading replaced

Leave the summary, project-specific rules, and key-links/build-test-deploy sections as their template placeholders — the user fills them in as the project grows.

Write to `<folder>/CLAUDE.md`.

### Step 8: Populate `memory.md` and write it

Read the memory template. Replace `<project-slug>` heading with the actual slug.

Append an initial decision-log entry (don't replace the template's example — append a real one):

```markdown
## YYYY-MM-DD — Project created

Decision: Scaffolded project folder via `/new-project` skill. <type or stack summary>.
Why: <leave blank for the user to fill in>
Next: <leave blank>
```

For code-repos, include the stack in the Decision line: *"Stack: Python."*

Write to `<folder>/memory.md`.

For code-repos, also write `<folder>/app.manifest.json`:

```json
{
  "schema_version": 1,
  "app_id": "<name>",
  "name": "<human name>",
  "owner_area": "<area>",
  "status": "active",
  "visibility": "private",
  "stack": ["<stack>"],
  "purpose": "<one-line purpose>"
}
```

### Step 8.5 (every type except code-repo): Generate index.md (no forced folders)

Do NOT pre-create any concept folders: no lifecycle layout, no type-specific dirs. The project starts as `CLAUDE.md` + `memory.md` + a machine-generated `index.md`. Concept folders emerge later, as content arrives, named for what they hold (OKF concept organization).

```bash
# Generate the machine-generated OKF index.md (project root). Derived view of frontmatter —
# never hand-edited. The okf-index-regen PostToolUse hook keeps it fresh as files are added.
# Run from the repository root; CLAUDE_PROJECT_DIR is often unset in a tool shell.
node "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/okf-index.mjs" "$folder"
```

For `code-effort`, also create the project's code home, unless the code already lives in an existing repo (for example a project brought in by `/migrate-work`): then skip `app/` and point the project's CLAUDE.md at that repo. The outer repo ignores `app/`, so the code keeps its own history:

```bash
mkdir -p "$folder/app"
git -C "$folder/app" init -q -b main
```

The user adds a remote later (`gh repo create <user.github>/<slug> --private --source="$folder/app"`) when they want one.

When the user later adds material, create a folder **named for the concept** it holds (`meetings/`, `data/`, `decisions/`, `analysis/`, `drafts/`, `sources/`), only when there's content to put in it. Don't reach for `inputs/working/outputs` by default — that lifecycle scheme is optional and only fits genuine produce-a-deliverable pipelines. The index regenerates automatically as folders and files appear.

### Step 9 (code-repo only): git init + optional gh

```bash
cd <path>
git init -q
git checkout -b main
git add CLAUDE.md memory.md app.manifest.json
git commit -q -m "Initial scaffold"
```

If Step 2b was `yes`:
```bash
gh repo create <user.github>/<name> --private --source=. --remote=origin --push
```

If `gh` fails (not installed, not authenticated, network), capture stderr and surface to the user:
> *"`gh repo create` failed: `<stderr>`. Local repo is fine — run the `gh repo create` command manually when ready."*

Don't abort the whole skill on a `gh` failure; the local repo is still useful.

### Step 10 (code-repo only): Verify Area app discovery

Run the session-start inventory hook and confirm it discovers `<folder>/app.manifest.json` under the expected owner Area. The manifest is the app's only registration; there is no separate code index to update.

### Step 11: Confirm to user — and tell them to switch context for code-repos

**Project message (every type except code-repo):**

```
✅ Project created: <workspace.root>/<workspace.projects>/<PROJ|COD>-2026-MM-<slug>/

Files:
  CLAUDE.md       status: active · type: <type> · stakeholders: [<user.name>]
  memory.md       1 entry (Project created · YYYY-MM-DD)
  index.md        machine-generated — never hand-edit (regenerates on write)
  app/            code-effort only: the code goes here (own git, ignored by the outer repo)

No concept folders pre-created (OKF concept organization). Add a concept-named
folder when you have content for it (e.g. meetings/, data/, decisions/, drafts/).

Next: edit CLAUDE.md to add the one-line summary and any project-specific rules.
The index.md tracks what exists as the project grows.
```

**Code-repo message — different ending:**

```
✅ Code repo scaffolded: <name>
  Owner:  <workspace.areas>/<area>/
  Path:   <workspace.root>/<workspace.areas>/<area>/apps/<name>/
  Stack:  <stack or "TBD">
  GitHub: <url or "local-only">
  Discovery: app.manifest.json

Heads up: code repos work best when you open them in their own context. Recommended:
  - Open the folder directly in VS Code: `code <workspace.root>/<workspace.areas>/<area>/apps/<name>`
  - Or start a fresh Claude Code session inside the repo:
      cd <workspace.root>/<workspace.areas>/<area>/apps/<name> && claude

Claude Code's nested CLAUDE.md inheritance means the repo's own CLAUDE.md will auto-load when you work inside it, giving you the right code-flavored context (stack, build commands, key files) without the rest of the workspace getting in the way.

Next: edit CLAUDE.md to fill in build/test/deploy commands and keep app.manifest.json accurate as the app moves from prototype to production.
```

The "switch context" suggestion is real value — code work benefits from the repo being its own working directory, both for Claude Code's context loading and for the developer's own focus.

Stop. Don't auto-open files, don't propose follow-up scaffolding (no `npm init`, `pip install`, boilerplate). The skill creates the structure; the user does the actual coding.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `mkdir: cannot create directory` | Wrong working directory | Run from the workspace root (where root CLAUDE.md lives). Check with `pwd`. |
| Templates not found | Template files missing under `<workspace.root>/<workspace.resources>/templates/` | Verify before reading; if missing, error and tell the user to restore from git |
| Slug came out empty | Name was all special chars | Re-prompt: "That name didn't slugify cleanly — try one with letters/numbers" |
| Folder exists | Same name was used before | Don't overwrite. Suggest a *different descriptive name* (NOT a `-v2` suffix — version suffixes violate the naming standard; the existing folder is likely the project to continue in, so route back to Step 0). |
| Code-repo: `gh repo create` fails | Not authenticated / network / GitHub name collision | Surface stderr, suggest manual `gh repo create` |
| Code-repo: owning Area has no `apps/` directory | First app in that domain | Create `apps/` after confirming the Area owns the app; verify the outer `.gitignore` rule first |
| Code-repo: no Area exists or none fits | Fresh fork, or the app's owner isn't settled yet | Switch to `code-effort` (Step 2c): a `COD-` project with the code in its ignored `app/` |
| AskUserQuestion not available | Subagent context | Pre-extract answers from invocation prompt; skip every AskUserQuestion call |
| Configuration values missing | Root CLAUDE.md doesn't have a Configuration section, or this is a fresh fork | Tell the user to run `/bootstrap` first (two questions) or fill in the Configuration section by hand. Don't proceed with hardcoded fallbacks — that defeats the portability goal. |

## Output format

Two final-message templates above (Step 11). Use the right one based on whether `code-repo` was selected. Both end with a clear "Next:" line — `/prune-projects` and the UserPromptSubmit hook will scan transcripts for "Project created" / "Code repo scaffolded" patterns.
