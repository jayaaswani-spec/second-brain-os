# Routing Rules — where misplaced root items go

Used by `/inbox-process` root-audit mode when proposing destinations. "Root" here is the repository root, the folder that holds root `CLAUDE.md`. Each rule below has a pattern, the destination, the reason, and an example.

## Root allowlist (leave in place)

These belong at the repository root. Never propose moving them, and don't route them through the rules below:

- `CLAUDE.md`, `AGENTS.md` (the Codex entry point; often a symlink to `CLAUDE.md`)
- `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`
- `README.md`, `INSTALL.md`, `CHANGELOG.md`, `EXAMPLE-CONFIG.md`
- `DESIGN.md` (the active design system; `/use-design` and the design skills read it from the root)
- `LICENSE`, `THIRD-PARTY-NOTICES.md`
- `agent-config.json`, `.mcp.json`, `.env.example`
- `memory.md` (root working memory, when the workspace keeps one)
- `docs/`, `scripts/`, `memory/`
- the workspace folder itself (`<workspace.root>/`)
- tool dot-folders and dotfiles (`.claude/`, `.agents/`, `.codex/`, `.git/`, `.github/`, `.gitignore` and similar), but not predecessor copies such as `.DESIGN.md.previous` (see below)

Anything else at the root is a candidate for the rules below.

## Daily memory files

**Pattern:** A file at root named `YYYY-MM-DD.md` (e.g., `2026-05-29.md`).

**Destination:** `memory/YYYY-MM-DD.md`

**Why:** The daily memory directory is `memory/`. A daily-named file at root is almost always a stray write that missed the directory prefix.

**Example:** `2026-05-29.md` (0 bytes, May 29) → `memory/2026-05-29.md`. If it's empty, also offer to delete instead of move.

## Predecessor / versioned files

**Pattern:** Files like `.X.previous`, `X-V2.md`, `X.old`, `X-draft.md` sitting next to a canonical `X.md` or `X`.

**Destination:** `_archive/` next to the canonical file, or `<workspace.root>/<workspace.archive>/` if there's no logical local archive folder.

**Why:** Rule 2 in CLAUDE.md (documentation maintenance): "Supersede = move out same day." Predecessors next to canonicals confuse readers about which is current.

