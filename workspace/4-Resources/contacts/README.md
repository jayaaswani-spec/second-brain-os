# Contacts

Per-person reference directory. One file per person, slug-named (`jordan-chen.md`, `alex-rivera.md`). No date prefix — people aren't time-bounded.

## Why this exists

For <assistant.name> to track commitments obsessively (per SOUL.md), it needs to know:
- **Who** the user talks to (identity, role, relationship)
- **What** was discussed and promised (interaction log + open commitments)
- **When** they last interacted (recency for "you haven't talked in a while" surfacing)
- **Context** about them (background, expertise, recurring topics)

Without this, `/briefing`'s "Open commitments by person" section is shallow and meeting prep can't surface "what did you promise X last time."

## Why Resources, not memory/

Contacts are **reference material** (entity-keyed lookup) — same shape as `meetings/`, `reference/`, `research/`, `design-systems/`. They're NOT "stuff <assistant.name> learns about <user.name>" — that's `memory/` (daily logs, writing-style.md, learned-preferences.md).

The journal of any specific interaction lands in `memory/YYYY-MM-DD.md`. The durable per-person directory lives here.

## Per-file schema

```yaml
---
name: Jordan Chen                     # required — preferred / everyday name
legal_name: Jordan E. Chen            # optional — when preferred ≠ legal
email: jordan@example.com             # required (use 'unknown' if not yet known)
role: Director of Engineering         # required (use 'unknown' if not yet known)
team: Platform Infrastructure         # required — canonical team name (may differ from directory)
department: Engineering               # optional — directory's Department field
division: Technology                  # optional — directory's Division field
company: Acme Corp                    # required (or 'unknown' for personal contacts)
relationship: peer; senior counterpart on shared platform projects   # required — free-form descriptor
status: active                        # required — active | inactive | external | personal
first_logged: 2026-05-01              # required — when contact file created
last_interaction: 2026-05-08          # required — date of last logged interaction (use 'unknown' if not yet known)
reports_to: Sam Patel                 # optional — direct manager per directory
recurring_cadence: weekly 1:1         # optional — natural-language cadence
location: San Francisco, CA           # optional — primary work location
work_phone: '5555550100'              # optional — directory's Work Phone
tags: [direct-collaborator, platform, senior-peer]   # optional
slack_handle: '@jordan'               # optional
timezone: America/Los_Angeles         # optional
linkedin: linkedin.com/in/jordanchen  # optional
---

## About
Free-form context — background, expertise, things <user.name> wants surfaced when this name comes up. Update over time.

**Capture texture, not just facts**. The highest-value About content is judgment a directory can never hold — work these angles in as they become known, as prose or mini-subsections for Tier-1 relationships:
- *What they believe* — first principles, hills they die on
- *What they're building / what motivates them* — current focus, career arc
- *Hobby horses* — topics they return to obsessively
- *Trajectory* — ascending, plateauing, pivoting?
A LinkedIn-shaped About is a wasted About. Never overwrite <user.name>'s own written assessments with directory or API boilerplate.

## Recurring topics
- Platform architecture
- Roadmap planning
- ...

## Open commitments

### To <name> (<user.name> owes)
- [ ] 2026-05-04 — share architecture doc — by 2026-05-10

### From <name> (owes <user.name>)
- [ ] 2026-05-04 — review platform PR — by 2026-05-12

## Interaction log
### 2026-05-04 — weekly sync
- Topic: Platform architecture, roadmap alignment
- Decisions: agreed on per-service auth pattern
- <user.name> promised: share architecture doc
- Jordan promised: PR review by next Friday

### YYYY-MM-DD — <topic>
- ...
```

## How <assistant.name> uses these

**Readers:**
- **`/contact <name>`** — fuzzy-match → profile, last interaction, open commitments.
- **`/briefing`** — "Open commitments by person" section (read-only; filters `status: personal`).
- **`/find`** — indexes contacts/ as part of Resources.
- **`pre-slack-draft-contact-check` hook** — injects a contact's file before a Slack draft/send to them. Only fires for Slack user IDs listed in `.claude/.slack-id-map.json`; add an entry when a contact gets a file.

