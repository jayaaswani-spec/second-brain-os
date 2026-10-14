---
name: implement
description: Build the work in a ticket or spec and close it against its acceptance criteria with evidence, for code or knowledge work. Routes itself - one code ticket (test-first, ticket branch in the app repo, review after commit), one knowledge-work ticket (a doc, page, deck, diagram, plan or draft, made with the skill that owns the medium), or every ticket in a spec at once (code in parallel worktrees on one integration branch). Needs a ticket, a spec, or a plan settled in this conversation; a one-off doc, deck or email with none of those goes straight to the skill for that medium. Use for "implement ticket 03", "deliver ticket 05", "do ticket 04", "write the doc for this ticket", "code up the frontier ticket", "fix the failing tests in ticket 07", "implement the whole spec", "build all the tickets for this spec", "land this spec".
---

Implement the work described by the user in the spec or tickets.

Resolve the project, its tracker and its paths from `docs/agents/project-context.md`. If a skill earlier in this conversation already resolved them, reuse that. When the work is written for people, load the rules of the Area the project belongs to (its `parent_hq`); they carry the voice and format rules. If the project has no Area (`parent_hq: none` or missing), use the voice in root `SOUL.md` and `USER.md`.

Asking for `/implement` on a ticket or spec is the go-ahead to build it inside its project and repo, commit on the ticket's branch, and update the tickets' status and delivery notes and the project's `memory.md`. It is not a go-ahead to push, merge, deploy, send, publish or change anything shared.

## 1. Read the work

- **Find the ticket exactly.** Resolve a ticket number through the project's tracker, never against whatever numbered list is in view. State its title back before starting. If the plan lives only in this conversation, say so and build from that.
- Read the whole ticket (description, acceptance criteria, comments; a triage agent brief is the contract), then the spec it hangs off for the audience, decisions and acceptance point.
- **Blockers.** If a blocker is still open, stop and say which one. A blocker that's closed but whose answer says the thing it was meant to produce hasn't arrived counts as open.
- **Checkable criteria.** If a criterion can't be checked as written, say which and propose a checkable version before building. Where the ticket and the spec disagree on form, the ticket wins; it's the narrower contract.

## 2. Route

Pick one path and read its reference before doing anything else:

| The request | Path |
|---|---|
| One ticket whose deliverable runs: an app, service, MCP server, script, hook, dashboard, site or prototype. A small written part (a README section, a changelog line) doesn't change that | [references/code.md](references/code.md) |
| One ticket whose deliverable is written for people: a doc, page, deck, diagram, plan, research write-up, video, email or Slack draft | [references/knowledge-work.md](references/knowledge-work.md) |
| Every ticket in a spec at once ("the whole spec", "all the tickets", "land this spec") | [references/whole-spec.md](references/whole-spec.md) |

A plan that lives only in this conversation with no tickets is one piece of work: route it as code or knowledge work, and close it out in chat (step 3's checklist, no tracker updates; a `memory.md` line only if a project owns it). If the request names several tickets without saying "all at once", ask whether to build them one by one or together; together means the whole-spec path over just those tickets.

A ticket whose work is a person's action (getting a credential, an admin setup, a pilot with real users) isn't built by an agent: prepare what helps (a checklist, a draft request), post it, and leave the ticket at Ready for Human.

## 3. Close the ticket

Every path ends here, once per ticket.

Post a checklist with one line per acceptance criterion: **pass**, **fail** or **needs a person**, plus the evidence (the test that proves it, the check output, the commit, a link, a section name, a quoted line). A criterion that rests on facts still marked for verification is not a pass. Name where the work lives (repo and branch, or the artifact's location). It goes under `## Delivery` in the ticket file, with the criteria boxes ticked; the rest of the ticket stays as filed.

Then:
- **Every criterion passes objectively:** set the ticket's status to `resolved`. A ticket closes on its own criteria; the spec's acceptance point is judged on the whole effort, by whoever the spec names. For code, merging the branch stays with <user.name>; the checklist says it's waiting.
- **Any criterion needs a person** (a sign-off, a deploy, an admin action, a manual test on a real account, anything sent or published, approval of a shared change): set its status to `ready-for-human` and say exactly what's left.
- **Any criterion fails:** keep it `in-progress` and say what's missing.


Pushing, opening a PR, merging and deploying need <user.name>'s go-ahead unless the ticket or <user.name> already said to. Sending and publishing always need <user.name>'s explicit go-ahead in this conversation, whatever the ticket says.

List any follow-ups for <user.name>: work the ticket implies but didn't ask for, problems that were already there. Append one line to the project's `memory.md` with the ticket and where the work lives; if the project has no `memory.md`, say so instead of creating one.

Do not close or modify the spec. One ticket per session on the code and knowledge-work paths; clear context before the next one.
