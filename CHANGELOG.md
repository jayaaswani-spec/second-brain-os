# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-10-14

### Added
- **One skill tree for every agent.** Skills live once in `.agents/skills/<name>/`; `.claude/skills/<name>` is a relative symlink into it, so Claude Code, Codex, Cursor and other AGENTS.md-aware tools load the same files. `AGENTS.md` stays a symlink to `CLAUDE.md`. New `scripts/link-agent-skills.mjs` keeps the links in sync, run by the pre-commit hook.
- **Planning and build skills (the flow chain).** `/flow` picks the path; `/grilling`, `/grill-me` and `/grill-with-docs` sharpen an idea by interview; `/to-spec` and `/to-tickets` turn it into `spec.md` and `tickets/NN-slug.md` in the project; `/implement` builds one ticket per session. On-ramps: `/triage`, `/diagnosing-bugs`, `/wayfinder`. Underneath: `/domain-modeling`, `/codebase-design`, `/tdd`, `/code-review`, `/prototype`, `/research`, `/handoff`. All resolve the project and paths from `docs/agents/project-context.md`. Adapted from mattpocock/skills (MIT, see `THIRD-PARTY-NOTICES.md`). With `/entity-research` below, the bundle grows from 29 skills to 47.
- **`/entity-research`** — company and person research from public web sources, with citations.
- **Codex gets the same MCP servers.** `.codex/config.toml` is generated from `.mcp.json` (API keys forwarded, opt-in servers left commented out; Slack isn't available in Codex yet) and the pre-commit hook regenerates it once you've run `bash scripts/install-git-hooks.sh`; `node scripts/codex-config-from-mcp.mjs` refreshes it by hand. Hooks stay Claude Code only.
- **`/migrate-work` reads Codex sessions too**, alongside Cowork, the Code tab and Claude Code. A folder you worked on from both Claude and Codex shows up as one project, and the census says which session stores it found. It also brings over what Claude and Codex already remember about you (your global instructions, Claude Code's auto-memory, Codex's memories): facts about you go to `USER.md`, how the assistant should work to `SOUL.md`, project notes to that project's `memory.md`. Every line is shown first, appended word for word, and duplicates, conflicts and anything that looks like a credential are held back.
- **Hooks:** `inject-projects` (SessionStart — injects the active-project and Area-app table) and `workspace-guards` (append-only daily memory, no outputs at the repo root). Both read workspace paths from the Configuration block.

### Changed
- Configuration: `workspace.coding` and the `code_projects` index are gone. Code lives in `workspace.area_apps` (shipped Area apps) and `workspace.project_apps` (a COD project's `app/`), both gitignored.
- `/bootstrap` re-runs by deleting the `setup_completed` line; there is no `--reconfigure` flag.
- **`/bootstrap` asks two questions** (who you are; your assistant's name and feel) and works out the rest: git name and email, timezone and language (a bundled script), plus which connectors are live. The script fills the persona files and Configuration block and verifies nothing is left unresolved. A persona file that no longer matches its template keeps your text, with its names filled in if you choose. Writing-voice capture, `/migrate-work` and the Slack, Atlassian and Figma connectors are offered at the end instead of asked up front; the connectors are added by `apply.py add-connectors`, which also refreshes the Codex config. Fixed: fresh forks were treated as already configured, because the template's placeholder date counted.
- `external-action-guard` also asks before Gmail send/reply/forward, iMessage and Slack canvases.
- `pre-compact` auto-handoffs record tool calls, edited files and errors again; `tldr-read` works with tldr 1.5.2.
- Skill evals no longer ship (maintainer test data); write your own with `/skill-creator`.
- `/briefing` reads mail and calendar through your Gmail and Calendar connectors (connect Google Workspace with `/mcp`) instead of the `gws` CLI.
- `/migrate-work` on a workspace that hasn't been through `/bootstrap` stops and points you there, instead of writing raw `<placeholders>` into your files.
- `/migrate-work` stays readable on a machine with years of history: past 40 memory lines, the approval shows each destination's count and first lines and puts the full numbered list in a file you can open; candidates beyond four are picked by number. Memories that are about a different person or assistant are held back, quoted YAML values are unescaped, and dated journal files in a memory folder are skipped.
- `scripts/install.sh` now installs the git hooks and the packages for the bundled image-analysis server, and the README setup runs `bash scripts/install-git-hooks.sh`.

### Removed
- Hooks `post-edit-diagnostics` and `auto-handoff-stop`.
- The `3-Coding/` folder from the README map and every folder README.
- The `.claude/commands/use-design.md` slash command, which hardcoded `workspace/4-Resources/`; the `/use-design` skill does the same job and follows your Configuration. Delete the command file from a 0.5.x fork so the skill answers `/use-design`.
- The `oracle` and `worker` subagents in `.claude/agents/`: `oracle` searched only through the Python sandbox removed in 0.5.0, and `worker` needs an orchestrator that doesn't ship. Delete `.claude/agents/` and `.claude/tools/` from a 0.5.x fork unless you use them.

### Fixed
- `THIRD-PARTY-NOTICES.md` now credits the 14 `design-*` skills (adapted from open-design, Apache 2.0) and `skill-creator` (Apache 2.0), with what was changed. Earlier releases shipped the design skills without their license.
- `.claude/settings.local.json` (your own permission grants) is now gitignored, so `git add -A` no longer picks it up.
- `.claude/settings.json` no longer ships permission rules or enabled plugins from the maintainer's own setup.
- In Codex, `gemini-vision` starts from the repo root, so it works when Codex runs in a subfolder.
- `/code-review` now shows up in Codex: its description wasn't valid YAML, which Claude Code tolerates and Codex silently skips.
- `gemini-vision` failed to start on a fresh clone because its packages were never installed; the README and `.claude/mcp-servers/README.md` now say to run `npm install --prefix .claude/mcp-servers` once.
- `scripts/install.sh` on a Mac without Homebrew: brew wasn't found right after installing it, every failed step printed `die: command not found`, and a missing `gh` failed the whole install. All three fixed.
- Hooks treat an unfilled `<workspace.root>` as the default `workspace`, so they work before `/bootstrap`; creating today's `memory/YYYY-MM-DD.md` with Write is no longer blocked (overwriting an existing one still is); `tldr-read` no longer runs the file path through a shell and only pre-approves reads inside the project.
- `.gitignore` keeps code (`app/`, `apps/`) and handoffs ignored after you rename the workspace folder.
- Skills no longer say HQ, `/retro-project`, `/contact-research` or `/bootstrap (TBD)`; `/archive-project`'s last step no longer contradicts its index step; `/new-project`'s `COD-` rule matches where code lives.
- The docs now match the thin-Areas model from 0.5.0. The `CLAUDE.md` template, the new-project `CLAUDE.md` template and the folder READMEs had still described Areas holding a `resources/` folder and archived projects promoting files into them; now an Area holds only its rules, memory and generated index, and archived projects move whole. They also use the `PROJ-`/`COD-`/`VID-` project names `/new-project` creates, without pre-made `inputs/working/outputs` folders.
- `INSTALL.md` matches the two-question `/bootstrap`: no tool-probe panel and no connector picker. `/bootstrap` no longer reads the installer's `SBOS_TIER` marker. It also now says to run `bash scripts/install-git-hooks.sh` once.
- Docs no longer point at skills that don't ship (`/meeting-prep`, `/contact-add`, `/weekly-digest`, `/standup`, the old ContinuousClaude skill list).
- `/os-guide` points at sections that exist in a fork (several rows cited maintainer-only README sections) and answers "how do I bring in my Codex work" and "does Codex get my MCPs".

### Upgrading from 0.5.x
Skills moved from `.claude/skills/` to `.agents/skills/`. Skills you never edited switch over on their own; the steps below cover the rest.
1. **Before you pull, copy any skill you edited to a folder outside the repo.** An edited skill conflicts with the move, and the pull replaces it.
2. **Pull, taking the incoming version on conflicts** in `.claude/skills/`, `.agents/skills/` and `.claude/settings.json`; the old settings point at two hooks that no longer exist. Re-add any settings of your own afterwards. If `CLAUDE.md` conflicts (it will if `/bootstrap` filled it in), keep your values.
3. **Update the Configuration block in `CLAUDE.md`:** delete `workspace.coding` and the `indexes` section, and add `workspace.area_apps` and `workspace.project_apps` from the new template. Move anything in `3-Coding/` into an Area's `apps/<name>/` (shipped apps) or a project's `app/` (code still being built); both are gitignored.
4. **Put your edited skills back** under `.agents/skills/<name>/`, run `bash scripts/install-git-hooks.sh` once so the pre-commit hook keeps skills linked from now on, then run `node scripts/link-agent-skills.mjs`.
5. **Restart Claude Code** so the new hooks load.

## [0.5.0] - 2026-08-06

### Changed — thin-Areas model + skill library consolidated

- **Thin-Areas model is now the documented core.** Areas (`2-Areas/`) hold exactly three tracked knowledge files — `CLAUDE.md` (rules) + `memory.md` (working memory) + machine-generated `index.md` — plus an optional ignored `apps/<name>/` subtree for Area-owned software. ALL tracked content lives in projects (`1-Projects/` while active, `5-Archive/` when done). Root `CLAUDE.md` rewritten around this model, including the completion ritual and the 4 documentation-maintenance rules.
- **Workspace naming standard** locked (5 principles + 11 conventions C1–C11), v1.3: `PROJ-` for general non-code work, `COD-` for code-related planning, `VID-YYYY-MM-<slug>` for one-video projects.
- **Skill library consolidated 45 → 29** (15 core + 14 `design-*`). Removed skills whose jobs moved into the harness, other skills, or written principles: `atlassian-attach`, `autonomous`, `autonomous-research`, `bootup`, `budget-tracker`, `company-research`, `confluence-publish-markdown`, `create-handoff`, `desktop-organizer`, `jira-decompose-epic`, `people-research`, `premortem`, `research`, `resume-handoff`, `review`, `scaffold-engineering-project`, `sync-indexes`, `upgrade-harness`. Session handoff now lives in hooks (`auto-handoff-stop` + `pre-compact`), not a skill pair.
- **Core skills updated across the board** — `archive-project`, `bootstrap`, `briefing`, `contact`, `contact-log`, `inbox-process`, `migrate-work`, `new-project`, `os-guide`, `save-resource` all revised for the thin-Areas model, Area-owned `apps/` routing, and tightened invariants.
- **`.claude/tools/` Python helpers removed** (`exa_search.py`, `nia_docs.py`, `ouros_harness.py`) — superseded by MCP connectors; `.env.example` and `install.sh` trimmed to match.
- Hooks updated: `intent-detector` routing-table refresh, `external-action-guard`, handoff writer.

### Added

- **OKF placement enforcement ships.** Two new hooks: `okf-connect-before-create.mjs` (PreToolUse — show-and-ask on 5 placement violation classes: content in Areas, code in committed buckets, near-duplicate slugs/folders/basenames) and `okf-index-regen.mjs` (PostToolUse — keeps machine-generated `index.md` files fresh on live edits), plus the shared `lib/okf-index.mjs` generator.
- **`/reindex`** ships — bulk-rebuild machine-generated `index.md` files across Projects/Areas/Resources (the hook covers live edits; this covers moves and bulk changes).
- **`/use-design`** ships (new first-party skill) — swap the active root `DESIGN.md` for any brand in the catalog, with a list mode and a guard that preserves a customized root file.
- **Design-system brand catalog** — ~70 ready-made brand `DESIGN.md` token files under `4-Resources/design-systems/` (Stripe, Vercel, Notion, Linear, …), each with a generated `index.md`.
- **`/skill-creator`** ships — create, improve, and eval skills.
- **`/inbox-process` root-audit mode** with documented routing rules (`references/root-routing.md`).
- **`AGENTS.md` → `CLAUDE.md` symlink at root** — Codex/Cursor-style agents that read `AGENTS.md` get the same OS instructions with zero duplication.
- **Pre-commit secret scan for forks** — `scripts/git-hooks/pre-commit` (blocking gitleaks scan on staged changes; warns if gitleaks isn't installed) plus `scripts/install-git-hooks.sh` to wire it up (`git config core.hooksPath`). Run once after cloning.

### Notes

Skill count 45 → 29; hook count 8 → 10. Extractor now excludes maintainer-personal brand folders from the design-system catalog.

## [0.4.0] - 2026-06-24

### Changed — onboarding rebuilt for knowledge workers

- **README rewritten** (~480 → ~95 lines, 6 plain-language sections). The setup is now the single path `clone → claude → /bootstrap`; `install.sh` is demoted to an optional "going further" line. The maintainer-manual material (Configuration-token table, Update-Rules sub-tables, ASCII project map, 20-row quick-reference, tier-comparison table, 45-line paste-prompt) is gone — it's what `/os-guide` answers live and what `INSTALL.md` covers.
- **`/bootstrap` slimmed + de-jargoned** for a knowledge-worker audience (~500 → fewer, plainer steps): the 12-line welcome script and the "full vs express?" gate are gone; the 7-section environment panel is a quick read-only check; `TOOLS.md` is demoted out of the critical path; each step opens with one plain why-it-matters sentence, not a script.
- **Pronoun field removed entirely.** `assistant.pronoun` is dropped from the persona collection, the Configuration block (13 → 12 tokens), the echo-back, and all downstream `<pronoun>` resolution. Persona templates were already pronoun-free.
- **Connector picker gains Google Workspace** (Gmail/Calendar/Drive) alongside Slack/Atlassian/Figma — Google Workspace + Slack are recommended (most users already use them).

### Added

- **Writing-voice from your own sent messages** (optional, post-setup, consent-gated). After core setup, `/bootstrap` offers to learn your voice from your **sent** Slack/Gmail messages (Slack via `from:<your-handle>`; Gmail via a connected Workspace MCP), detected at runtime — falling back to paste-a-sample. Reads ONLY messages you sent, only after explicit consent, never fabricates.
- **`/migrate-work` skill** (new, standalone, offered at the end of `/bootstrap` and re-invokable). Brings your existing work into PARA by reading your **local Claude Cowork session transcripts** (`~/Library/Application Support/Claude/local-agent-mode-sessions/.../audit.jsonl`) — discovering the projects you've actually been working on, fanning out a read-only scout per project, then (after a single approval gate) scaffolding the chosen ones as `1-Projects/` or `4-Resources/` entries with a seeded `CLAUDE.md` + `memory.md`. Hard invariants: **copy-never-move**, read-only discovery, one approval gate, no fabrication, runnable code routes to `3-Coding/`, never auto-commits. (Filesystem-folder scanning was evaluated and rejected — sessions are the reliable signal of what someone actually works on.)

### Notes

Skill count 44 → 45 (`/migrate-work` added). All four `/bootstrap` tiger invariants (T1–T4) preserved.

## [0.3.1] - 2026-06-22

### Removed

- **`thinking-partner` skill** — dropped from the public bundle (kept in the dev fork). It's a generic Q&A/ideation skill, but trimmed to keep the public surface focused. **Skill count 45 → 44.** Dangling `/thinking-partner` references removed from the README (skills table, "what you can ask", quick-reference) and bootstrap's Day-2 loop.

### Changed (extractor pipeline — design-skill source)

The 14 bundled `design-*` skills now have a clean, regenerable source. They had
migrated out of the maintainer's own skill folder into the **open-design** plugin
(the `design:*` namespace, `github.com/nexu-io/open-design`), so the extractor
could no longer find them — v0.3.0 worked around this by manually copying the 14
out of the *public* repo on every release (circular, and guaranteed to go stale
against the plugin).

- **New vendored snapshot** at `.claude/vendor/design-skills/` — a committed,
  asset-only, leak-clean copy of the 14 standalone skills, **generated from the
  plugin** by `scripts/vendor-design-skills.mjs`. `.claude/vendor/` is not a
  skill-load path, so these don't double-register against the live `design:*`
  plugin in the dev fork.
- **New generator** `scripts/vendor-design-skills.mjs` — transforms each plugin
  skill (`<name>/` → `design-<name>/`: prefix `name:`, flatten the `description`
  block scalar, drop plugin-only `triggers:`/`od:` keys, strip the plugin-relative
  `skills-protocol.md` ref, curated standalone descriptions for the 3 skills whose
  upstream text name-drops a non-bundled skill or lacks a "Use when" clause). A
  `--check` mode diffs the output against an oracle; verified byte-identical to the
  v0.3.0 public skills. Re-run it to refresh against a newer plugin checkout —
  this is the de-staling tool.
- **`extract-template.sh`** (v0.1.11 → v0.1.12): the skill-copy loop reads
  `design-*` entries from `$DESIGN_VENDOR_REL` instead of `.claude/skills/`; a new
  pre-flight sentinel fails closed if the snapshot is missing or short of 14; the
  source-tree leakage probe now covers the vendored design paths. Extraction is
  again fully reproducible from `$SOURCE_DIR` — no manual cp step. (`copied 44
  skills (0 missing)`; previously the 14 design-* logged "missing in source".)

The design-vendor change is output-neutral (the 14 design skills are byte-identical to
v0.3.0); the only public content change in 0.3.1 is the `thinking-partner` removal above.

## [0.3.0] - 2026-06-22

### Added — v0.3.0 (Areas / HQ model + 6-folder PARA + MCP setup fix)

The big structural release: the public OS adopts the **`2-Areas/` HQ-workstation model** at full parity with the development fork, the PARA layout moves from 5 folders to 6, and the broken default MCP setup is fixed at its root (the extractor heredoc).

**6-folder PARA (was 5).** `2-Areas/` is added as PARA's Areas tier (evergreen HQ workstations) and the rest renumber: `2-Coding → 3-Coding`, `3-Resources → 4-Resources`, `4-Archive → 5-Archive`. Configuration gains `workspace.areas = 2-Areas`. Every doc, template, skill reference, and the workspace skeleton move to the new numbering.

**HQ / Active Project model — now taught as core.** `CLAUDE-template.md` reframes the HQ model from "optional pattern" to the OS's core organizational pattern: each `2-Areas/<name>/` is an evergreen workstation (its own `CLAUDE.md` + `memory.md` + `resources/`); bounded `1-Projects/` deposit durable artifacts into a `parent_hq:` on completion; a routing-map table in `memory.md` loads only the matched HQ per turn (progressive context loading); the completion ritual is enforced by `/archive-project`. A fresh fork still ships `2-Areas/` empty — you grow into HQs. New tracked `2-Areas/README.md` documents the tier.

**MCP setup fixed (root cause).** The default `.mcp.json` now ships the **3 documented universals** (gemini-vision, exa, firecrawl) instead of pre-wiring slack/atlassian/figma (which threw 3 red OAuth errors on every fresh fork's first launch). The opt-in connectors are added interactively by `/bootstrap` Step 2.5, which reads canonical entries from `.mcp.json` `_notes.opt_in_{slack,atlassian,figma}` — those notes now exist (they didn't before, so Step 2.5 had nothing to read). `firecrawl` was previously documented but never registered.

### Removed

Three skills + one hook bound to the maintainer's private infrastructure (not usable by a fork) were dropped from the public bundle. **Skill count 48 → 45; hook count 9 → 8.**

- **A company-internal site publisher skill** — tied to the maintainer's employer's hosting and SSO. Fork users adapt their own static-site publisher.
- **`todo` skill** (+ `todo/lib/ntn.sh`) — bound to the maintainer's personal Notion "Action Items" DB via the `ntn` CLI; a fork has no such database or schema.
- **`end-of-day` skill** — coupled to the maintainer's own note, mail and meeting tools and private MCP servers.
- **`session-start-tasks` hook** — injected the same Notion "Action Items" DB at session start. Removed from the copy set and stripped from the public `settings.json` SessionStart wiring.

### Removed — gbrain semantic arm (maintainer pilot)

The **gbrain** semantic-search arm (a maintainer pilot — a local PGLite index served by an `mcp__gbrain__*` MCP) is stripped from the public export. It had been folded into `/find` *after* v0.2.2, so this is the first release that would otherwise have shipped it to forks that have no gbrain MCP.

- New mechanism: maintainer-pilot content is wrapped in `<!-- public:strip -->` … `<!-- /public:strip -->` markers (invisible HTML comments — the dev fork keeps full functionality); a Phase-6 extractor transform deletes marked blocks, drops `mcp__gbrain__*` from `allowed-tools`, and removes the gbrain clause from `/find`'s description. A fail-closed grep ensures **zero** `gbrain` strings survive in the export.
- Affected skills: `find` (the whole Step 2b semantic arm + ranking rows + failure modes), `os-guide` (two routing rows), `contact-log` (an attribution). Public `/find` is now lexical-only — identical behavior to v0.2.2, plus the new `2-Areas` search path.

### Fixed (extractor + source)

- `extract-template.sh`: the Phase 4 `.mcp.json` heredoc (root cause of the MCP bug) now emits the 3-universal + opt-in config; the token-pattern check allows the `Bearer ${FIRECRAWL_API_KEY}` env placeholder while still failing closed on literal bearer tokens.
- The Phase 1 source leakage probe now scans **only the shipped-skill directories** (the actual export surface) instead of all of `.claude/skills/`, so non-shipped dev skills (cleanup-root, etc.) no longer false-trip it.
- Phase 7 ships a tracked `2-Areas/README.md` and no longer builds a `3-Coding/work|personal|forks|archive` sub-tree — `3-Coding` is **flat** (one folder per repo), consistent across all docs.
- os-guide runtime sync cache (`state/last-sync.json`) is purged from the export (it listed the maintainer's full skill inventory); the `state/.gitkeep` still ships so the dir exists for forks.
- Genericized stray maintainer references caught by the leak gates: `briefing` (a persona-named artifact system → "Artifact System"), `new-project` / `end-of-day` / `os-guide` (private workspace paths → token/generic forms).
- README skill/hook counts corrected; the "Areas was deliberately cut / 5-folder" contradictions removed across README, workspace READMEs, and os-guide.

## Earlier releases

0.1.0 (2026-05-10) through 0.2.2 (2026-05-30) are in the git history: `git log -- CHANGELOG.md`.
