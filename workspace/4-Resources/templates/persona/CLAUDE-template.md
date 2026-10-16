# Second-Brain OS — Project Instructions for <assistant.name>

This file is project-scoped instructions only. **Persona, user, and tooling context live in dedicated files** — do not duplicate them here.

## Load Order at Session Start

1. **@SOUL.md** — <assistant.name>'s persona, voice, boundaries
2. **@USER.md** — <user.name>'s profile, role, communication preferences, team
3. **@IDENTITY.md** — <assistant.name>'s name, version, origin
4. **@TOOLS.md** — Available tools and capabilities
5. **@README.md** — Project map and update rules

If anything below conflicts with those files, those files win.

---

## Configuration — source of truth for skills

Skills (`/new-project`, `/archive-project`, `/prune-projects`, the intent-detector hook) read the values below as the source of truth. **To fork this workspace for your own use, run `/bootstrap`** — it walks through these values interactively and rewrites this section. Every skill references these paths and identity values symbolically (e.g., `<workspace.projects>`) and adapts automatically.

### workspace
- `workspace.root` = `<workspace.root>` (default: `workspace`; rename to `workspace`, `brain`, `<assistant>-workspace`, etc.)
- `workspace.inbox` = `0-Inbox`
- `workspace.projects` = `1-Projects`
- `workspace.areas` = `2-Areas` — thin Area workstations (PARA Areas): rules + memory + a generated index only; starts empty (see the Area model below)
- `workspace.resources` = `4-Resources`
- `workspace.archive` = `5-Archive` — archived projects keep their code in an ignored `app/` subtree
- `workspace.area_apps` = `2-Areas/<area>/apps` — shipped, maintained apps (MCP servers, dashboards, sites) owned by an Area; each is gitignored with its own git and an `app.manifest.json`
- `workspace.project_apps` = `1-Projects/COD-*/app` — a code project's single gitignored `app/` subtree while it is being built

Resolved paths (combine the above): `<workspace.root>/<workspace.projects>` → e.g., `workspace/1-Projects`.

### templates (under `<workspace.root>/<workspace.resources>/templates/`)
- `templates.project_claude` = `project-claude-template.md` — for non-code project CLAUDE.md
- `templates.project_memory` = `project-memory-template.md` — for any project's memory.md
- `templates.code_claude` = `code-project-claude-template.md` — for code-repo project CLAUDE.md
- `templates.persona` = `persona/` — for persona file templates (used by `/bootstrap`)

### scripts
- `scripts.project_query` = `<workspace.root>/<workspace.resources>/templates/project-query.sh`

### user
- `user.name` = `<user.name>` — short name; default stakeholder for new projects, voice cues ("Morning <user.name>!")
- `user.full_name` = `<user.full_name>` — full display name
- `user.email` = `<user.email>`
- `user.timezone` = `<user.timezone>`
- `user.github` = `<user.github>` — used by `/new-project`'s code-repo branch for `gh repo create <user.github>/<name> --private`
- `user.email_signature` = `<user.email_signature>`
- `user.company` = `<user.company>`

### assistant
- `assistant.name` = `<assistant.name>` — referenced in SKILL.md prose via `<assistant.name>` placeholder so skills don't hardcode the persona name. Skills auto-substitute when SKILL.md auto-loads.
- `assistant.role` = `<assistant.role>` — short role descriptor (e.g., "Chief of Staff", "Research Companion", "Engineering Co-Pilot")
- `assistant.vibe` = `<assistant.vibe>` — one-line vibe descriptor used in SOUL.md voice cues
- `assistant.emoji` = `<assistant.emoji>`

### lifecycle
- `setup_completed` = `<YYYY-MM-DD>` — date `/bootstrap` ran successfully. Used as the re-run gate (presence = configured; missing/empty = fresh fork). To re-run `/bootstrap`, delete this line first.

### Forking note

When someone clones this repo to use as their own second-brain OS:
1. Run `/bootstrap` — interactive setup that fills in the values above and (optionally) rewrites the persona files (SOUL, USER, IDENTITY) from templates at `<workspace.root>/<workspace.resources>/templates/persona/`
2. Optionally rename `<workspace.root>/` to whatever feels right and update `workspace.root` to match
3. After `/bootstrap`: try `/briefing` for a morning brief, `/find <topic>` to recall, `/help` for the full skill list

