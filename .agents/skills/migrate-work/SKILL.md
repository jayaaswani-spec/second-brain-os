---
name: migrate-work
description: "Bring existing work into the PARA workspace by reading past local Claude and Codex sessions (Cowork, the desktop Code tab, Claude Code, Codex), finding real projects, and scaffolding only the approved ones in Projects or Resources. Also carries over existing Claude and Codex memory files into USER.md, SOUL.md or project memory. Read-only discovery, one approval gate, copies never moves, nothing committed; code stays where it is. Not for saving a new note or preference. Use for \"/migrate-work\", \"bring in my existing work\", \"import my projects\", \"migrate my cowork sessions\", \"import my Codex sessions\", \"import my Claude and Codex memories\"."
allowed-tools: Read Bash Glob Grep AskUserQuestion Skill Agent
---

# migrate-work

Pulls your existing work into your PARA workspace. The signal is your **past Claude and Codex sessions stored locally on your Mac**, not a blind scan of your folders. It reads what you've actually been working on across Cowork, the Claude Desktop Code tab, the Claude Code CLI and Codex. It shows you the distinct projects it found that don't already have a home. For the ones you pick, it scaffolds clean PARA entries with a `CLAUDE.md` + `memory.md`, copying any real work files in (never moving them). It also brings over what Claude and Codex already remember about you (your global instructions, Claude Code's auto-memory, Codex's memories): facts about you go to `USER.md`, how you want the assistant to work goes to `SOUL.md`, and project notes go to that project's `memory.md`. You see every line before anything is written.

**Why sessions, not a folder scan:** your work could live anywhere; your sessions are the reliable record of *what you actually do*. Each session carries a title, a working directory, dates, and (while it still exists) a transcript. That's enough to recognize a project and seed its memory.

## Hard invariants (DO NOT VIOLATE)

