---
name: to-tickets
description: Break a spec, plan, or the current conversation into tracer-bullet tickets, each declaring what blocks it, for code or knowledge work. Publishes them as ticket files in the project folder, each with a Blocked by line. Use after /to-spec, or when the user says "break this into tickets", "slice this up", or "make tickets for this".
---

# To Tickets

Break a spec, plan, or conversation into a set of **tickets**. Each ticket is a tracer-bullet vertical slice that declares the tickets that **block** it. The work can be code or knowledge work.

Resolve the project, its tracker and its paths from `docs/agents/project-context.md`. If a skill earlier in this conversation already resolved them, reuse that.

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user passes a reference as an argument, read its full body. The reference can be a spec path or a ticket file.

### 2. Explore (optional)

If you haven't already, look at the current state of the work.
- **Code:** explore the codebase.
- **Knowledge work:** read the project folder and any earlier version of the artifact.

Ticket titles and descriptions use the project's own vocabulary (`CONTEXT.md` or `glossary.md`) and respect its recorded decisions.

Look for prep work that makes everything after it easier. "Make the change easy, then make the easy change."
- **Code:** prefactoring.
- **Knowledge work:** gathering the data, getting access, building the doc skeleton, pulling last year's version.

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer. It's vertical, NOT a horizontal slice of one layer.
  - **Code:** schema, API, UI, tests.
  - **Knowledge work:** one section fully drafted, sourced and reviewed, never "write all the intros" then "add all the numbers".
- A completed slice is demoable or verifiable on its own. Someone can check or sign off on it alone.
- Each slice is sized to fit in a single fresh context window.
- Any prep work comes first, as its own ticket.

</vertical-slice-rules>

**Single artifacts with stages are the knowledge-work exception.** One video or one deck has stages that are horizontal by nature: research, script, record, edit, package. Stage tickets are fine, but each stage must end in something a person can review on its own: the brief approved, the script and title shortlist approved, the rough cut watched, the final passing its packaging check. A stage that ends in nothing reviewable gets merged into the next one.

Give each ticket its **blocking edges**, the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the code exception to vertical slicing.** This is mostly code. A **wide refactor** is one mechanical change, such as renaming a column or retyping a shared symbol, whose **blast radius** fans across the whole codebase. A single edit breaks thousands of call sites at once, so no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**:
1. **Expand:** add the new form beside the old, so nothing breaks.
2. **Migrate:** move the call sites over in batches sized by blast radius (per package, per directory). Each batch is its own ticket, blocked by the expand. CI stays green batch to batch because the old form still exists.
3. **Contract:** delete the old form once no caller remains, in a ticket blocked by every migrate batch.

When even the batches can't stay green alone, keep the sequence but let them share an integration branch. They all block a final integrate-and-verify ticket, and green is promised only there.

The same shape fits a knowledge-work change that touches hundreds of pages at once, like a rename across a whole doc space.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Type**: Story (new capability or deliverable) or Task (prep, setup, cleanup, a sign-off or approval stage, anything that isn't new capability)
- **Blocked by**: which other tickets (if any) must complete first
- **Status**: ready-for-agent or ready-for-human (rule below)
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct? Does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown. Nothing is published before approval.

### 5. Publish the tickets

Publish the approved tickets in dependency order (blockers first), so each ticket's blocking edges can reference real identifiers.

- Write one file per ticket at `tickets/NN-slug.md`, or `<effort>/tickets/NN-slug.md` in a multi-effort project, per section 3 of the project-context doc.
- Number after the highest `NN` already in that `tickets/` folder (`01` when it's empty). A wayfinder map's decision tickets may already be there, and a number must name only one ticket. One ticket per file, never a single combined file. Use the ticket template below.
- Status: `ready-for-agent` when an agent can finish the ticket alone. `ready-for-human` when finishing it needs a person to decide, approve or act: a judgment call, access an agent doesn't have, a sign-off, or approval of a persistent change (config, schedules, anything shared). If an agent can do most of the work but a person must approve the result, it's `ready-for-human`.
- Append one line to the project's `memory.md` pointing at the tickets.

`to-tickets` output is already triaged, so it never goes to Needs triage.

Do NOT close or modify the spec.

<local-ticket-template>

---
type: spec   # the workspace's OKF type list has no "ticket"; a ticket is a small spec
description: "Ticket NN: <Ticket title>"
---

# NN - <Ticket title>

**Type:** Story | Task
**Status:** ready-for-agent | ready-for-human
**Blocked by:** the numbers of the tickets that gate this one, or "None - can start immediately"
**Parent:** [[../spec]]

Goal: <who needs what, and why, in one sentence>   (Story)
What needs doing: <one line> / Why: <one line> / Done when: <one line>   (Task)

### What to build
The end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer list.

### Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Out of scope
- What this ticket deliberately doesn't do

### Notes
- Blocked by: <same as above>

</local-ticket-template>


The labelled lines (`Goal:`, `What needs doing:`, `Why:`, `Done when:`) each appear once, on one line, and never start any other line in the description. `### What to build` stays above `### Acceptance criteria`.

In the ticket body, avoid specific file paths, code snippets and finished prose; they go stale fast. Exception: if a prototype produced a fragment that states a decision more precisely than prose can (a state machine, a schema, a type shape, a section outline, a beat sheet), inline it and note that it came from a prototype. Keep only the decision-rich parts.