The skills themselves shouldn't need code changes for a fork — the only hardcoded paths in them are Claude Code's own (`.claude/hooks/`, `~/.claude/projects/...`), which are framework-level.

### Skills, hooks and AGENTS.md (one tree, every agent)

- **Skills live once in `.agents/skills/<name>/`.** `.claude/skills/<name>` is a relative symlink into it, so Claude Code, Codex, Cursor and any AGENTS.md-aware tool load the same files. Add a skill as `.agents/skills/<name>/SKILL.md`; `node scripts/link-agent-skills.mjs` (run by the pre-commit hook) creates the `.claude/skills/` link. Never copy a skill into both places.
- **`AGENTS.md` is a symlink to this file.** Edit `CLAUDE.md`; every agent reads the same rules.
- **Hooks live in `.claude/hooks/`**, wired through `.claude/settings.json` with `$CLAUDE_PROJECT_DIR`. They read workspace paths from the Configuration block above, so renaming a workspace folder needs no hook edits.
- Install the git hooks once after cloning: `bash scripts/install-git-hooks.sh` (skill-link sync + gitleaks secret scan).

---

## Area / Active Project model

The core organizational pattern of the OS. **A fresh fork ships with zero Areas** — the `<workspace.areas>/` folder starts empty. You add an Area when a recurring, long-running workstream emerges.

**Areas are thin.** Each `<workspace.areas>/<name>/` is a PARA Area (peer to `<workspace.projects>/`) and holds exactly three tracked files: `CLAUDE.md` (domain rules and voice only, no content), `memory.md` (working memory) and `index.md` (a machine-generated list of the projects whose `parent_hq:` names this Area, live and archived; never hand-edited, regenerated by `/reindex`). No docs, decks or resources live directly in an Area. The one exception is an optional `apps/<app-name>/` for shipped software the Area owns: gitignored, with its own git and an `app.manifest.json`.

**All content lives in projects.** Docs, plans, decks and data live in `<workspace.projects>/<slug>/` while active and in `<workspace.archive>/<slug>/` when done. Reference material that belongs to no project goes in `<workspace.resources>/`.

**Active Project = bounded current execution.** Each `<workspace.projects>/<slug>/` has a start, an end and (recommended) a `parent_hq:` linking it to its Area. **If it's in `<workspace.projects>/`, it's active. If it's not active, it's not there.** `parent_hq:` takes the bare Area name (e.g., `parent_hq: client-work`, not `parent_hq: 2-Areas/client-work`) — skills prepend `<workspace.areas>/` themselves.

**Area routing — progressive, load-on-demand.** Never pre-load all Areas at session start. Keep a **routing-map table** in `memory.md` that maps task type → Area. At the start of each user turn (or whenever the task shifts), consult the routing map, match the task against the trigger column, and load **only the matched Area's** `CLAUDE.md` + `memory.md`. When no row matches, work from root context alone. When two rows match, load the primary Area (the noun of the task) and reference the secondary's rules only as needed.

**Completion ritual** (enforced by `/archive-project`):
1. Archive the project WHOLE to `<workspace.archive>/<slug>/` — no cherry-picking.
2. Flip project frontmatter `status: active` → `done`.
3. Optionally append a short retro to the project's `memory.md`.
4. Regenerate the parent Area's `index.md` (`/reindex`), so the archived project stays linked from its Area.

There is no promote-to-Area step: nothing moves into the Area itself.

**`parent_hq:` is recommended on every active project.** `parent_hq: none` is a smell — rescope under an existing Area, or add a new (thin) Area if the workstream is genuinely evergreen.

**Code never enters the workspace repo.** Runnable code has three homes, each gitignored with its own git: a `COD-` project's single `app/` subtree while it is being built (`<workspace.project_apps>`), the owning Area's `apps/<app-name>/` once shipped and maintained (`<workspace.area_apps>`), and `<workspace.archive>/<slug>/app/` when dead or dormant.

---

## Documentation maintenance (4 load-bearing rules)

Prevents the stale-doc-graveyard pattern — multiple versions of the same doc coexisting, confusing both you and the assistant.

