---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS (`$TMPDIR` on macOS) - not the current workspace - as `handoff-YYYY-MM-DD-<topic>.md`, and tell the user the full path.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

The handoff is a temporary bridge, not the record. Before writing it, make sure anything durable from this conversation (decisions, findings, open commitments) already lives in its real home: the project's `memory.md`, the ticket, the spec or the daily memory note. File it there first if it doesn't, then point the handoff at it.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information (personal phone numbers, home addresses, personal emails; colleagues' names are fine).

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
