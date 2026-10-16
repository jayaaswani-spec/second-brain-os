---
name: bootstrap
description: "First-run setup for a fresh fork of the second-brain-os in two questions: who you are, and your assistant's name and feel. Everything else is detected. Fills in the persona files and the Configuration block in CLAUDE.md; never installs or commits; refuses to re-run on a configured fork. Use right after cloning: \"/bootstrap\", \"I just cloned this\", \"first-time setup\", \"set up my assistant\", \"configure the assistant\"."
allowed-tools: Read Write Edit Bash AskUserQuestion Skill
---

# bootstrap

First-run setup. Two questions, then the fork is configured: persona files filled in, the Configuration block written, workspace folders in place. Extras (writing voice, bringing in existing work, work connectors) are offered at the end and never block the core.

**Why it's built this way.** Every fork user runs this once, before they've seen anything the OS can do. Each question spent here is a question not spent on real work, so the skill asks only what the machine can't know: who the person is and what they want their assistant to be. Everything else is detected (git config, system timezone and language, connected tools) or defaulted (neutral design, the `workspace` folder). Nothing is committed, so every write is undoable with git, and that's why the core writes don't need their own confirmation gates. The one exception is a file the person already edited by hand (T1).

Speak plainly: this is for knowledge workers, not engineers. Short sentences, no jargon, no wall of text.

## Invariants

- **T1 — Never overwrite a persona file the person edited.** `SOUL.md`, `IDENTITY.md`, `USER.md` and `README.md` are regenerated only while they still match their templates exactly (a fresh fork ships them that way). Anything else (hand edits, an earlier setup, a copy without git) counts as edited and is kept unless the person explicitly chooses otherwise. This is the only extra question the skill may ask, and only when such a file exists.
- **T2 — Never re-run on a configured fork.** A fork is configured when CLAUDE.md has a `setup_completed` line holding a real date (`YYYY-MM-DD`). The fresh template carries a `<YYYY-MM-DD>` placeholder there, which does not count.
- **T3 — Never commit.** No `git add`, no `git commit`. Show the commit command as text.
- **T4 — Never install anything.** Detection is read-only. Missing tools get a one-line hint.

## 1. Detect (read-only, no questions)

Run the bundled script from the repo root (`.claude/skills/` links to the same folders as `.agents/skills/`, so either path works):

```bash
python3 .claude/skills/bootstrap/scripts/apply.py detect
```