1. **One canonical filename per artifact. No version suffixes.** Edit `PLAN.md`, never create `PLAN-V2.md`. Git history is the version log. Frozen stakeholder snapshots go to `_snapshots/<doc>-YYYY-MM-DD.md`, named by date, not version number.
2. **Supersede = move out same day.** When a doc is replaced, the predecessor moves to `_archive/` (folder-local) or `<workspace.archive>/` (workspace-level) in the same commit as the lock. No `status: superseded` files sitting next to current canonical ones.
3. **Every folder with 5+ canonical docs gets a `README.md` pointer.** Top of README names the canonical files. Everything else in the folder is reference or history.
4. **The lock ritual updates the index.** Locking a new canonical version in the same commit: (a) edit or rename the canonical file (no version suffixes — rule 1), (b) update the authoritative-docs pointer in the relevant CLAUDE.md/README, (c) move the predecessor per rule 2. If any is missing, the lock isn't done.

**Before citing any doc as canonical**, check (a) the filename is not version-suffixed, (b) frontmatter `status:` is `active` or `locked` (not `superseded`/`draft`), (c) it lives outside `_archive*/` and `<workspace.archive>/`. If any check fails, it's not canonical regardless of how authoritative it sounds.

---

## Naming conventions

Follow these when creating any new file / folder / project — they keep the workspace greppable and prevent drift. Before creating any new path, check it against the list; if a proposed path would violate one, correct it first.

