---
name: os-guide
description: "OS reference manual: answers how this second-brain OS works (PARA layout, Configuration tokens, memory model, contacts schema, tools, lifecycle, design system, locked decisions, what skills exist) by reading the canonical files live and citing file:line. Consult it before writing a workspace path, config value or skill claim from memory. Read-only; --sync updates its routing table only with approval. Not for topic recall (/find), people (/contact) or first-run setup (/bootstrap)."
allowed-tools: Read Bash Glob Grep AskUserQuestion Edit
---

# os-guide

Runtime-read librarian over the second-brain OS's canonical source files. Answers "how does X work in this OS?" without ever embedding facts that could drift. Every response carries file:line citations.

**Before you begin: read the Configuration section in root `CLAUDE.md`** (locate via `grep -n "^## Configuration"` — it moves as sections are added). Path tokens like `<workspace.root>`, `<workspace.projects>`, `<assistant.name>` resolve from there — don't hardcode them in answers.

---

## ⚠️ Meta-instruction (for Claude reading this skill)

**If you are about to give an OS-shaped answer from memory rather than reading the canonical source — STOP and invoke this skill instead.** That includes any answer that contains:

- A workspace path (e.g., `<workspace.root>/...`)
- A Configuration token value (`workspace.projects`, `user.email`, `assistant.name`, etc.)
- A claim about a skill's behavior or scope
- A claim that a tool is or isn't installed
- A schema field (contacts, design systems, project frontmatter)
- A locked design decision (if your fork maintains a design-log file)

Memory drifts. Canonical files don't. This skill exists to make the latter cheap to consult.


---

## Why this exists

