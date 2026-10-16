---
name: archive-project
description: "Archive a finished project whole: move it from <workspace.projects>/ to <workspace.archive>/, flip status to done, append an optional retro to its memory.md, and regenerate the parent Area's index. Use when the user is done with a project, even without saying \"archive\": \"archive the X project\", \"I'm done with X\", \"wrap up X\", \"X is finished\", \"shelve X for now\". Always use this instead of moving the folder by hand."
allowed-tools: Read Edit Bash AskUserQuestion
---

# archive-project

Closes the loop on a project: appends a retrospective to `memory.md` (optional but encouraged), flips `status: active → done` in `CLAUDE.md`'s YAML frontmatter, moves the whole folder to `<workspace.root>/<workspace.archive>/<slug>/`, then regenerates the parent Area's `index.md`. The project moves WHOLE — there is no artifact-promotion step (thin-Areas model: Areas hold rules + memory + a generated index only; archived projects stay discoverable via the Area index).

**Before you begin: read the Configuration section in root CLAUDE.md.** Path tokens like `<workspace.projects>` resolve to whatever's defined there — don't hardcode.

## Why this exists

`/prune-projects` filters on the `status` field. A project that gets moved by hand without the status flip looks `active` forever — <assistant.name> can't tell it's archived. This skill makes the right thing the easy thing: one command, frontmatter and filesystem stay consistent, optional retro captures the "what did we learn" without forcing it.

The retro matters because the project's `memory.md` is the only durable record of the decision history. Once a project is archived, nobody re-reads its memory unless something breaks — so a one-paragraph "what worked / what didn't" entry at the end is high-leverage. But forcing it would make the user skip the skill entirely, which is worse. Make it cheap to opt in.

## When to use

Trigger phrases (not exhaustive):
- "archive the X project"
- "I'm done with X"
- "wrap up X"
- "move X to archive"
- "X is finished — close it out"
- "shelve X for now"
- "clean up the X work"

Do NOT trigger for:
- A shipped Area app under `<workspace.area_apps>/` — to retire one, move the repo to `<workspace.archive>/<slug>/app/` beside a short `CLAUDE.md` note (what it was, remote, why retired). A COD project's own `app/` needs nothing special: it moves with the project folder.
- Pausing a project — that's a status change to `paused`, not an archive. Edit the frontmatter directly.
- Deleting — never. Archive is move, not delete.

## Process

The skill is interactive. The interactive prompts (`AskUserQuestion`) only fire when the user runs the skill themselves; subagent runs invoke with the answer pre-extracted from the prompt.

### Step 1: Identify the project

`AskUserQuestion` is multi-choice — useful here for picking from a list, not for free text. So:

1. **Check the invocation context first.** If the user named the project in the trigger prompt (e.g., "archive the all-hands-prep project"), extract the slug. Match the substring against `ls <workspace.root>/<workspace.projects>/` — if exactly one folder contains that substring, use it and skip to Step 2 with a confirmation in Step 4. If multiple match, ask to disambiguate.
2. **Otherwise list the projects via `AskUserQuestion`.** Run `ls <workspace.root>/<workspace.projects>/`, present each slug as a choice, plus an "Other" option for typed input. This handles the "I want to archive *something*, show me my options" case.

If the projects folder is empty, error: *"No active projects. Nothing to archive."*

### Step 2: Validate the project is migratable

```bash
proj="<workspace.root>/<workspace.projects>/<slug>"
[ -d "$proj" ] || error "Project doesn't exist."
[ -f "$proj/CLAUDE.md" ] || error "No CLAUDE.md. Run /inbox-process and choose scaffold-in-place for this folder first, or `mv` it manually."
[ -d "<workspace.root>/<workspace.archive>/<slug>" ] && error "Already archived."
```

If any check fails, abort with the specific error message. Don't auto-recover — the user should decide on unmigrated projects (do they want to backfill scaffolding, or just hand-move?).

### Step 3: Ask about the retro

Use `AskUserQuestion` with two choices:
- **yes** — *"Yes, I'll write a one-paragraph retro"*
- **skip** — *"Skip the retro, just move it"*

If `yes`: prompt in plain chat for the retro text. *"What's the retro? One paragraph — what worked, what didn't, what should be different next time."* Wait for the next user message. Don't use `AskUserQuestion` for the text itself (free-form prose doesn't fit multi-choice).

If `skip`: proceed to Step 4 with no retro.

### Step 4: Confirm before mutating

Print the plan and ask for explicit confirmation via `AskUserQuestion` (yes/no), substituting the resolved paths from root CLAUDE.md:

```
Will archive: <workspace.root>/<workspace.projects>/<slug>/
  → <workspace.root>/<workspace.archive>/<slug>/
  Status flip: active → done
  Retro: <YES, one paragraph | SKIP>

Proceed?
```

This is the last bail-out. The user should be able to back out cleanly here.

### Step 5: Append retro (if requested)

