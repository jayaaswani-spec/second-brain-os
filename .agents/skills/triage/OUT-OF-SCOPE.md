# Out-of-Scope Records

When a request is rejected, the rejection is recorded so it serves two purposes:

1. **Institutional memory** — why a request was rejected, so the reasoning isn't lost when the ticket is closed
2. **Deduplication** — when a new request matches a prior rejection, triage surfaces the previous decision instead of re-litigating it

## Where the record lives

The record is a file in the project's `out-of-scope/` folder (or `<effort>/out-of-scope/` in a multi-effort project).

```
out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── weekly-video-cadence.md
```

One file per **concept**, not per ticket. Multiple tickets requesting the same thing are grouped under one file.

## Writing the closing comment or file

Write in a relaxed, readable style — more like a short design note than a database entry. Use paragraphs and examples to make the reasoning clear and useful to someone encountering it for the first time.

```markdown
# Dark Mode

This project does not support dark mode or user-facing theming.

## Why this is out of scope

The rendering pipeline assumes a single color palette resolved at build
time. Supporting multiple themes would need a theme provider around the
whole component tree, per-component theme-aware styles, and somewhere to
store each user's choice.

That's a significant architectural change that doesn't fit the project's
focus on content authoring. Theming is a concern for downstream consumers
who embed or redistribute the output.

## Prior requests

- ticket 04 — "Add dark mode support"
- ticket 11 — "Night theme for accessibility"
```

Name the files with a short kebab-case concept name (`dark-mode.md`, `weekly-video-cadence.md`) that someone browsing the folder recognizes without opening it.

### Writing the reason

The reason should be substantive — not "we don't want this" but why. Good reasons reference:

- Scope or philosophy ("This program focuses on X; Y is a downstream concern")
- Constraints ("Supporting this would require Y, which conflicts with Z")
- Strategic decisions ("We chose A instead of B because...")

The reason should be durable. Avoid temporary circumstances ("we're too busy right now") — those aren't rejections, they're deferrals. A deferral keeps its status with a triage note saying what would bring it back, not Won't fix.

## When to check

During triage (step 1, gather context), check past rejections:

- Read every file in the project's `out-of-scope/` folder.
- Check decisions already on record (`memory.md`, `decisions/`) that rule the request out.

Matching is by concept, not keyword — "night theme" matches `dark-mode.md`. If there's a match, surface it to the maintainer: "This is similar to `dark-mode.md` — we rejected this before because [reason]. Do you still feel the same way?"

The maintainer may:

- **Confirm** — the new ticket is added to the file's "Prior requests" list, then closed as Won't fix
- **Reconsider** — the old record gets updated (the file deleted), and the new ticket proceeds through normal triage
- **Disagree** — the requests are related but distinct; proceed with normal triage

## When to record

Only when a **Story or Task** is *rejected* as `wontfix`. Rejected bugs get a polite explanation and close without a record.

Do **not** record anything when a ticket is closed as `wontfix` because it's **already done**. That's finished work, not a rejection; recording it would poison the dedup checks with false rejections. Instead, the closing comment points to where the work already lives.

The flow:

1. Maintainer decides a request is out of scope
2. Check whether a matching record already exists
3. If yes: list the new ticket in its "Prior requests"
4. If no: write the reason in a new file
5. Close the ticket as Won't fix

## Changing a past decision

If the maintainer changes their mind about a previously rejected concept:

- Delete the `out-of-scope/` file.
- The new ticket that triggered the reconsideration proceeds through normal triage.