The OS has seven+ canonical sources (`CLAUDE.md`, `README.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, contacts/`README.md`, plus individual SKILL.md files — and your own design log if you keep one). Without `/os-guide`, answering "where does X live?" or "what's the rule about Y?" is a manual ritual of `grep` + `cat` + remembering which file owns which topic.

The naive alternative — encoding the answers in a tutorial-style skill body — fails the moment any canonical source drifts. The core principle this skill enforces: explainer skills MUST be runtime-read librarians, not textbooks. Reference, don't reproduce (per `SOUL.md` Operating Principles).

Two audiences:
- **Claude Code, self-correcting mid-session** (primary) — about to write a path, a config value, or a skill claim; pauses to verify.
- **Fork users in their first 30 days** (secondary) — figuring out PARA, the Configuration pattern, how to connect a tool, what skills exist.

Designed for the harder Claude-shaped constraint ("cannot hallucinate"); fork users get served as a free side-effect.

---

## When to use

Trigger phrases (broad — the pattern is "OS-shaped explanatory question", not a literal command):

- "what is PARA in this OS?" / "how is PARA set up here?"
- "how do I connect a new tool?" / "how do I add an MCP?" / "how do I connect Slack?"
- "where do briefings go?" / "where does X live?" / "what's the path for Y?"
- "what is `workspace.projects`?" / "what are the Configuration tokens?" / "what does `<workspace.resources>` resolve to?"
- "what skills do I have?" / "what does this OS do?" / "what's the capability index?"
- "which skill creates a project?" / "how do I ask for X?" / "what's the trigger phrase for Y?"
- "how does memory work here?" / "Folder A vs Folder B?"
- "how do I bring in my Codex work?" / "how do I import my old Claude sessions?"
- "does Codex get my MCPs?" / "does Codex see the same skills?"
- "what does the contacts schema look like?" / "what fields does a contact need?"
- "what's the locked decision on X?" / "what did this OS decide about Y?"
- "what are the Operating Principles?" / "what's the rule about duplicate projects?"
- "/os-guide <topic>" / "/os-guide" (interactive prompt for topic)
- "explain the OS" / "remind me how X works here"

**Trigger Claude-self-consult specifically when** the response Claude is about to give includes:
- a path (workspace/project/skill/canonical-source path),
- a Configuration value,
- a claim about a skill,
- a claim about a tool's connection state,
- a schema field.

## Do NOT trigger for

- **Topic-keyed recall over user content** ("do I have anything on Anthropic?", "what did I save about Q1 planning?") — that's `/find`. `/find` searches Resources/Projects/Archive/memory for content the user authored. `/os-guide` does NOT.
- **Entity-keyed recall about a person** ("who is Alex?", "context on Michele") — that's `/contact`.
- **First-run interactive setup on a fresh fork** ("I just cloned this, set me up") — that's `/bootstrap`. `/os-guide` is the post-bootstrap steady-state reference.
- **Action requests** ("create a project", "archive this", "log my interaction with X") — those are the mutation skills (`/new-project`, `/archive-project`, `/contact-log`).
- **Generic theory** (Tiago Forte's PARA framework as a concept, Claude Code as a product, generic productivity systems) — out of scope; refer to external sources. `/os-guide` only answers the *in-this-OS-specifically* version.
- **Live workspace state** ("what projects are active right now?") — that's `project-query.sh`. The skill can point at it but doesn't run it.
- **CLI install instructions** (`brew install <tool>`, org-internal installer flows) — out of scope; point at the appropriate installer.

---

## Precedence vs neighbor skills

When multiple skills could match the user's phrasing, the priority is:

| Skill | Owns | When this skill wins | When it defers |
|---|---|---|---|
| `/bootstrap` | First-run interactive setup, persona regeneration, Configuration writes | Fresh fork before `setup_completed:` is filled in | After fork is configured |
| `/find` | Topic-keyed recall over user content (Resources, Projects, Archive, memory) | "do I have anything on X" / "find my notes on Y" | OS structural questions ("how does X work in this OS") |
| `/contact` | Per-person entity recall | "who is X" / "context on Y" where X/Y is a name | Anything not-a-person |
| `/os-guide` | OS-meta — config, paths, schema, capability index, locked decisions, trigger-phrase map | "how does X work here" / "what is X in this OS" / "where does X live (structurally)" | User content (defer to `/find`); people (defer to `/contact`); first-run (defer to `/bootstrap`) |

**Composition rule**: `/os-guide` MUST NOT call `/find` recursively for OS-knowledge questions (its canonical source list is hardcoded — see Routing Table below). `/bootstrap` SHOULD reference `/os-guide` in its closing for ongoing-manual discovery. `/find` MAY route OS-shaped queries here (one-way; the reverse would loop).

---

## Routing Table — topic → canonical source

This is the librarian's shelves. **Every answer this skill gives MUST cite a row from this table.** If a question doesn't map to any row, the skill responds with the no-canonical-source fallback (see Read Protocol Step 7), never improvises.

### Workspace layout & PARA

| Topic | Canonical source(s) | Notes |
|---|---|---|
| PARA layout (workspace folders) | `<workspace.root>/README.md` §"Layout" + §"Why PARA" | Five folders: Inbox, Projects, Areas, Resources, Archive |
| Area model (what an Area holds, what happens on archive) | `CLAUDE.md` §"Area / Active Project model" + `<workspace.root>/<workspace.areas>/README.md` | Thin Areas: rules, memory and a generated index only; content lives in projects |
| Mac Desktop PARA (6-folder, distinct) | `USER.md` §"Mac Desktop Layout (PARA)" | **Separate system** — disambiguate from workspace PARA |
| What does NOT belong at root | `CLAUDE.md` §"Briefing & report outputs" + `<workspace.root>/README.md` §"The 30-second navigation guide" | Outputs never go at the workspace root |
| Outputs location (briefings/meeting-prep/etc.) | `CLAUDE.md` §"Briefing & report outputs" + `<workspace.root>/<workspace.resources>/README.md` | The Resources README lists each output folder |

### Configuration tokens

| Topic | Canonical source(s) | Notes |
|---|---|---|
| All Configuration tokens (`workspace.*`, `user.*`, `assistant.*`, etc.) | `CLAUDE.md` §"Configuration — source of truth for skills" | Auto-loaded every session. Re-read at every invocation; never cache. |
| Forking the workspace | `CLAUDE.md` §"Forking note" + `README.md` §"Set it up" + `EXAMPLE-CONFIG.md` | Three sources, intentional redundancy |
| `setup_completed` lifecycle marker | `CLAUDE.md` §"lifecycle" subsection of Configuration | Used by `/bootstrap` as re-run gate |
| What changed between template releases | `CHANGELOG.md` | Keep-a-Changelog format; one entry per release |

### Identity & voice

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Assistant persona / voice / boundaries | `SOUL.md` (whole file) | Includes the Operating Principles |
| Operating Principles | `SOUL.md` §"Operating Principles" | 7 principles: Connect-before-create, Revive-before-scaffold, Eliminate-before-automate, Consolidate-before-duplicate, Reference-don't-reproduce, Capture-before-commit, File-before-finish — plus the Boring-is-beautiful default |
| User profile | `USER.md` (whole file) | Fork users edit per their own role/team |
| Assistant identity | `IDENTITY.md` | Name, version, origin |

### Memory

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Memory model (Folder A vs Folder B) | `<workspace.root>/README.md` §"Two memory locations" | Two memory folders, distinct roles |
| Daily journal location | `memory/YYYY-MM-DD.md` (append-only) | Cited from `<workspace.root>/README.md` |
| Writing-style profile | `memory/writing-style.md` | Optional — present if the user has authored one |
| Learned preferences | `memory/learned-preferences.md` | Optional — durable cross-session preferences |

### Tools & MCPs

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Tool inventory (live state) | `TOOLS.md` (root, load on demand) | The canonical documented tool inventory; verify drift-prone connection state with a live probe before claiming readiness. |
| How to add a new tool (MCP or CLI) | `TOOLS.md` §"How to add a tool" | Step-by-step procedure for both paths |
| Declared MCPs | `.mcp.json` at repo root | `mcpServers` block |
| Codex: same skills, instructions and MCP tools? | `README.md` §"How it works (under the hood)" + `.codex/config.toml` + `scripts/codex-config-from-mcp.mjs` | `.codex/config.toml` is generated from `.mcp.json` (same servers; opt-ins stay commented out; Slack isn't available in Codex yet, because the generator always comments it out) and refreshed on every commit once `scripts/install-git-hooks.sh` has run, and by `apply.py add-connectors`; Codex loads it once you trust the folder. Skills and AGENTS.md are shared; hooks run only in Claude Code |

### Contacts & relationships

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Contacts schema (frontmatter + body sections) | `<workspace.root>/<workspace.resources>/contacts/README.md` | **Reference, don't reproduce** — read live, don't restate. |
| Contact location | `<workspace.root>/<workspace.resources>/contacts/<slug>.md` | Per-file flat layout |
| WikiLinks `[[topic]]` convention | `CLAUDE.md` §"Cross-references — WikiLinks convention" | Manual convention; `/find` follows `[[X]]` links |

### Recall and working rules

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Friction protocol / cost-consent rule | MISSING in a fresh fork | Add them to `CLAUDE.md` if you want them; until then surface as a gap |

### Lifecycle skills

| Topic | Canonical source(s) | Notes |
|---|---|---|
| How to create a new project | `.claude/skills/new-project/SKILL.md` + `<workspace.root>/<workspace.projects>/README.md` | The skill body is the authoritative procedure |
| How to archive a project | `.claude/skills/archive-project/SKILL.md` | |
| How to import / migrate existing work into the workspace (Claude or Codex sessions, Claude and Codex memories) | `.claude/skills/migrate-work/SKILL.md` | Reads Cowork, desktop Code tab, Claude Code and Codex sessions, plus Claude and Codex memory files; one approval gate; copy-never-move; offered at the `/bootstrap` close, re-invokable anytime |
| How to prune stale projects | `.claude/skills/prune-projects/SKILL.md` | Friday-batch staleness review |
| How to triage Inbox | `.claude/skills/inbox-process/SKILL.md` + Operating Principle "Capture before commit" | Drives the Inbox-to-home pipeline |
| How to save a resource | `.claude/skills/save-resource/SKILL.md` | |
| How to find existing knowledge | `.claude/skills/find/SKILL.md` | The unified recall surface |

### Planning and build flow

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Which path fits the work (grill, spec, tickets, build, triage, wayfinder) | `.claude/skills/flow/SKILL.md` | The router over the flow skills |
| Which tracker a project uses; where specs, tickets and maps go | `docs/agents/project-context.md` | specs, tickets and maps live in the project folder; every flow skill reads it first |
| Building a ticket or a whole spec (code or knowledge work) | `.claude/skills/implement/SKILL.md` + `references/` | Routes itself: code, knowledge work, or every ticket at once |

### Capability index (dynamic — globbed at invocation)

| Topic | Discovery method | Notes |
|---|---|---|
| All available skills | `find -L .claude/skills -mindepth 2 -maxdepth 2 -name SKILL.md` then read each frontmatter `description:` line | Follow symlinks, validate frontmatter, and never hardcode the list |
| All design-system brands | `find <workspace.resources>/design-systems -name DESIGN.md` | Plus the `README.md` in that directory |
| All contacts (count, not enumeration) | `ls <workspace.resources>/contacts/*.md \| grep -v README \| wc -l` | Enumeration deferred to `/contact` |
| All reference micro-docs | `ls <workspace.resources>/reference/*.md` | Top-level only; subdirs are domain-specific |
| Active projects (live status) | run `<scripts.project_query>` | Defer to the script; don't enumerate inline |

### Design system

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Active design brand | Root `DESIGN.md` | Read by all `design-*` skills |
| Design brand library | `<workspace.root>/<workspace.resources>/design-systems/<brand>/DESIGN.md` | Plus the README catalog in that dir |
| How to swap brand | `.claude/skills/use-design/SKILL.md` | `/use-design <brand>` |

### Hooks & harness

| Topic | Canonical source(s) | Notes |
|---|---|---|
| Hook wiring | `.claude/settings.json` (the wiring) + `.claude/hooks/` (the source) + `CLAUDE.md` §"Skills, hooks and AGENTS.md" | No single explainer doc — surface as a gap if asked. Hooks run only in Claude Code |
| Instructions for Codex- and Cursor-style agents | `AGENTS.md` | A symlink to `CLAUDE.md`, so it never drifts; edit `CLAUDE.md` |
| CCv4 bundle map | `TOOLS.md` §"CCv4 toolchain" + §"Coding-tier hooks" | Coding-tier tools from `./scripts/install.sh --with-coding` |

### First-run setup

| Topic | Canonical source(s) | Notes |
|---|---|---|
| `/bootstrap` procedure | `.claude/skills/bootstrap/SKILL.md` | The skill IS the source of truth on its own procedure: two questions, the rest detected, extras offered at the end |
| Installing the harness (manual or debugging a failed install) | `INSTALL.md` + `scripts/install.sh` | The installer is the default path; INSTALL.md is its step-by-step fallback |
| Re-running `/bootstrap` | `bootstrap/SKILL.md` Tiger invariants (T1-T4) | T2 refuses re-run on configured fork |

### Gaps (no canonical source — surface honestly)

The following are commonly asked but have **no canonical source today**. The skill MUST surface this honestly rather than improvise:

| Topic | Status | Workaround |
|---|---|---|
| Why these MCPs and not others | MISSING | Point at `TOOLS.md` + `.mcp.json` `_notes` block for partial rationale; full rationale lives in your fork's design log if you keep one |
| How hooks work end-to-end | MISSING | Point at `.claude/hooks/` source files + `CLAUDE.md` §"Skills, hooks and AGENTS.md" |
| How to author a new skill (procedural) | PARTIAL | Point at `/skill-creator` SKILL.md — it teaches conversationally |
| Recurring or scheduled work | MISSING | Point at Claude Code's own `/schedule`, `/loop` and hooks; `.claude/settings.json` for what runs automatically |
| Configuration-token resolution under the hood | MISSING | Point at `CLAUDE.md` §"Configuration" for the *what*; explain that skills substitute tokens at read-time |

When asked about a gap topic, respond per Read Protocol Step 7. Do NOT fill the gap with inline content.

---

## Read Protocol

When invoked with a question (or auto-routing match), execute these steps in order:

### Step 1 — Classify the query

Map the user's question to a row in the Routing Table. Multi-topic queries fan out to multiple rows. If no row matches, jump to Step 7.

Also detect the invocation mode:
- **Narrative mode** (default) — if the query is natural language from a user-facing prompt
- **Structured mode** — if the invocation includes a structured args payload (e.g., `args="token:workspace.projects"` or `args="topic:contacts-schema"`) typical of Claude self-consult

### Step 2 — Resolve Configuration tokens

Read `CLAUDE.md` lines containing the `## Configuration` section. Extract every `<token>` value referenced in the routing-table entries you matched. This step is MANDATORY and runs every invocation — never cache token values between calls.

If Configuration is empty or contains placeholder values (e.g., `setup_completed:` is missing or unfilled), **short-circuit immediately** with:

> *"Cannot answer — Configuration section in root `CLAUDE.md` is unfilled or placeholder. This usually means `/bootstrap` hasn't run yet, or the fork was set up manually and Configuration was skipped. Run `/bootstrap` first, then re-ask."*

Never improvise an answer in this state.

### Step 3 — Read the canonical source(s)

Use the `Read` tool. For section-specific lookups, use `offset`/`limit` to fetch only the relevant lines. If section anchors don't match (e.g., the heading moved), fall back to reading the whole file.

For dynamic-glob entries (capability index, brands, contacts count, reference docs):
- Use `Glob` or `Bash` (`find`/`ls`) at invocation time
- Read SKILL.md frontmatter description lines via `Grep` + `Read`
- NEVER hardcode the list in the skill body

### Step 4 — Compose the answer

**For narrative mode**:
- Lead with the answer (no "Great question!" — see voice rules)
- Quote canonical content verbatim where useful; paraphrase only when length demands
- Every factual claim ends with `*(source: <relative-path>:<line-range>)*`
- Resolve all `<workspace.*>` and `<user.*>` tokens to actual values before quoting paths
- Optional one-line "next step" or "want me to…?" closer when appropriate

**For structured mode**:
- Zero prose padding
- Output key:value:source triples in YAML-ish format:

```
key: <token or topic name>
value: <literal value or canonical answer>
source: <relative-path>:<line-range>
resolved_path: <if applicable, fully-resolved path with Configuration substitutions>
related_tokens:
  - <if relevant>
canonical_files:
  - <list of source files consulted>
last_verified: <date if available, e.g. from setup_completed>
```

### Step 5 — Surface disagreements explicitly

If two canonical sources contradict each other (e.g., `README.md` says X about a topic but a SKILL.md or design log says Y), **never silently pick one**. Surface both with citations and explain the hierarchy:

> *"Sources disagree on this:*
> *- `README.md` (line N) says X*
> *- `<other-file>` (line P) says Y*
>
> *When conflicts arise, locked design decisions win over README. Recommend updating README to match. The current locked answer is Y."*

This discipline mirrors `/find`'s contradiction-surfacing rule at `find/SKILL.md:155`.

### Step 6 — Distinguish similar-shaped topics

Some queries are ambiguous between this-OS-specific and generic. Default to the *this-OS-specific* answer; explicitly reject the generic version.

Example — "what is PARA?":
- Generic answer: Tiago Forte's framework → REJECT with one-line redirect to Wikipedia/Forte
- This-OS answer: the 5-folder workspace layout → THIS is what the skill answers

Some queries are ambiguous between disjoint scopes (e.g., "what is PARA?" could mean workspace PARA *or* Mac Desktop PARA, which are distinct). Ask one disambiguating question via `AskUserQuestion` if the answer differs:

> *"Which PARA — the `<workspace.root>/` workspace or your Mac Desktop `~/Desktop/` layout (documented in USER.md)?"*

### Step 7 — No-canonical-source fallback

If the query maps to a "Gaps" row OR no Routing Table row matches at all, respond:

> *"That topic exists in this OS conceptually, but there's no canonical source documenting it yet. Closest related:*
> *- `<file-path>` covers <related-aspect>*
> *- `<file-path>` covers <related-aspect>*
>
> *If you decide what the canonical answer is, write it down at `<workspace.root>/<workspace.resources>/reference/<topic>.md` and re-ask — I'll pick it up next sync."*

**Never improvise.** Never fill the gap with inline generated content. The gap surface IS the correct behavior.

### Step 8 — Out-of-scope refusal

If the query is genuinely outside the skill's scope (asking about generic productivity theory, asking about Claude Code itself, asking for an action that's a mutation skill's job):

> *"Out of scope for `/os-guide` — that's not OS-shaped. Try:*
> *- `<other-skill>` if you meant <X>*
> *- `<external-resource>` if you meant <Y>*
>
> *If you meant something OS-specific and the phrasing came out generic, try rewording — like 'what is `<workspace.projects>` in this OS' instead of 'what is PARA in general'."*

---

## Citation format

**Mandatory on every factual claim** in narrative mode. Format: `*(source: <relative-path>:<line-range>)*`

Examples:
- `*(source: CLAUDE.md:24)*`
- `*(source: README.md:32-39)*`
- `*(source: <workspace.root>/<workspace.resources>/contacts/README.md)*` (whole-file citation when section-specific isn't appropriate)

Relative path is from repo root. If a token-substituted path is more readable, use both:
- `*(source: <workspace.resources>/contacts/README.md — resolves to your configured workspace.root)*`

In structured mode, citations live in the `source:` key, not as inline text.

---

## Voice & answer-shaping

Voice per `SOUL.md` Operating Principles. Lead with the answer. No filler.

**Phrases to use** (from `SOUL.md`):
- "Here's what matters..."
- "Worth noting..."
- "From what I'm seeing..."
- "My take on this..."
- "Want me to...?"

**Phrases to never produce**:
- "Great question!" / "I'd be happy to help!" / "Sure!" — performatively helpful
- "Per your request..." / "Please be advised..." / "FYI..." — corporate fluff
- "Actionable items include..." — corporate-action phrasing
- "As an AI..." or any self-referential meta-narration

**Length discipline**:
- Definitional questions: 2-5 sentences plus citation
- Procedural questions: numbered steps, prereqs surfaced upfront
- "Where is X" lookups: one sentence, the path + citation
- Capability-index questions: structured list, grouped by category, with one-line descriptions from each skill's frontmatter

**No emojis** unless the user explicitly invites them — per `USER.md` formatting preferences.

---

## Failure modes

| # | Failure | Mitigation |
|---|---|---|
| 1 | Stale embedded fact in skill body | This skill body MUST NOT embed facts — Routing Table only. Enforce at edit time. |
| 2 | Renamed canonical file | Step 3 `Read` fails cleanly; skill surfaces *"Routing table points at `<path>` but file is missing — has it been renamed? Run `/os-guide --sync` to refresh."* Never improvises. |
| 3 | Topic has no canonical source | Step 7 — surface the gap honestly with closest-related pointers; suggest writing it down. Never improvises. |
| 4 | Configuration drift (fork renamed `workspace.root`) | Step 2 re-reads Configuration every invocation; substitutes tokens dynamically. Path-shape answers are always correct for the fork's actual layout. |
| 5 | Canonical source itself is wrong | Skill is a faithful repeater. File:line citation lets user/Claude verify and notice. Correctness is pushed to canonical-source maintenance (where the project invests effort). |
| 6 | Recursive self-call / loop | Skill MUST NOT call itself; MUST NOT call `/find` recursively for OS-knowledge. Canonical source list is hardcoded in Routing Table. |
| 7 | Out-of-scope question | Step 8 — graceful refusal with redirects. |
| 8 | Description over-triggers (steals routing from `/find`/`/bootstrap`) | Description claims explicit scope + names neighbors. Eval cases include explicit deferral tests. |
| 9 | Skill body drifts (someone adds prose answers) | The core rule: routing entries only, never content. Pre-commit grep MAY enforce in future. |
| 10 | Two canonical sources disagree | Step 5 — surface both with citations, explain hierarchy. Never silently pick. |
| 11 | User asks for live workspace state (e.g., "what projects are active?") | Point at `<scripts.project_query>` (project-query.sh); don't run it inline. This skill is structural, not state-querying. |
| 12 | Claude self-consults but the user's question wasn't OS-shaped | Skill should still produce a useful answer if possible, but if the question maps to no row, fall to Step 7 (no-canonical-source) gracefully. |

---

## Boundaries

This skill is **read-only by default**. The single exception is `--sync` mode (see `--sync` section below), which edits the Routing Table only, gated by explicit user approval.

The skill MUST NOT:
- Modify any canonical source file (CLAUDE.md, README.md, SOUL.md, TOOLS.md, contacts/README.md, etc.) — those are owned by their respective edit paths (the user, `/bootstrap`, lifecycle skills)
- Auto-install tools, run `/mcp`, modify `.mcp.json`
- Run `git add` or `git commit` — surface commands as text only
- Modify any user content (Resources, Projects, Archive, memory)
- Call itself recursively
- Call `/find` recursively for OS-knowledge questions (canonical source list is hardcoded)
- Fabricate content for gap topics
- Embed facts in its own body — only routing entries, protocol, voice, boundaries

If asked to do any of the above, defer to the appropriate skill (`/bootstrap` for setup, `/new-project` for scaffolding, etc.) — do not silently invoke them.

---

## --sync mode (self-update)

`/os-guide --sync` is the sole mutation mode — it detects what changed in the OS (new skills, MCPs, design brands, locked decisions) and proposes Routing-Table updates without ever auto-applying them. Gated by explicit user approval; never auto-runs.

**Full `--sync` spec** — trigger surfaces, five-phase behavior, report templates, state-file schema, tiger invariants, scope limits, and when-to-run guidance — lives in **`references/sync-spec.md`**. Load it on demand only when actually running `--sync`; normal read-only lookups never need it.

---

## Output formats

**Narrative mode** — markdown response with citations on every factual claim. Optional closing question or next-step pointer.

**Structured mode** — YAML-ish key:value:source block. Zero prose. Designed for Claude self-consult parsing.

**No-canonical-source mode** — gap-surfacing response per Step 7 with closest-related pointers.

**Out-of-scope mode** — refusal + redirects per Step 8.

**Disagreement mode** — explicit "Sources disagree" block per Step 5, citing both, explaining hierarchy.

These five formats are stable. Downstream skills (Layer 3 chief-of-staff) MAY compose `/os-guide` for path/config lookups and parse the structured-mode output specifically.
