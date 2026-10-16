# Knowledge work: one ticket

For one ticket whose deliverable is written for people: a doc, page, deck, diagram, plan, message. Read [SKILL.md](../SKILL.md) steps 1 and 2 first; this path ends at its step 3.

## 1. Gather the inputs

Read everything the ticket names under Key inputs or in its criteria: the sources, data, earlier versions, the model example. Use the project's own vocabulary (`glossary.md`) and respect its decisions. If an input is missing or inaccessible, stop and say what's needed; never fill a gap with invented facts, numbers or quotes. A fact you can't confirm goes in the artifact marked for someone to verify, never as settled.

Once the inputs are in hand, claim the ticket: set its status to `in-progress`. If you stop before this point, leave the status alone and say what's missing in a `## Delivery` note.

## 2. Build it with the skill that owns the medium

Hand the making to the skill that owns the medium, and follow its rules, including its own approval steps. Don't reinvent them here.

| Medium | Owning skill |
|---|---|
| Word, PowerPoint, Excel or PDF file | `docx`, `pptx`, `xlsx`, `pdf`, if installed |
| Email or Slack draft | the voice rules of the project's Area, or root `SOUL.md` and `USER.md` when the project has no Area (`parent_hq: none` or missing); drafts only, never sent |
| Research write-up | `/research` |
| A medium with its own installed skill (a design system, a diagram kit, a video kit) | that skill |
| Anything else | a file in the project folder named for what it is (`slack-section-rules.md`), per the Naming conventions in root CLAUDE.md |

Build to the acceptance criteria, not beyond them. The ticket's Out of scope list is binding. Illustrative examples are fine when clearly marked as examples; they never pose as real data. Work the ticket implies but doesn't ask for goes on the follow-ups list, not into the artifact.

## 3. Review it

Run the review that fits the artifact, and fix what it finds before closing:

- **Claims and numbers:** a fact-check pass. Every number, name, date and quote traces to a source you read.
- **Quality of the writing or argument:** score it against a rubric built from the criteria, ideally in a fresh subagent that didn't write it.

For a short artifact with objective criteria, a self-check against each criterion is enough. Scores from a panel are evidence, not a pass.

Then close the ticket with [SKILL.md](../SKILL.md) step 3. Sending, publishing and sharing always need <user.name>'s explicit go-ahead, whatever the ticket says.
