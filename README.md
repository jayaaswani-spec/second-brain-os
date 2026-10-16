# Second-Brain OS

A personal AI workspace that runs on your own computer. You talk to it in plain language — it handles your morning briefing, your contacts, your projects, meeting prep, finding old notes, even design mockups.

```
You:  "morning, what's on my plate today?"
You:  "tell me about Sarah"
You:  "I just spoke with Sarah about the launch"
You:  "do I have any notes on Q3 planning?"
You:  "let's start a new project for the product launch"
```

No commands to memorize — it figures out which built-in workflow you need and runs it.

---

## What this is

It turns [Claude Code](https://claude.com/claude-code) into your personal **chief of staff** — or research companion, engineering co-pilot, whatever fits (you pick during setup). You set it up once, then just talk to it like a sharp assistant who knows your projects, your people, and your priorities.

It's not an app or a website. It's a folder on your Mac that Claude Code reads from. **Your data stays on your machine** — nothing leaves unless you explicitly ask it to send something (like posting a Slack message).

---

## Set it up (about 5 minutes)

You need a Mac, [Claude Code](https://claude.com/claude-code), `git` and [Node.js](https://nodejs.org) (the hooks run on it). Then:

```bash
git clone https://github.com/the-sid-dani/second-brain-os ~/Desktop/second-brain-os
cd ~/Desktop/second-brain-os
bash scripts/install-git-hooks.sh
claude
```

The hooks script installs nothing: it points git at the repo's own pre-commit hook, which scans commits for secrets, keeps every skill linked for Claude Code and Codex, and refreshes Codex's MCP config.

Inside the Claude session that opens, type:

```
/bootstrap
```

That's the whole setup. `/bootstrap` asks two questions — who you are, and what to call your assistant and how it should feel — and works out the rest from your machine. It fills in your files, never installs or commits anything, and at the end offers optional extras: learning your writing voice, bringing in past work, and adding work connectors.

> You need `git`, Node.js and Claude Code (or Codex). `INSTALL.md` covers anything else, but the everyday setup needs no separate installer.

When it finishes, try **"morning, what's on my plate today?"** or **"let's start a new project for X."**

---

## Talk to it

You don't memorize slash commands — just say what you want, and it picks the right workflow:

| You say | What happens |
|---|---|
| "morning, what's on my plate?" | Builds your daily briefing |
| "tell me about Alex" | Pulls up everything you know about a person |
| "I just talked to Alex about the launch" | Logs it to their profile |
| "do I have anything on prompt caching?" | Searches all your notes + projects |
| "let's start a new project for Q3 planning" | Sets up a new project |
| "what's gone stale?" | Reviews projects you've stopped touching |
| "make me a landing page for the launch" | Renders an HTML mockup (72+ brand styles) |
| "how does X work in this OS?" | Explains itself — reads its own docs live |

You *can* type `/briefing`, `/contact`, etc. directly if you prefer — both work.

---

## Where your stuff lives

`/bootstrap` creates one tidy folder structure (PARA — a simple convention from Tiago Forte's *Building a Second Brain*): a single root folder with five subfolders.

- **`0-Inbox/`** — quick capture, sort later
- **`1-Projects/`** — active work with an end in sight
- **`2-Areas/`** — ongoing areas of responsibility: just their rules and memory, while the work itself lives in projects (starts empty)
- **`4-Resources/`** — your reference library + everything the assistant writes for you (briefings, notes)
- **`5-Archive/`** — finished work (moved here, never deleted)

The assistant knows where everything goes — you mostly never think about it.

---

## Going further (optional)

- **Plan and build bigger things** — for work that outlasts one conversation (a plan, a launch, a curriculum, an app), run `/flow`. It picks the path: sharpen the idea by interview (`/grill-me`), write it up (`/to-spec`), split it into tickets (`/to-tickets`), then build one ticket per session (`/implement`). Specs and tickets are plain files in the project folder.
- **Power-user tooling** — AST-aware code reading and the heavier coding toolchain: run `./scripts/install.sh --with-coding` *before* `claude` (~15 min). Details in **`INSTALL.md`**.
- **Bring in your existing work** — already have projects from past Claude or Codex sessions (Cowork, the desktop Code tab, Claude Code or Codex)? Run `/migrate-work` (also offered at the end of `/bootstrap`). It reads those sessions without changing them, finds your real projects, and brings in the ones you approve; it **copies, never moves** your originals. It also offers what Claude and Codex already remember about you (your global instructions and memory files), sorted into your profile, your assistant's rules or the matching project, and writes only the lines you approve.
- **Back it up to GitHub** — the steps above clone to your Mac only. To keep a backup or sync across machines, **fork** the repo and clone your fork instead: `gh repo fork the-sid-dani/second-brain-os --clone`.
- **Connect your tools** — connect Google Workspace (Gmail, Calendar, Drive) with `/mcp`; your morning briefing works best with it. `/bootstrap` offers Slack, Atlassian and Figma at the end, and you authorize each with `/mcp`. Web search and image analysis work once their API keys are set (see `.env.example`); image analysis also needs its packages once: `npm install --prefix .claude/mcp-servers` (`./scripts/install.sh` does this).

---

## How it works (under the hood)

- **Skills** are the pre-built workflows — markdown files in `.agents/skills/`, each describing when it should be used. That's how "what's on my plate?" knows to run your briefing. `.claude/skills/` links to the same folders, so Claude Code, Codex and Cursor all share one set; add your own skill to `.agents/skills/<name>/SKILL.md` and the pre-commit hook links it.
- **`AGENTS.md` is `CLAUDE.md`** — one instruction file (a symlink), read by every agent tool.
- **Same tools in Codex** — `.codex/config.toml` carries the same default MCP servers as `.mcp.json`, regenerated on every commit once you've run `bash scripts/install-git-hooks.sh`. Codex loads it once you trust the folder. Slack isn't available in Codex yet: the generated config always leaves it commented out.
- **Hooks** are small guards that run automatically: they show your active projects at session start, ask before sending anything outside, keep folder placement tidy, and save a handoff before context compacts. Hooks run only in Claude Code; Codex gets the skills, instructions and tools, not the hooks.
- **It can explain itself** — ask *"how does X work in this OS?"* (or run `/os-guide`) anytime. It reads its own documentation live, so the answer is never out of date.
- **Deeper docs** — `INSTALL.md` for manual/advanced install, `CHANGELOG.md` for what's changed. Your identity and settings live in one `## Configuration` block in `CLAUDE.md`, which `/bootstrap` fills in.

---

That's the whole thing — clone, `/bootstrap`, talk to it.
