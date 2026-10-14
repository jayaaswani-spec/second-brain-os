---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the project's research folder, or in Resources when no project owns it. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it in the right home, resolved from `docs/agents/project-context.md`:
   - **Inside a project:** save to `research/<topic>.md` in the project (or `<effort>/research/` in a multi-effort project).
   - **No project:** save to `<workspace.root>/<workspace.resources>/research/YYYY-MM-<topic>-research/findings.md`, the `/save-resource` convention.
   - **Answers a ticket** (for example, a wayfinder research ticket): also record the resolution in the ticket file's `## Answer` section, with a 3-line gist and a link to the findings file.
   - Never save to `.scratch/`.
4. Cite the URL it actually read for each claim (the source repo or plain-text RFC is fine), and name the topic file in kebab-case after the question.

When the agent finishes, check its file exists, then tell the user where it was saved and the two or three findings that matter most.