**Example:** `.DESIGN.md.previous` at root, next to `DESIGN.md`. `DESIGN.md` stays (it's on the allowlist); the predecessor goes to `<workspace.root>/<workspace.archive>/DESIGN.md.previous`.

## Code repositories (folders with their own `.git/`)

**Pattern:** A folder at root that contains its own `.git/` directory.

**Destination:** code still being built goes to a `COD-` project's ignored `app/` (`<workspace.root>/<workspace.projects>/COD-YYYY-MM-<slug>/app/`, made with `/new-project` type `code-effort`); a shipped app goes to `<workspace.root>/<workspace.areas>/<owning-area>/apps/<slug>/`; anything no project or Area owns stays a standalone repository outside the committed workspace.

**Why:** New runnable code never enters the outer repository. Area-owned apps live in the Area's ignored `apps/` subtree and own their git, dependencies, secrets, and deployments. Code still being built lives in its COD project's ignored `app/`; dead code goes to `<workspace.archive>/<slug>/app/`.

**Caveat:** Confirm with <user.name> before moving — moving a code repo can break IDE configs, hardcoded paths in scripts, or active checkouts. Ask: "Is anything actively pointing at the current path?"

## Project-like folders (working drafts, no `.git/`)

**Pattern:** A folder at root containing drafts, notes, working files, but no `.git/`. Often has a name that reads like a project (e.g., `continuum/`, `brand-concepts/`).

**Destination:** `<workspace.root>/<workspace.projects>/<PROJ-YYYY-MM-slug>/`

**Why:** Active projects belong in `<workspace.projects>/`. The project-naming convention in root CLAUDE.md (`PROJ-YYYY-MM-` for non-code work) means renaming during the move.

**Required questions for <user.name>:**
1. Confirm the slug — what's the short topic name?
2. What month did this start? (Determines the YYYY-MM- prefix.)
3. Which Area does it belong under (`parent_hq:`)? (None is a smell per CLAUDE.md.)

Don't create subfolders during the move: no `inputs/`, `working/` or `outputs/` (that layout was repealed). Folders inside a project emerge later, named for what they hold.

**Example:** `continuum/` (no .git, has notes and drafts inside) → ask <user.name> → maybe `<workspace.root>/<workspace.projects>/PROJ-2026-05-continuum/` with `parent_hq: operations` (an Area that already exists).

## Standalone reference docs

**Pattern:** A `.md` file at root that isn't on the root allowlist above. Often notes, exports or one-off write-ups, such as `meeting-notes.md` or `vendor-comparison.md`.

**Destination:** `<workspace.root>/<workspace.resources>/reference/`

**Why:** Reference material that future-<assistant.name> might consult but isn't load-bearing on session start. Resources is the PARA bucket for "things I might reference later, organized by topic."

**Caveat:** Some `.md` files outside the allowlist are at the root on purpose, for example a doc the README links to. Ask <user.name>: "Is this discoverable on purpose, or can it live in Resources?"

## Stub / near-empty files

**Pattern:** A file at root that's under ~5 lines or is mostly placeholder content. Examples: `index.md` (39 bytes), empty `.md` files.

**Destination:** Delete (with explicit confirmation) or `<workspace.root>/<workspace.archive>/` if <user.name> wants to keep the trail.

**Why:** Stubs at root take up visual real estate without earning it. Either commit to filling them in or get rid of them.

## Test / scratch folders

**Pattern:** Folders named `test/`, `scratch/`, `tmp/`, `experiments/` at root.

**Destination:** `<workspace.root>/<workspace.archive>/` if <user.name> wants the work preserved, or delete if it's truly throwaway. If it's an active experimental project, treat as a project folder (above) and route to `<workspace.root>/<workspace.projects>/`.

**Why:** Scratch at root tends to grow forever. Either it matures into a project (and gets the proper PROJ- slug) or it gets archived. The middle state is the bad state.

## `tools/` folder at root

**Pattern:** A `tools/` folder at root.

**Destination:** Depends on contents. **Inspect before proposing.**

- If it contains helper scripts that match something under `.claude/` (hooks, skill scripts), it may be an older copy; ask <user.name>.
- If it contains runnable project-specific code, route it like a code repository (above): a COD project's ignored `app/` while it's being built, an owning Area's `apps/<slug>/` once shipped, or a standalone repository outside the committed workspace. Tracked Projects may hold plans and outputs, not runnable source.
- If it looks like bundled framework code, ask <user.name>; root `tools/` is not on the allowlist.

## macOS junk

**Pattern:** `.DS_Store` files anywhere in the tree.

**Destination:** Delete. They're already gitignored per `.gitignore`.

**Why:** Pure noise. Use `find <workspace-repo-root> -name .DS_Store -delete` as a one-liner. Still ask before running it — destructive ops need confirmation per CLAUDE.md.

## When no rule matches

If a root item doesn't fit any pattern above, **don't guess**. Present it to <user.name> with:
- What it is (file size, folder size, contents preview)
- Last modified date
- Two or three possible destinations with the tradeoffs
- "I don't have a clean rule for this — where should it go?"

Inventing new top-level destinations or new naming patterns defeats the PARA + Area system. Better to ask once and codify the decision than to silently sprawl.

## After the move — book-keeping

For every move that lands a file into `<workspace.projects>/` or `<workspace.resources>/`, the receiving location might want an entry in its own README or memory.md noting what arrived. The cleanup skill itself doesn't write those entries — but it should remind <user.name> to consider them, or offer to do it as a follow-up.