**Writers** (all follow the Refresh procedure below):
- **Contacts refresh** — follows the Refresh procedure below. Run it on demand, or put it on a schedule.
- **`/contact-log <name>`** — manual, when <user.name> narrates an interaction.

New profiles are never auto-created. The refresh lists unknown people in the daily log for <user.name> to approve; creating a file is a separate, directory-checked edit.

## Refresh procedure (canonical)

1. **Window.** Read `.refreshed-through` in this folder (one `YYYY-MM-DD` line). The window is the day after that date through yesterday. Missing file → yesterday only. Empty window → stop.
2. **Gather** substantive interactions in the window from: calendar (meetings held with a contact as attendee, ≤15 people), meeting notes (Gemini summaries first, then Tactiq; folder IDs in USER.md "Google Drive"), Slack DMs, group DMs and threads between <user.name> and the contact, two-way work email, and the local daily logs + project `memory.md` files. Skip `status: personal` contacts for work sources.
3. **Substance bar.** Would <user.name> want this recalled before the next 1:1 with them? Skip pleasantries, CC-only mail, broadcasts, automated notifications, and passing mentions.
4. **Write, append-only.** For each contact with a finding:
   - Add a `### YYYY-MM-DD — <topic>` entry directly under `## Interaction log` (newest first), bullets for decisions and who promised what, and a `Source:` bullet citing the permalink, email subject, doc name or file path. Link other known contacts as `[[contacts/<slug>]]`.
   - Skip if an entry for the same date and topic already exists (from `/contact-log`).
   - Add new commitments under `## Open commitments` in the dated `- [ ] YYYY-MM-DD — what — by YYYY-MM-DD` shape; check off (`- [x]`) ones the window shows resolved.
   - Bump `last_interaction` only if the new date is later.
   - Never touch About, Recurring topics, or other frontmatter.
5. **Record.** Overwrite `.refreshed-through` with yesterday's date only after all writes succeed. Append a `## Contacts refresh` block to today's `memory/YYYY-MM-DD.md`: contacts updated, commitments added or resolved, new people seen (name + context, for <user.name> to approve), and any signal source that was unavailable. Never fabricate: an unavailable source is reported as a gap, not skipped silently.

## WikiLinks

Daily logs and project notes reference contacts as `[[contacts/<slug>]]` so `/find [[contacts/<slug>]]` lists every note that mentions a person. Example in a daily log: "Met with [[contacts/jordan-chen]] re: platform architecture."

## Maintenance

- **Every contact needs `first_logged` + `last_interaction` minimum** in frontmatter; the refresh and `/briefing` rely on them.
- **Append to the Interaction log; never rewrite.** Same rule as project memory.md.
- **Commitments carry dates and expire**. Every Open-commitments line keeps the `- [ ] YYYY-MM-DD — what — by YYYY-MM-DD` shape: origin date AND due date. When a commitment resolves, check it off (`- [x]`) and leave it in place (history). When one goes stale — past due with no follow-up for 30+ days — don't silently delete: mark it `- [~] ... — STALE YYYY-MM-DD` so `/briefing` stops surfacing it but the record shows it was dropped, not done. A commitments section full of undated or zombie lines is how "track commitments obsessively" quietly dies.
- **Meeting entity propagation**. When a meeting note or transcript is processed (briefing prep, meeting-prep, manual notes) and a contact with a file made a commitment or decision in it, that contact's file gets the touch — via `/contact-log` — in the same working session, not "later". A meeting that updates only `meetings/` and not the people in it is a half-filed meeting.
- **Status `inactive`** when someone leaves the company or stops being relevant — keeps the file for historical record but `/briefing` and the daily refresh skip them.
- **Status `external`** for people outside <user.company> in a business context (vendors, candidates, peer-company contacts, partners).
- **Status `personal`** for non-business contacts: friends, family, side-project collaborators, anyone outside the work scope. `/briefing` and other work-context skills should filter `status: personal` out by default. **Privacy note:** personal contact data lives in a git-tracked file — capture only what's appropriate to commit.

## Source of truth

If your organization has an authoritative directory (Workspace directory, HR records, employee export), use it for `role`, `department`, `division`, `location`, `work_phone`, `reports_to`. Directory data may have stale team names — the canonical `team` field stays in the contact file; the directory's `department` is captured separately.