- **M1 — COPY, NEVER MOVE.** Originals are never moved, renamed, or deleted. Bring work in with `cp`/`rsync`; the user's source folders stay exactly where they are. A move that loses someone's only copy of real work is unrecoverable.
- **M2 — DISCOVERY IS PURE READ.** Phase 1 (enumerate sessions, read transcripts, scout-summarize) touches nothing on disk. No write happens before the approval gate. Every probe verb is read-only. Session stores and memory stores are never modified, and neither is `cleanupPeriodDays` or any other setting.
- **M3 — ONE APPROVAL GATE.** Exactly one human stop: the barrier between discovery and writes. Nothing is scaffolded or copied until the user explicitly selects items. Low-confidence/flagged items are never auto-applied.
- **M4 — NO FABRICATION.** Every discovered "project," summary, and seeded memory line traces to real session content. Never invent a project, a purpose, or a decision the transcript doesn't show. If a session is ambiguous, flag it for the user — don't guess. Recency-derived *metadata* (`suggested_status`, date range) is allowed ONLY as a LABELED inference confirmed at the approval gate. **A session whose transcript is purged has only its title, folder and dates**: say so, seed no decisions from it, and never reconstruct content from the title. **Imported memory lines are written as they stand in the source file** (only list markers, YAML quoting and Codex's internal file pointers removed): never reworded, merged, summarized or completed.
- **M5 — CODE PLACEMENT.** Runnable code stays in its existing standalone repository or, after the user identifies an owning Area, may be copied into `<workspace.areas>/<area>/apps/<app>/` (ignored by the outer repo). NEVER copy runnable code into tracked Projects, Resources, or Inbox paths (a COD project's ignored `app/` is the only Projects exception, and only with approval).
- **M6 — NEVER AUTO-COMMIT.** Writes create new files in the workspace; stop at the diff and surface a manual commit command. Never `git add`/`git commit`.
- **M7 — TRANSCRIPT HYGIENE.** Scouts read only the user's prompts and the assistant's prose. They never read `tool_result` blocks, attachments or hook output, since that's where file contents, env dumps and tokens land. Seeded memory paraphrases in a few words; it never quotes a transcript verbatim and never carries a credential, key, URL token or personal identifier. Assistant prose can contain these too (cloud IDs, account IDs, people's names and emails echoed back from a tool), so scouts scrub them from everything they return, not just from tool output. Memory lines are the user's own notes and are imported as written, with two exceptions: a line that looks like a credential is never written and never echoed, only reported by file and line; and a line carrying another person's contact details (email, phone) is shown at the gate marked as such, never preselected.

All paths resolve from the Configuration section in root `CLAUDE.md` (`<workspace.root>`, `<workspace.projects>`, `<workspace.resources>`, `<workspace.areas>`, `<workspace.archive>`). Read those first.

**Set up first.** If `setup_completed` in that section is missing or still `<YYYY-MM-DD>`, or `user.name` or any `workspace.*` value is still a `<...>` placeholder, this workspace hasn't been through `/bootstrap`. Stop before discovery and say: *"This workspace isn't set up yet. Run `/bootstrap` first (two questions); at the end it offers to bring in your existing work."* Read nothing else and write nothing. Imported memories land in `USER.md` and `SOUL.md`, which `/bootstrap` fills in from templates, and the scaffolds need the real workspace paths and the person's name, so importing first would leave raw placeholders behind.

---

## Where sessions live

Four local stores. The bundled enumerator reads all four, so you rarely touch them directly, but this is what it's reading:

| Store | Path | Metadata | Transcript | Gotchas |
|---|---|---|---|---|
| **Cowork** | `~/Library/Application Support/Claude/local-agent-mode-sessions/**/local_*.json` | `title`, `cwd`, `userSelectedFolders`, `initialMessage`, `createdAt`/`lastActivityAt` (epoch ms) | `local_<id>/audit.jsonl` beside the metadata | `cwd` is a VM sandbox (`/sessions/<name>`, or the session's own `outputs/` dir), **not** the user's folder. The real folder is `userSelectedFolders[0]`; with none selected, group by title. |
| **Desktop Code tab** | `~/Library/Application Support/Claude/claude-code-sessions/**/local_*.json` | `title`, `cwd`, `originCwd` (repo behind a worktree), `cliSessionId`, `scheduledTaskId`, `isArchived`, `createdAt`/`lastActivityAt` | `~/.claude/projects/*/<cliSessionId>.jsonl` (the CLI store) | Metadata outlives the transcript. `scheduledTaskId` set = a recurring job run, not project work. `isArchived` only means hidden from the sidebar, not done. |
| **Claude Code CLI / IDE / SDK** | `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` (honors `$CLAUDE_CONFIG_DIR`) | Per record: `cwd`, `gitBranch`, `timestamp` (ISO), `entrypoint`; `custom-title` / `ai-title` / `agent-name` records carry the title | The file itself | Transcripts are **deleted after `cleanupPeriodDays` (default 30)**. Folder names start with `-`, so bare `ls */*.jsonl` fails; glob with a path prefix. Project folders can hold 100k+ `tool-results` subdirs, so never recurse. `<uuid>/subagents/*.jsonl` are sidechains: skip them. Never decode the folder name back to a path (`/`, `.` and spaces all become `-`); read `cwd` from the records. |
| **Codex** (desktop app, CLI, IDE, `codex exec`) | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` and `~/.codex/archived_sessions/rollout-*.jsonl` (honors `$CODEX_HOME`) | First record of every file is `session_meta`: `id`, `cwd`, `timestamp`, `source`, `thread_source`, `originator`, `git`. Titles are in `~/.codex/session_index.jsonl` (`id`, `thread_name`, `updated_at`; last entry wins) | The rollout files | A long thread is split across several files sharing one `id` (later pages are named `rollout-<ts>-<id>_<page>.jsonl`). Subagent threads (`source` is an object, or `thread_source: subagent`) are sidechains and outnumber real threads: skip them. `source: exec` is a scripted `codex exec` run. Chats started without a folder run in `~/Documents/Codex/<date>/<slug>`, a scratch folder like Cowork's sandbox. `archived_sessions` only means hidden from the sidebar. The first line can be large (it carries the base instructions): read fields with `jq`. Leave the `*.sqlite` files alone; their schema is internal and versioned. |

Metadata files can be ~1MB each: extract fields with `jq`, never load whole blobs into context.

The Desktop app also exposes `mcp__ccd_session_mgmt__list_sessions` and `search_session_transcripts`. They aren't needed here and aren't a substitute: they exist only inside the Desktop app, list recent sessions rather than full history, and don't expose purged or Cowork sessions. The enumerator reads the stores on disk, so it works from the terminal CLI too.

---

## Phase 1 — Discover (read-only)

### 1a. Enumerate every session

Run the bundled enumerator. It is read-only, prints JSONL to stdout, and takes about 30s on a machine with ~1,000 sessions. Write its output to the scratchpad (not the workspace) and query it with `jq`:

```bash
.claude/skills/migrate-work/scripts/enumerate-sessions.sh \
  --workspace-root "<abs path of workspace repo root>" \
  --exclude-session "<current session id, if known>" \
  > "<scratchpad>/sessions.jsonl" 2> "<scratchpad>/stores.json"
```

One row per session. Desktop and CLI overlap through `cliSessionId`; the overlapping ones are emitted once, as `source: desktop`. A Codex thread spread over several files is one row. `stores.json` holds one line saying which stores were read and how many Codex subagent threads were skipped: `{"stores":{"cowork":"read","desktop":"read","cli":"read","codex":"absent"},"skipped":{"codex_subagent_threads":0}}`. Put the skipped count in the census.

| Field | Meaning |
|---|---|
| `source` | `cowork` · `desktop` · `cli` · `codex` |
| `id`, `title`, `cwd`, `entrypoint` | as recorded (`entrypoint`: `cowork`, `claude-desktop`, `cli`, `sdk-cli`, IDE names, `codex-desktop`, `codex-cli`, `codex-ide`, `codex-exec`). A Codex thread with no index title takes its first real prompt, cut to 80 characters |
| `project_key` | the normalized folder the work was about: Cowork's selected folder → Desktop's `originCwd` → `cwd`, with `/.claude/worktrees/<name>` stripped. `null` for sandboxes (Cowork's, Codex's `~/Documents/Codex/…` and anything under `~/.codex/`), temp dirs and container dirs (`$HOME`, `~/Desktop`, `~/Downloads`, `~/Documents`) |
| `created_ms`, `last_ms` | epoch ms (may be `null` on a damaged transcript; show "unknown") |
| `transcript`, `transcript_status` | path, and `present` · `purged` (metadata survives, transcript deleted) · `none`. Codex rows also carry `transcript_parts`, every file of the thread oldest first; `transcript` is the newest |
| `git_remote` | Codex only: the thread's `session_meta.git.repository_url`. Codex runs worktree threads under `~/.codex/worktrees/…`, which gives no `project_key`; such a row joins the candidate whose folder has the same remote |
| `noise` | `scheduled-task` · `temp-dir` · `headless-run` (untitled `sdk-cli`: evals, `claude -p` scripts; every `codex exec` run) · `no-cwd-no-title` · `null` (= signal) |
| `in_workspace`, `is_workspace_root` | whether `project_key` is inside, or is, the workspace repo |
| `archived`, `initial_message` | sidebar-archived flag; Cowork's opening prompt (200 chars) |

**Graceful degradation (M2/M4):** if every store is missing or empty, say so plainly: *"I don't see any past Claude or Codex sessions on this machine (Cowork, Desktop Code tab, Claude Code or Codex), so there's nothing to import."* Then stop. If only some stores exist, name which ones you read, from `stores.json`. A missing store is normal (many people use only one tool), never an error. Never pretend work exists.

Report the census before grouping, so the user can see what was read and what was set aside: which stores were read, sessions per source, how many are noise and why, and how many have purged transcripts.

### 1b. Group sessions into candidate projects

Drop `noise != null` rows (scheduled-task runs are recurring jobs, which belong in Schedule Tasks, not projects). Then collapse the rest:

1. **Same `project_key` = same project** (strongest signal, and works across sources and tools: a folder touched from Cowork, the Code tab and Codex is one project, listed once with every source).
2. **`project_key == null` but a `git_remote`** (a Codex worktree thread) → the candidate whose folder has that remote (`git -C "$dir" remote get-url origin`, only for folders that are their own repo). Otherwise:
3. **`project_key == null`** (Cowork with no selected folder, sessions run from `$HOME` or `~/Desktop`) → group by obvious title stem.
4. **`is_workspace_root`** → sessions run inside the second brain itself. The folder says nothing, so group by title stem. Drop routine OS work: titles that match an existing skill or scheduled job (briefing, end of day, inbox, reindex, handoff/resume, "chat session", greetings). Keep substantive threads ("Build a dashboard for the sales pipeline").
5. Drop throwaways (empty title *and* no transcript, a couple of turns, scratch/test names). Keep them countable, not surfaced.

Then run **"already has a home"** (SOUL.md *Connect before create*). For each group, check before proposing:
- `project_key` sits inside `<workspace.projects>`, `<workspace.archive>`, `<workspace.areas>` or `<workspace.resources>` → already tracked.
- `project_key`'s basename equals the `app_id` or `name` in an Area `apps/*/app.manifest.json`, or its git remote matches the remote of any repo under `<workspace.areas>/*/apps/*`, `<workspace.projects>/*/app` or `<workspace.archive>/*/app` → already tracked. Match whole values, never substrings: a substring `grep` marks folders like `~/knowledge` or `…/skills` as tracked because those words appear somewhere in a manifest's prose.
- The title stem matches an existing project slug or folder (`ls` the Projects and Archive buckets, or invoke `/find <stem>` with the `Skill` tool; `/find` is read-only) → likely tracked.

Tracked groups are listed as **"already in your workspace"** (counts only) and never re-scaffolded. Any match that's only probable is flagged as a possible duplicate, not dropped.

Produce the candidate list: `{ project_label, project_key, sources, session_count, date_range, date_range_by_source, transcripts_present, transcripts_purged, sample_transcript_paths, tracked_match }`. Titles are often raw prompt text (Codex names a thread after its first message; the enumerator falls back to the first prompt), so scrub them like scout output before they reach the census or the gate (M7). Pass `date_range_by_source` to the scout: the overall last-activity date often comes from a purged source, and the scout needs to know which dates it can actually check.

### 1c. Fan out scout subagents (one per candidate project)

For each untracked candidate, spawn a **read-only scout** with the `Agent` tool (formerly `Task`), all in one message so they run in parallel. Use `subagent_type: "Explore"`: the built-in agent type with no Write, Edit or NotebookEdit, which makes M2 structural rather than prose. A per-call tool list isn't possible; the agent type is the restriction. Tell the scout that Bash is for read verbs only (`jq`, `head`, `tail`, `ls`, `git … rev-parse`), and make its contract explicit: *returns a proposal only, performs zero writes, obeys M7.* If `Explore` isn't available, run the scouts inline in the main loop instead of using a general-purpose agent that can write. Give it the candidate row and at most ~5 sample transcript paths (the most recent ones with `transcript_status: present`; for a Codex row pass its whole `transcript_parts`, so the scout can read the opening page and the newest).

Each scout reads a SAMPLE, never whole files:

- **Claude Code transcript** (`source` `cli` or `desktop`): the first ~5 real user prompts, the `last-prompt` record, and the last few assistant text blocks:
  ```bash
  # real user prompts: not meta, not sidechain, text only, no harness wrappers
  # (<command-…>, <system-reminder>, <preview-annotation-context>, "[Request interrupted…]",
  #  injected skill bodies that start "Base directory for this skill:"). awk drops repeats.
  # Every value is flattened to one line first, so head/tail count records, not lines.
  jq -r 'select(.type=="user" and (.isMeta|not) and (.isSidechain|not))
    | .message.content | if type=="string" then . else (map(select(.type=="text").text) | join(" ")) end
    | select(length>0)
    | select(test("^\\s*(<[a-z][a-z-]*[ >]|\\[Request interrupted|Base directory for this skill:)")|not)
    | gsub("\\s+";" ") | .[0:300]' "$t" | awk '!seen[$0]++' | head -5
  jq -r 'select(.type=="last-prompt") | .lastPrompt | gsub("\\s+";" ") | .[0:300]' "$t" | tail -1
  jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text | gsub("\\s+";" ") | .[0:400]' "$t" | tail -3
  ```
- **Codex rollout files** (`source` `codex`): read the first file in `transcript_parts` for the opening prompts and the newest for where it ended. Real prompts are `response_item` messages with `role: user`; skip `developer` messages and the harness wrappers Codex injects as user text (`<environment_context>`, `<permissions instructions>`, `<skill>` bodies, `# AGENTS.md instructions…`). Skip `# Files mentioned by the user` messages entirely: they carry pasted file contents (M7). The best summary signal is each turn's `task_complete.last_agent_message`, like Cowork's `result`. Never read `function_call_output`, `custom_tool_call_output`, `reasoning` or `world_state` records (M7).
  ```bash
  jq -r 'select(.type=="response_item" and .payload.type=="message" and .payload.role=="user")
    | [.payload.content[]? | select(.type=="input_text") | .text] | join(" ")
    | select(length>0)
    | select(test("^\\s*(<[a-z][a-z_-]*[ >]|# AGENTS\\.md instructions|# Files mentioned by the user)")|not)
    | gsub("\\s+";" ") | .[0:300]' "$first" | awk '!seen[$0]++' | head -5
  jq -r 'select(.type=="event_msg" and .payload.type=="task_complete") | .payload.last_agent_message // ""
    | gsub("\\s+";" ") | .[0:400]' "$newest" | tail -3
  ```
- **Cowork `audit.jsonl`**: the same `user`/`assistant` shape (the prompt and assistant commands above work unchanged), plus `initial_message` from the row. Cowork also writes `result` records holding each run's final answer, which are the best single summary signal: `jq -r 'select(.type=="result") | .result // "" | gsub("\\s+";" ") | .[0:400]' "$t" | tail -2`. Skip `tool_use_summary` records (M7). A one-line `audit.jsonl` is a session that never got a reply, so treat it as a throwaway.
- **Purged transcripts** give title, folder and dates only. The scout says so and returns no seed memory for those sessions (M4).
- If `project_key` still exists on disk, list it shallow (read-only: `ls`, `git -C "$dir" rev-parse --show-toplevel`) and count files to depth 2. The folder is its own repo only when `--show-toplevel` prints the folder itself (compare against `cd "$dir" && pwd -P`, since git prints resolved paths); a folder nested inside some bigger repo is not, so never read that parent's remote. Docs are `md txt pdf docx pptx xlsx csv html`; source is `py js ts tsx jsx sh go rb rs java sql`; ignore `.git`, `node_modules` and virtualenvs. Same lists for every scout, so reports compare.
- **If `project_key` no longer exists** (moved or deleted since), don't treat the errors as failure. Set `cwd_has_files: false`, flag `folder missing`, and propose a memory-only entry seeded from the transcripts. At the gate, ask the user whether the folder moved; never search the disk for it on your own.

Each scout returns a structured proposal (NEVER writes anything):
- `project_name` + `one_line_summary` (from real transcript content; M4)
- `suggested_bucket`: `<workspace.projects>` (active or paused, time-bound work) | `<workspace.resources>` (reference/research/notes, and finished work). These are the only two targets unless it's clearly a code repo. A candidate whose `suggested_status` is `done` always defaults to `<workspace.resources>`
- `is_code`: true if `project_key` is a runnable code tree (→ M5: leave standalone or propose an owning Area app; never fold into a tracked project)
- `suggested_status`: active (last activity within 30 days) | paused (31 to 90) | done (older). This is an INFERENCE from `last_ms`, NOT a transcript fact; it's surfaced at the approval gate and only written as `status:` after the user confirms. Everything in `<workspace.projects>` is live work, so a `done` item is never scaffolded there: it comes in as reference material in `<workspace.resources>`
- `seed_memory`: 2–5 short paraphrased bullets of durable context/decisions actually present in the transcripts read (M4, M7)
- `evidence`: how many transcripts it actually read vs. how many were purged
- `cwd_has_files`: whether real source files exist to optionally copy in
- `confidence` + `flags` (ambiguous? mixed projects? code+docs? evidence mostly purged? possible duplicate of `<existing slug>`?)

Collect all scout proposals (barrier).

### 1d. Collect memories (read-only)

Once the candidates are known, read what Claude and Codex already remember about the user:

```bash
python3 .claude/skills/migrate-work/scripts/collect-memories.py \
  --workspace-root "<abs path of workspace repo root>" \
  --sessions "<scratchpad>/sessions.jsonl" \
  > "<scratchpad>/memories.jsonl" 2> "<scratchpad>/memory-stores.json"
```

| Store | Path | What's read |
|---|---|---|
| Claude global instructions | `~/.claude/CLAUDE.md` (honors `$CLAUDE_CONFIG_DIR`) | every bullet and prose line |
| Claude Code auto-memory | `~/.claude/projects/<folder>/memory/*.md` | each memory file's one-line `description` (a description spread over several lines is skipped for the first body line, so every row is one quotable line), with its `type` (`user`, `feedback`, `project`, `reference`; top level or under `metadata:`). `MEMORY.md` is only an index of these files, so it's skipped. The folder a memory belongs to comes from that project's transcripts; when they've been cleaned up, from matching the folder name against the paths in `sessions.jsonl` (encoded forward, never decoded) |
| Codex global instructions | `~/.codex/AGENTS.md` (honors `$CODEX_HOME`) | every bullet and prose line |
| Codex memories | the newest `~/.codex/memories*/memory_summary.md` (older versions are stale and skipped; stderr lists them) | lines under User Profile, User preferences, General Tips, What's in Memory and Older Memory Topics, where a heading that is a path names the project folder. Codex's other memory files (`MEMORY.md`, `raw_memories.md`, `rollout_summaries/`, the `*.sqlite` stores) are its internal working notes and are never read |

One row per memory line: `id`, `source`, `file` + `line` (every written line traces back), `text` (null when `sensitive`), `hint` (the store's own label: `user`, `feedback`, `project`, `reference`, `profile`, `preference`, `tip`, `project-note`, or null), `section`, `project_key`, `project_folder_known` (false when a project memory's folder couldn't be placed), `in_workspace` / `is_workspace_root` (as in the session rows), `sensitive`, `exists_in` (workspace files already holding this text), `same_as` (an earlier row with the same text). If stderr reports `items: 0`, say once *"No Claude or Codex memories on this machine, so there's nothing to bring over."* and skip memories from here on. Mention `unreadable_files` if it isn't 0.

**Route every line in two steps** (judgment where the hint is null; never a rewrite).

*Scope first.* A line is **project-scoped** when its hint is `project` or `project-note`, or when it has a `project_key` and its text is plainly about that project's work (a `feedback` line saying "in this repo, run the linter first" is project-scoped; "never use emojis" is not, wherever it was saved). A project-scoped line goes to that project's `memory.md`:
- a candidate brought in at the gate, or a project already in the workspace: the Projects or Archive entry whose folder or remote matched in 1b (an Area app match goes to the owning Area's `memory.md`);
- otherwise it **waits for its project**: listed, never written;
- `is_workspace_root` (memories saved while working inside this workspace) or `project_folder_known: false`: **fits nowhere**. They describe this workspace or a folder that can't be placed.

*Then kind*, for everything else:

| Line | Destination |
|---|---|
| A fact about the person: `user`, `profile`, or a global-instruction line stating who they are (role, team, location, accounts) | `USER.md` |
| How the assistant should behave: `feedback`, `preference`, or a global-instruction line that is an instruction | `SOUL.md` |
| A line that is both (a fact and an instruction) | `SOUL.md` when it tells the assistant to do something, else `USER.md` |
| `reference` or `tip` with no project, and global-file lines about tools or this workspace | **fits nowhere** |

**Flag before you show** (none of these are written, all are listed with their reason):
- `sensitive` → *held back, looks like a credential*: the collector already drops its text; show only the file and line. The collector's patterns can miss a credential written in plain words, so read every routed line once more before the gate and hold back anything that is a password, key, token or secret, however it's phrased.
- `exists_in` non-empty → *already in <file>*. Also judge near-duplicates against the destination file by reading it; when unsure, flag rather than write.
- `same_as` set → one line, both sources named.
- **About someone else**: a line about, or addressed to, a person or an assistant other than this workspace's own (`user.name` / `user.full_name` and `assistant.name` in the Configuration), such as "Max prefers…" when the user here is Jane, or "Echo should…" when the assistant here is Atlas. Memories carried over from another setup or another person's machine read like instructions for someone else. Hold it back and count it; the user can bring any of them in by number.
- **Conflict or overlap**: read the destination file and compare every routed line. Flag a line when the file already says something on the **same topic**, whether it contradicts it (USER.md says New York, the memory says London), narrows it or widens it (the file allows emojis in briefings, the memory says never use emojis in status updates). Flag two imported lines on the same topic the same way (short answers vs detailed answers). Topic, not wording, decides, with one test: **could someone follow both the file and the line without breaking either?** If yes, the line only adds detail ("product manager at Acme; my team ships the sales dashboards" beside a Role of "Product manager at Acme"; "meeting notes as bullet lists" beside "bullets for action items"), so it's written. If following the line would break the file, or the file the line ("never use emojis in status updates" beside "emojis are fine in briefings"), it's flagged. Show both sides of a flagged line; write neither; the user settles it by hand.

---

## Phase 2 — Approve (the ONE gate, M3)

Present a single, scannable picture: *"From your past sessions (N Cowork, N Code tab, N Claude Code, N Codex) I found these projects that aren't in your workspace yet."* Leave out sources that weren't read. Lead with the census line from 1a and the "already in your workspace" count, so nothing looks silently dropped.

Use `AskUserQuestion` (multi-select). It holds at most four options per question, so list every candidate in the message as a numbered row and, when there are more than four, make the options groups (`All recommended`, `Only the <workspace.projects> ones`, `None`) with single candidates picked by number through "Other" ("1, 4 and 7"). Annotate each row with the evidence: label, what it was, sources + session count + date range, suggested bucket, and any flag (especially "evidence mostly purged" and "possible duplicate"). Group by suggested bucket. Collapse low-confidence/throwaway candidates under a "maybe" note rather than selecting them.

The user picks which to bring in. Every picked item takes its defaults unless the user changes them in the same call: the scout's suggested bucket (`<workspace.projects>` vs `<workspace.resources>`) and status, **scaffold only** (no files copied), code repos stay standalone with a pointer (M5), and a missing folder is recorded as missing. Show those defaults on each candidate's row, and add one question to the call: *"Use these defaults?"* (**Yes** / **Let me change some**). Only "Let me change some" earns a follow-up, and only for the items the user names: bucket, copying the work files, or an owning Area app for code. A `done` item the user moves to `<workspace.projects>` must also get `active` or `paused` in that same follow-up; if the user keeps it `done`, it stays in `<workspace.resources>`. When `/new-project` scaffolds a picked item, pass it the confirmed name, bucket, prefix, type and status, and treat its own confirmations as already answered here; never let it ask again.

**Memories go through the same gate.** Under the project picture, list every line that would be written, **numbered**, grouped by destination, each with its source (Claude global, Claude Code memory, Codex global, Codex memory): `→ USER.md`, `→ SOUL.md`, `→ <project> memory.md`. Lines marked as another person's contact details are listed but not preselected. **When more than 40 lines would be written**, the full list stops being readable in chat: show each destination's count and its first five lines, write the complete numbered list (same numbers, same grouping, each with its source) to `<scratchpad>/memory-lines.md`, and give that path in the message so the user can read every line before answering. The scratchpad is outside the workspace, so this is not a workspace write (M2). Below that, give the lines that won't be written as counts by reason (waits for its project, fits nowhere, already there, about someone else, conflicts with both sides shown, credentials held back), and show any of them in full if the user asks. Ask the memory question in the **same** `AskUserQuestion` call as the project question: multi-select over the destination groups (`USER.md lines`, `SOUL.md lines`, and one option per destination project while the four-option limit allows, else `Project memory lines`), plus none. To drop single lines, the user names their numbers through "Other" ("all except 4 and 9"); honor exactly that. A project's memory lines are written only if that project was picked in the same call or is already in the workspace. With no memories, ask the project questions alone.

The whole gate is one `AskUserQuestion` call of up to four questions: projects, memories, defaults. Nothing else asks the user anything before Phase 3, except the follow-up for "Let me change some".

Nothing is written until the user has selected. Cancel = stop, zero changes.

---

## Phase 3 — Bring it in (writes, approved items only)

For each approved item, in sequence:

1. **Scaffold the PARA entry — non-code branch ONLY.** Invoke `/new-project` with the `Skill` tool for the scaffold (it does classify + naming + frontmatter + templates + `parent_hq` linkage). Result:
   - `<workspace.projects>/<prefix>-YYYY-MM-<slug>/` with `CLAUDE.md` (`status:` from the **user-confirmed** suggested_status, which is only ever `active` or `paused` here, `created:` today, `project-type:`, one-line summary, ≤80 lines) + `memory.md`.
   - or a `<workspace.resources>/<topic>/` entry for reference-type work and for every `done` item (route into the existing subfolder that owns its type; `ls` first). A Resources entry carries no project `status:`.
   - **NEVER invoke `/new-project` with `type=code-repo` from here.** That branch runs `git add`/`git commit` and can `gh repo create … --push`, which would violate M6 (no auto-commit) and M5 (code gets a pointer, not a scaffold). A code candidate the user approved into `<workspace.projects>` gets a `COD-` planning project (`/new-project` type `code-effort`, told the code already lives in an existing repo, so it creates no `app/`) whose CLAUDE.md points at the repo; the repo itself takes the pointer path in step 3.
2. **Seed `memory.md`** (append-only) from the scout's real findings, leaving out any point an approved memory line for this project already states (that line goes in word for word in the memory step, so the scout's paraphrase would repeat it):
   ```
   ## <today> — imported from past sessions
   - Source: <N> sessions (<n> Cowork, <n> Code tab, <n> Claude Code, <n> Codex), <date range>, folder `<project_key>`
   - Evidence: read <n> transcripts; <n> purged (title/folder/dates only)
   - What this was: <one_line_summary>
   - Context carried over: <seed_memory bullets, only what the transcripts actually showed>
   ```
   Never fabricate (M4); never quote secrets (M7).
3. **Copy work files only if approved (M1 — copy, never move).**
   - **Sandbox guard:** if the folder is empty/unresolved, matches `/sessions/*`, lives under `local-agent-mode-sessions`, or is a temp/scratchpad dir, it's a throwaway sandbox path, NOT real work. Skip the copy entirely and seed the entry from the transcripts only. (The enumerator already nulls these, so a non-null `project_key` that matches is a bug; flag it.)
   - **Mandatory secret pre-scan** (before any copy, regardless of is_code): `grep -rIlE '(api[_-]?key|secret|token|passwd|password|BEGIN [A-Z ]*PRIVATE KEY)' "<dir>" 2>/dev/null` and check for `.env` / `*.pem` / `*.key`. If ANY hit, ABORT this item's copy and flag it for the user. Never copy secrets into a committed workspace folder (the locked code-placement rule: a live API key once leaked this way).
   - **Copy with `rsync`** (BSD `cp -R` has no `--exclude`, so it would drag in `.git/` + secrets; never use it here). `.git/` is ALWAYS excluded:
     ```bash
     rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='build' \
           --exclude='__pycache__' --exclude='.venv' --exclude='.env' --exclude='*.pem' --exclude='*.key' \
           "<dir>/" "<dest>/"
     ```
   - Originals stay exactly where they are.
   - **If it's runnable code (M5):** do NOT copy into the project/resource folder. Leave the repo where it is and add a pointer in the approved planning note. If the user explicitly identifies an owning Area and approves a copy, target `<workspace.areas>/<area>/apps/<app>/`, preserving independent git/dependencies/secrets/deploys and adding `app.manifest.json`. The manifest is the app's only registration.
4. **Log** the migration (what was scaffolded, what was copied vs referenced).

Then, for the memory groups the user approved, append (never rewrite, never reorder existing content):
- **`USER.md` / `SOUL.md`**: one section at the end of the file,
  ```
  ## Imported from Claude and Codex (<today>)
  - <text> _(<source>)_
  ```
- **A project's `memory.md`**: one entry, after the import entry from step 2 (or at the end, for a project already in the workspace),
  ```
  ## <today> — memories imported from Claude and Codex
  - <text> _(<source>)_
  ```
`<text>` is the row's `text`, exactly. Flagged lines are never written. Re-read each file afterwards and check every written line is present once.

After all approved items: print a summary of what was created, then surface the manual commit command as TEXT (M6, never run it):

```
Brought in <N> projects and <M> memory lines. Originals and memory stores untouched.
Created: <list of new workspace paths>
Appended to: <USER.md / SOUL.md / project memory.md, with line counts>
Not written: <counts by reason>
Review and commit when ready:
  git add <each created path> && git commit -m "migrate-work: import from past sessions"
```

If many candidates showed "evidence mostly purged" from Claude Code or the Code tab, mention once that Claude Code keeps transcripts for `cleanupPeriodDays` (default 30) and that the user can raise it in `~/.claude/settings.json` if they want longer history next time. Mention it only; never change the setting (M2).

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Reported projects that don't exist in any session | M4 violated (fabrication) | Every candidate traces to real session metadata + transcript; flag ambiguous, never invent |
| Summary or decisions for a project whose transcripts are all purged | reconstructed content from a title | Purged = title/folder/dates only; label it, seed nothing (M4) |
| Every Cowork session grouped as its own "project" | grouped on Cowork `cwd`, which is a `/sessions/<name>` sandbox | Use the enumerator's `project_key` (`userSelectedFolders[0]`), else title stem |
| Same work shown twice (Code tab + Claude Code) | read both stores without de-duping on `cliSessionId` | The enumerator emits overlap once; don't re-enumerate by hand |
| One Codex thread shown as several sessions, or hundreds of Codex "projects" | read rollout files one by one: long threads span several files, and subagent threads outnumber real ones | Use the enumerator's rows: one per thread id, subagents skipped |
| A folder used from both Claude and Codex shown as two projects | grouped by source before `project_key` | Group on `project_key` across all sources; list every source on the one candidate |
| No Codex sessions reported on a machine that has them | `$CODEX_HOME` points somewhere other than `~/.codex` | The enumerator honors `$CODEX_HOME`; check `stores.json` says `codex: read` |
| "Morning briefing" ×40 offered as a project | scheduled-task runs not filtered | Drop `noise == scheduled-task`; recurring jobs aren't projects |
| Re-scaffolded a project that already exists | skipped the "already has a home" check | Run 1b's tracked check against Projects/Archive/Areas/code index before proposing |
| Hundreds of workspace-root sessions shown as one giant project | grouped on `project_key` when it's the workspace root | Workspace-root sessions group by title stem; routine OS work is dropped |
| Enumeration hangs for minutes | recursed `~/.claude/projects` (100k+ tool-results dirs) | Top-level `*.jsonl` only (`-maxdepth 2`); subagent transcripts are skipped |
| `ls: unrecognized option` on the CLI store | folder names start with `-` | Glob with a path prefix (`"$CLI"/*/…`), never bare `*/` |
| A token or file dump appears in seeded memory | scout read `tool_result` blocks (Codex: `function_call_output`, `# Files mentioned by the user`) or quoted verbatim | Prompts + assistant prose only; paraphrase (M7) |
| Moved/renamed a user's folder | M1 violated | COPY only; originals are never touched. State this up front |
| Wrote files before the user picked | M3 violated | Phase 1+2 are read-only/selection only; Phase 3 runs only on explicitly approved items |
| Code repo folded into `<workspace.projects>/` with its secrets | M5 violated | Leave it standalone or use an approved owning Area app + pointer; never tracked content buckets |
| Choked reading 1MB metadata × N | loaded whole blobs | The enumerator extracts fields with `jq`; scouts sample transcripts (head/tail/N turns), never whole files |
| A memory line reworded, merged with another or "cleaned up" | treated memories as material to summarize | Write the row's `text` exactly; flag instead of merging (M4) |
| USER.md now says two different timezones | wrote a line that conflicts with the file | Compare every routed line with the destination file; conflicts are shown, never written |
| A key or token from a memory file landed in SOUL.md or the chat | skipped the `sensitive` flag | Held back and reported by file and line only (M7) |
| Codex's `raw_memories.md` or rollout summaries imported | read Codex's internal working files | Only `memory_summary.md` is read |
| Project notes written for a project the user didn't bring in | routed by `project_key` without checking the gate | Project lines wait unless their project was picked or already exists |
| "No sessions" treated as an error | absent stores on this fork | Degrade gracefully: say which stores were read, that there's nothing to import, and stop |
| Auto-committed the migration | M6 violated | Surface the commit command as text only |
| Delegated `/new-project` auto-committed or pushed a repo | routed a code candidate into `/new-project`'s code-repo branch | NEVER call `/new-project` with `type=code-repo`; code stays standalone or uses an approved Area app destination (M5) |
| `.git/` or a `.env` copied into a project folder | used `cp -R` (no exclude) or skipped the secret pre-scan | Use the `rsync --exclude` command; run the mandatory secret pre-scan; `.git/` is always excluded |

## Boundaries

- **Copy, never move** (M1) · **discovery is read-only** (M2) · **one approval gate** (M3) · **no fabrication** (M4) · **runnable code stays standalone or uses an approved owning Area app** (M5) · **never auto-commit** (M6) · **prompts and prose only, paraphrased** (M7).
- Reads ONLY the user's own local session and memory stores (Cowork, Desktop Code tab, Claude Code, Codex, the global instruction files), never anyone else's data, never the network.
- Memory import appends to `USER.md`, `SOUL.md` and project `memory.md` files; it never edits or removes what's already there.
- The two valid migration targets are `<workspace.projects>/` (active or paused, time-bound) and `<workspace.resources>/` (reference/research and finished work). Evergreen areas (`<workspace.areas>/`) and archive (`<workspace.archive>/`) are not auto-created here. Surface them as a suggestion if a candidate clearly fits, but let the user place those deliberately.