- `lowercase-kebab.md` for working docs, plans, trackers.
- `UPPERCASE-KEBAB.md` ONLY for the closed set of OS files (CLAUDE / SOUL / USER / IDENTITY / README / TOOLS / CHANGELOG). No additions without versioning this standard.
- `YYYY-MM-DD-<topic>.md` date-prefix only when the date is load-bearing (meeting notes, briefings, dated snapshots).
- `<PREFIX>-YYYY-MM-<slug>/` for project folders in `<workspace.projects>/`: `PROJ-` by default, `COD-` for a code effort (its code sits in the project's `app/`), `VID-` for a single video. `/new-project` picks the prefix.
- `NN-<topic>.md` numeric prefix only when sequence carries meaning.
- `lowercase-kebab/` for app repos under `<workspace.area_apps>/` — no version suffix in repo names.
- An Area folder holds only `CLAUDE.md`, `memory.md`, `index.md` and an optional `apps/`.
- `_archive/` and `_snapshots/` use the underscore prefix; machine-managed state uses a `.dot-prefix/`.
- Max 3 levels of nesting.
- Projects scaffold with `CLAUDE.md`, `memory.md` and a generated `index.md` only. Don't pre-create folders: name each one for what it holds (`meetings/`, `data/`, `drafts/`) when the first file arrives.

---

## Project-Specific Context

For Memory System (dual-folder), Workspace (PARA layout), and Outputs conventions, see **README.md** — that's the canonical source. This file holds only the project-specific deltas below.

### Briefing & report outputs

<assistant.name> writes to `<workspace.root>/<workspace.resources>/briefings/morning-briefing-<YYYY-MM-DD>.html`, `<workspace.root>/<workspace.resources>/meeting-prep/`, `<workspace.root>/<workspace.resources>/organization-reports/`. Never write outputs at the workspace root. Never mix briefings with project files.

### OS knowledge skill — consult `/os-guide` before answering OS-shaped questions from memory

When the user asks an OS-shaped question — workspace paths, Configuration token values, what skills exist, how memory works, contacts schema, locked decisions, Operating Principles, tool inventory — **invoke `/os-guide` instead of answering from memory.** Memory drifts; the canonical source files (CLAUDE.md, README.md, SOUL.md, TOOLS.md, etc.) don't. `/os-guide` reads them live, returns the answer with file:line citations, and resolves Configuration tokens at every invocation so paths reflect the actual fork. Specifically — Claude SHOULD self-consult before writing any of the following into a user-facing response: a workspace path, a Configuration value, a schema field, a claim about a skill's behavior, or a claim about a tool's connection state. After adding new tools/skills/brands/decisions to the OS, run `/os-guide --sync` to refresh its routing table. Read-only by default; `--sync` is the only mutation mode, gated behind explicit approval.

### Contacts (per-person reference directory)

Per-person tracking lives at `<workspace.root>/<workspace.resources>/contacts/<slug>.md`. **Schema, frontmatter fields, body sections, and conventions** are documented at `<workspace.root>/<workspace.resources>/contacts/README.md` — single source of truth.

The journal of any specific interaction lands in `memory/YYYY-MM-DD.md`; the durable per-person directory lives in Resources. Skills: `/contact` (read), `/contact-log` (append interaction).

### Cross-references — WikiLinks convention

Reference one note from another with `[[topic]]` or `[[path/to/note]]` syntax. Manual convention — no tool enforces it. `/find [[X]]` lists every note that links to X (a fixed-string backlink search). Future-proof for Obsidian if <user.name> ever opens the vault there. Use the topic slug, not the full filename.

---

## Briefing & Synthesis Rules (<assistant.name>-Specific)

These extend SOUL.md — do not restate SOUL guidance here, only project-specific deltas.

**For morning briefings:**
- Cross-reference email + calendar + meeting notes before writing — don't summarize one source in isolation
- Apply <user.name>'s priority signals (see USER.md): direct collaborators, calendar conflicts, priority topics
- Pull SPECIFIC action items from meeting transcripts — names, timelines, blockers — never "follow up generically"
- Briefings go to `<workspace.root>/<workspace.resources>/briefings/`, not the conversation only

**For meeting prep:**
- Always check the Recordings folder first if <user.name> has one configured (Gemini summaries are pre-condensed)
- Fall back to Transcripts folder if no recording exists
- Surface what <user.name> promised in past meetings with the same person

**For writing in <user.name>'s voice:**
- Load `memory/writing-style.md` before drafting strategic docs (if it exists — <user.name> writes their style profile here)
- Quantify everything (metrics, percentages, ROI)
- Use 🟢🟡🔴 status indicators in trackers; NO emojis in formal external docs

---

## Active Project Index — query at session start

Don't hardcode the project list here; it goes stale. Run the query script to get a live tabular view (status, project-type, days-since-touched, stale flag):

```bash
bash <workspace.root>/<workspace.resources>/templates/project-query.sh
```

Default lists active projects sorted by staleness. Useful flags:
- `--status all` — also surface unmigrated projects (folders without `CLAUDE.md`) flagged `NEEDS_SCAFFOLD`
- `--tsv` — tab-separated, no header, for piping
- `--stale-days 60` — adjust the staleness threshold

Code is gitignored and not visible to the script: shipped apps are listed by their `<workspace.area_apps>/*/app.manifest.json`, and in-progress code sits in each COD project's `app/`. The `inject-projects` SessionStart hook runs the script for you and injects the merged table at the top of every session.

## Planning and building — the flow skills

Work that needs thinking or spans sessions runs through one chain of skills. `/flow` names the path for the work in front of you; every flow skill resolves the project and its file paths from **`docs/agents/project-context.md`**.

- **Small change** — just do it. No spec, no tickets.
- **Main flow:** `/grill-me` or `/grill-with-docs` (sharpen the idea by interview) → `/to-spec` (`spec.md` in the project) → `/to-tickets` (`tickets/NN-slug.md`, each naming its blockers) → `/implement` one ticket per session, clearing context between tickets.
- **On-ramps:** `/triage` for requests you didn't create, `/diagnosing-bugs` for something broken, `/wayfinder` for an effort too big and foggy for one session (`map.md` of decision tickets).
- **Underneath:** `/domain-modeling` (`glossary.md`, `decisions/`), `/codebase-design`, `/tdd`, `/code-review`, `/prototype`, `/research`, `/handoff`.
- `.scratch/` is never an output location.

---

## Boundaries (Project-Specific)

- **Do not auto-send messages** to Slack, email, Telegram, or WhatsApp without explicit "send it" from <user.name>. Drafts are fine.
- **Ask before rewriting <user.name>'s drafts in `<workspace.root>/<workspace.projects>/`.** Work <user.name> hands over inside a project (a spec, tickets, a ticket to build), and appends to its `memory.md`, need no extra ask.
- **Memory writes are append-only** under `memory/YYYY-MM-DD.md`. Don't rewrite history.
- **For destructive ops** (delete, force, reset): ask first, even if previously authorized for one task.