Append to `<proj>/memory.md`:

```markdown

---

## <YYYY-MM-DD> — Retro on archive

<retro text from Step 3>
```

Use `>>` redirection or the Edit tool. Keep the `---` separator before the heading — that's the convention from `<templates.project_memory>`. Today's date.

### Step 6: Flip the status field

Edit `<proj>/CLAUDE.md`'s YAML frontmatter. The line looks like:

```
status: active        # active | paused | done
```

Change `active` → `done`, **preserving the inline comment**. The simplest robust pattern is the Edit tool with `old_string: "status: active        # active | paused | done"` and `new_string: "status: done          # active | paused | done"`. If the comment spacing differs, use sed: `sed -i.bak 's/^status: active/status: done/' <proj>/CLAUDE.md && rm <proj>/CLAUDE.md.bak`.

Do not touch any other frontmatter field. Do not strip the comment.

### Step 7: Move the folder

```bash
mv <workspace.root>/<workspace.projects>/<slug>/ <workspace.root>/<workspace.archive>/<slug>/
```

`mv` not `cp+rm` — atomic, preserves mtimes (which `/prune-projects` cares about for archived-recency stats later).

### Step 8: Regenerate the parent Area's `index.md` (if `parent_hq` set)

Read the project's CLAUDE.md frontmatter for `parent_hq:`. If set (and not `none`), regenerate that Area's machine-generated `index.md` so the archived project stays linked from the Area (indexes cover `parent_hq`-matched projects in both `<workspace.projects>` and `<workspace.archive>`):

```bash
bash .claude/skills/reindex/reindex.sh "<workspace.root>/<workspace.areas>/<parent_hq>"
```

(The okf-index-regen PostToolUse hook covers live edits, but a folder `mv` doesn't fire it — run `/reindex` on the Area explicitly.) Never hand-edit the `index.md`.

Skip if `parent_hq: none` or missing.

### Step 9: Append an Area audit line to today's daily memory log (if `parent_hq` set)

Before printing the confirm block, if `parent_hq:` is set (and not `none`), append one line to `memory/<YYYY-MM-DD>.md` to leave an audit trail in the daily log:

```markdown

## <YYYY-MM-DD> — Archived <slug> (parent_hq: <name>)

Project moved to archive WHOLE (no promotion — thin-Areas model). Area index regenerated; archived project linked from `<workspace.areas>/<name>/index.md`. Project memory.md preserved at archive location.
```

Use `>>` append or Edit (file is append-only per CLAUDE.md rule — never rewrite). `parent_hq:` values are bare Area slugs (e.g. `operations`), so write the bare slug here too. This gives a discovery hook later (<assistant.name> can grep memory/ for "Archived ... parent_hq: <name>" to surface what's been wrapped up under each Area).

Skip if `parent_hq: none` or missing. A standalone project has no Area index pointing at it, so no audit line is needed.

### Step 10: Confirm

Print:

```
✅ Archived: <slug>
  From: <workspace.root>/<workspace.projects>/<slug>/
  To:   <workspace.root>/<workspace.archive>/<slug>/
  Status: active → done
  Parent Area: <area-name | none>
  Area index: <regenerated | skipped (no parent_hq)>
  Retro: <appended | skipped>
  Area audit line: <added to memory/YYYY-MM-DD.md | skipped>
```

Stop. Do not auto-commit, do not touch any index beyond the parent Area's `index.md` regenerated in Step 8 (indexes are generated, never hand-edited; a COD project's ignored `app/` simply moves with the folder), do not propose a follow-up project.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `mv: rename failed` | Target already exists in archive | Step 2 should have caught this; if it didn't, name collision happened mid-flow. Abort and tell the user. |
| Status field not changed | Inline comment had different spacing | Fall back to sed: `sed -i.bak 's/^status: active/status: done/' && rm *.bak` |
| Memory.md missing | Pre-existing project lacked one (shouldn't happen with `/new-project` outputs) | Create it with just the retro entry. Or skip retro and move on. |
| User says "wrap up X" but X doesn't exist | Typo or stale memory | Show `ls <workspace.projects>/` as a list and ask to pick the right one |
| `AskUserQuestion` not available (subagent context) | Worker subagents lack the tool | Extract answers from invocation prompt. If retro text is mentioned ("with a retro about Y"), append Y. If "skip retro" or no retro mentioned, skip. |
| Configuration values missing | Root CLAUDE.md doesn't have a Configuration section, or this is a fresh fork | Tell the user to run `/bootstrap` first (two questions) or fill in the Configuration section by hand. Don't proceed with hardcoded fallbacks. |

## Output format

Final message after success:

```
✅ Archived: <slug>
  From: <workspace.root>/<workspace.projects>/<slug>/
  To:   <workspace.root>/<workspace.archive>/<slug>/
  Status: active → done
  Retro: <appended | skipped>
```

Use this format consistently — `/prune-projects` and any future audit skill will look for "Archived:" lines in transcripts.