It prints JSON: `configured` (the setup date, or null), `git_name`, `git_email`, `company_guess` (from a non-webmail email domain), `github` (the machine's GitHub CLI login, kept only when its name or email matches git; otherwise it shows up as `github_unmatched` and `github` stays empty), `timezone`, `language`, and each persona file's state: `clean` (still its template), `edited` or `missing`.

- **`configured` has a date** → stop (T2): *"This fork is already set up (on <date>). To redo setup, delete the `setup_completed` line in CLAUDE.md and run /bootstrap again. To change one thing, just tell me what, and I'll edit that file."*
- Otherwise note, for yourself, which connectors are already live in this session: look for tool names containing gmail/workspace, slack, atlassian or figma. `.mcp.json` lists the built-in servers (gemini-vision, exa, firecrawl).

Only once you know the fork is fresh, open with two or three warm sentences: we're making this fork theirs, it's two quick questions, nothing gets committed. You don't have a name yet. (On a configured fork the stop message is the whole reply.)

## 2. Question 1 — about you (one AskUserQuestion call)

Ask up to four questions in a single call. Put detected values first as options, so most answers are one click; the person can always type their own through "Other".

1. **"What should I call you?"** Options: the first name and the full name from `git_name` when known.
2. **"What's your role?"** Options: a few common roles (e.g. Product manager, Engineer, Founder or executive, Designer).
3. **"What timezone are you in?"** Options: the detected `timezone` (recommended) plus one or two likely alternatives.
4. The fourth slot goes to what's still unknown: **"What email should I use?"** when `git_email` is empty (options: "I'll type it" and "Skip for now", which leaves it "—"); otherwise **"Where do you work?"** with `company_guess` (if any) and "Personal use" as options.

From the answers, derive the rest without asking: `user.name` (short name), `user.full_name`, `user.email` (git or answered), `user.company` (the answer to the company question, or "—" when that slot went to email; never derive it from an email the person typed, which is often a personal domain), `user.timezone`, `user.github` (`github` from detect, or "—"; never use `github_unmatched`, it belongs to someone else's sign-in), `user.language` (detected), `user.role_description` (role plus company, e.g. "Product manager at Acme"), `user.email_signature` ("Full Name | Role, Company").

## 3. Question 2 — your assistant (one AskUserQuestion call)

This is the moment the OS becomes theirs. Say so in a sentence: this is who they'll talk to every day. Two questions in one call:

1. **"What do you want to call your assistant?"** Options: Atlas, Echo, Sage, Juno (the person can type any name). Never default to a name from the original repo.
2. **"How should it feel to talk to them?"** Each option sets the vibe, and you derive the role and emoji from it:

| Option | `assistant.role` | `assistant.emoji` |
|---|---|---|
| Sharp and direct, like a chief of staff | Chief of Staff | 🎯 |
| Warm and encouraging, like a thinking partner | Thinking Partner | 🌿 |
| Curious and thorough, like a research companion | Research Companion | 🔭 |
| Calm and organized, like a steady operator | Operations Partner | 🗺️ |

For a typed vibe, write it as the vibe line and pick a fitting short role and emoji yourself.

Then show the card, without a gate:

```
Meet your assistant:

  Name:  <assistant.name>  <assistant.emoji>
  Role:  <assistant.role>
  Vibe:  <assistant.vibe>
```

## 4. Write (no questions on a fresh fork)

**Edited persona files first (T1).** If `detect` showed any of `SOUL.md`, `IDENTITY.md`, `USER.md` or `README.md` as `edited`, ask about those files only, in one AskUserQuestion:
- **Fill in my names, keep my edits** (recommended) → `--fill <file>`: their text stays, the placeholders around it get filled.
- **Leave it exactly as it is** → no flag. Names stay as placeholders in that file.
- **Replace it with the new version** → `--force <file>`.
- **Save the new version beside mine** → `--suggest <file>` writes `<file>.bootstrap-suggested`.

If they want to see the differences first, show `diff <templates_dir>/<NAME>-template.md <file>` and ask again. On a fresh fork nothing is edited, so this never comes up.

Save the values as JSON in your scratchpad (or a temp file outside the repo), with the dotted keys listed in the script's header (`workspace.root` is `workspace`), then:

```bash
python3 .claude/skills/bootstrap/scripts/apply.py write --values <values.json> [--fill <file> ...] [--force <file> ...] [--suggest <file> ...]
```

An edited file with no flag is left exactly as it is. The script fills the persona files from their templates (names, workspace paths and today's date, dropping the template's "e.g." hints), writes the Configuration block in CLAUDE.md (the 12 identity tokens and `setup_completed` with today's date), puts real names into CLAUDE.md's prose, creates any missing workspace folders, and prints a report of what it wrote, filled in place, kept untouched and suggested.

Leave `DESIGN.md` as it is: the fork ships with the neutral default. Mention `/use-design` in the closing.

Append a short line to `memory/<YYYY-MM-DD>.md` (create the folder if needed): what was configured, and nothing private beyond the names given.

## 5. Check

```bash
python3 .claude/skills/bootstrap/scripts/apply.py verify [--kept <file> ...]
```

Pass `--kept` for any file the person chose to leave exactly as it is. It fails if a Configuration value is still a placeholder, `setup_completed` isn't a date, or a persona file still holds an identity, workspace or date token; a kept file is reported instead. On failure, say plainly what's wrong and fix it before closing.

## 6. Close, then offer the extras

```
You're set up.

Your assistant: <assistant.name> <assistant.emoji> (<assistant.role>)
Tools:          <live connectors>; built in: web search and image analysis (need their API keys)
Design:         neutral default (switch anytime with /use-design)

Files written: <`written` and `filled_in_place` from the report>. <Kept as you had it: <files>, if any.> Nothing is committed. When you're ready:
  git add -A && git commit -m "Set up <assistant.name> for <user.name>"
```

If Gmail or Calendar tools aren't live, add one line: connect Google Workspace with `/mcp`, since the morning briefing reads mail and calendar. If USER.md still has `<TBD …>` sections (team, Slack channels, Drive folders), add one line saying they're there to fill in whenever the person wants. If `detect` reported a `github_unmatched` login, add one line: GitHub was left blank because the GitHub CLI here is signed in as someone else; they can add theirs to the Configuration block later.

Then one optional AskUserQuestion (multi-select) — these are offers, not setup:
- **Teach me your writing voice** → Optional A below.
- **Bring in my existing work** → invoke `/migrate-work` (Skill tool); it does its own consent and approval.
- **Add work connectors (Slack, Atlassian, Figma)** — include only the ones not already live. Run `python3 .claude/skills/bootstrap/scripts/apply.py add-connectors <names>` (e.g. `slack atlassian figma`): it copies each server from `.mcp.json` `_notes.opt_in_<name>` into `mcpServers` and refreshes Codex's config. Tell the person to authorize each with `/mcp` (in Codex: `codex mcp login <name>`), and that Slack works in Claude Code only: the generated Codex config always leaves it commented out, because Slack's server needs Claude Code's pre-registered app.
- **Not now** → nothing to run.

Whatever they pick, finish with three things to try: *"what's on my plate?"* (`/briefing`), `/flow` for anything bigger than one conversation, and `/migrate-work` whenever they want to bring in past work. Point to `/os-guide` for how the OS works.

## Optional A: learn your writing voice

So the assistant drafts like them. Never part of setup; can run any time.

1. **Ask before reading anything.** Only the person's own sent messages, only from tools that are live: *"To learn your voice I can read only messages you sent from Gmail or Slack, or you can paste a sample."* Options: read my sent Gmail / read my sent Slack / I'll paste a sample / skip.
2. **Gmail:** ~10-20 recent sent messages. **Slack:** look up the person's own handle first, then ~10-20 of their messages from the last 30 days. **Paste:** 1-3 paragraphs, or a file path (read up to 200 lines). **Skip:** write a short TODO starter to `memory/writing-style.md` and stop.
3. Say what was read (count and date range). Build the profile only from that text, never invented phrases: voice, structure, word choices, emoji habits, things they never do, signature.
4. Show the profile, then: save it to `memory/writing-style.md` / add another sample / edit a section. If a profile already exists, ask before replacing it.

## Boundaries

- Two questions on a fresh fork. Extra questions only for T1 (edited persona files) and the optional extras at the end.
- Never commit (T3), never install (T4), never re-run on a configured fork (T2), never overwrite an edited persona file silently (T1).
- Never touch code repos (an Area's `apps/`, a project's `app/`).
- Write to `memory/` only today's daily log and, in Optional A, `writing-style.md`.
- No web search: setup is local.
- Never read anyone's messages without consent in this run, and never anyone's but the person's own.
- Never invent detected values. Unknown stays "—" in the Configuration block and can be edited later.
