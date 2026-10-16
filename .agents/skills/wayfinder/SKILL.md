---
name: wayfinder
description: Plan a huge chunk of work, more than one agent session can hold, as a shared map of decision tickets, then resolve them one at a time until the way to the destination is clear. Works for code and knowledge work (a platform migration, an annual plan, a program launch, a course). The map is map.md plus decision ticket files in the project folder. Use when the user says "wayfind this", "chart this", "map this out", "this is too big for one session", or wants to work the next ticket on an existing map.
---

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map** on the project's tracker, then works its **decision tickets** — questions whose resolution is a decision, not slices of a build to execute — one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a spec to hand off and iterate on, a decision to lock before planning starts, or a change made in place like a data-structure migration. The map is domain-agnostic — engineering work, course content, whatever fits the shape.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its **Notes** — carrying execution into the map itself — but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket has a **name** — its title (a ticket file's heading). In everything the human reads — narration, the map's Decisions-so-far — refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` is illegible; names read at a glance. The id and URL don't vanish — a name wraps its link — but they ride *inside* the name, never stand in for it.

## The Map

The map is a single item on the project's tracker — the canonical artifact. Its tickets hang off it. Where each piece lives is in [Where the map lives](#where-the-map-lives).

Here the tracker is the project folder, so read the tracker words below this way: the map is `map.md`; a child issue or ticket is a file in `tickets/`; an open ticket is one whose `**Status:**` is not `resolved` or `wontfix`, found by reading those files rather than by a query; a ticket is identified by its number; and posting a resolution comment and closing the ticket means writing its `## Answer` section and setting `**Status:** resolved`.

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

Resolve the project and its tracker from `docs/agents/project-context.md` before charting. If a skill earlier in this conversation already resolved them, reuse that.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed — they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like — the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](link): <one-line gist of the answer>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket hangs off the map; its tracker key or ticket number is its identity. Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Each ticket carries its type — one of Research, Prototype, Grilling, Task (see [Ticket Types](#ticket-types)).

A session **claims** a ticket **first**, before any work, so concurrent sessions skip it. The claim is moving it to **In Progress**; an open ticket that isn't In Progress is unclaimed.

Blocking is recorded on the ticket itself, in its `**Blocked by:**` line, so the frontier can be read straight off the ticket files without opening the map. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed tickets — the edge of the known.

The answer isn't part of the body — it's recorded on resolution (see [Work through the map](#work-through-the-map)). Assets created while resolving a ticket are linked from the ticket, not pasted in.

## Ticket Types

Every ticket is either **HITL** — human in the loop, worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it (a grilling agent that answers its own questions has broken this).

- **Research** (AFK): Reading documentation, third-party APIs, data exports, or local resources like knowledge bases to surface a fact a decision waits on. Resolved by a `/research` **subagent**, which saves its findings to the project's `research/<topic>.md`. Use when the fact isn't already in the conversation and takes real reading to get.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to — an outline, a rough take, a stub, or UI/logic code via the /prototype skill. Links the prototype as an asset. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation via the /grilling and /domain-modeling skills, one question at a time. The default case.
- **Task** (HITL or AFK): Manual work that must happen before a *decision* can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done. Signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. This is the one type that *does* rather than decides — and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts (credentials location, new URLs, row counts) later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war** — the dim view of decisions and investigations you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets — one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. It's the undiscovered frontier _toward_ the destination — everything here is in scope, just not sharp enough to ticket. Write as loosely or as fully as the view allows; it doubles as a signpost for collaborators reading where the effort is headed.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now.

- **Ticket when** the question is already sharp — even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces: it's coarser than a ticket, and one patch may graduate into several tickets, or none, once the frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope (the next section).

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope** — it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section on the map: work you've consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates — the frontier stops at the destination — so it returns only if the destination is redrawn, and then as a fresh effort, not a resumption.

Ruling something out of scope is a scoping act, not a step on the route. Work ruled out while charting, before any ticket exists, is just a line in the section; it needs no ticket. When a ticket that already exists turns out to sit past the destination — mis-scoped in while charting, or exposed by a resolution — **close it** as Won't fix (a closed ticket is unambiguously off the frontier) and leave one line in the **Out of scope** section: the gist plus why it's out of scope, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked — a scope boundary isn't a step on it.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session** — with the exception of research tickets.

### Chart the map

User invokes with a loose idea.

If the destination and frontier were already settled earlier in this conversation, restate them and go to step 3.

1. **Name the destination.** Run a `/grilling` and `/domain-modeling` session to pin down what this map is finding its way to — the spec, decision, or change. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way to the destination is already clear, the whole journey small enough for one session — you don't need a map. Stop and ask the user how they'd like to proceed.
3. **Show the draft.** Present the map body and the list of tickets you can specify now (name, type, HITL or AFK, blocked by). Create nothing until the user approves; iterate until they do.
4. **Create the map**: Destination and Notes filled in, Decisions-so-far empty, the fog sketched into **Not yet specified**.
5. **Create the tickets** under the map — then wire blocking edges in a **second pass** (tickets need numbers before they can reference each other). Wiring sorts them into the frontier and the blocked; everything you can't yet specify stays in the fog — the **Not yet specified** section.
6. **Fire the research subagents.** For each Research ticket you just created, spin up a `/research` subagent to resolve it in parallel. Each subagent claims its ticket, saves its findings to the project's `research/<topic>.md`, records the resolution (an `## Answer` section in the ticket file that also links the findings file), closes the ticket, and appends its own line to Decisions so far. Don't wait for them.
7. Stop — charting is one session's work; it hand-resolves nothing.

### Work through the map

User invokes with a map (a project's `map.md`). A ticket is **optional** — without one, you pick the next decision, not the user.

1. Load the **map** — the low-res view, not every ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it**: move it to In Progress before any work.
3. Resolve it — **zoom as needed**: fetch the full body of any related or closed ticket on demand; invoke the skills the `## Notes` block names. If in doubt, use `/grilling` and `/domain-modeling`.
4. Record the resolution: post the answer as a **resolution comment**, **close** the ticket (Done), and **append a context pointer** to the map's Decisions-so-far.
5. Add newly-surfaced tickets (create-then-wire, after the user approves them); graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified** so it lives only as its new ticket. If only part of a patch graduates, reword the patch to what's still fog. Fire a `/research` subagent for each new Research ticket, as in charting. If the answer reveals a ticket — this one or another — sits beyond the destination, **rule it out of scope** rather than resolving it on the route. If the decision invalidates other parts of the map, update or delete those tickets.

The user may run unblocked tickets in parallel, so expect other sessions to be editing the tracker concurrently.

## Where the map lives

### Files in the project folder

Paths come from section 3 of the project-context doc (the project root, or `<effort>/` in a multi-effort project).

- **Map:** `map.md`, frontmatter `type: spec`, `status: active`, `description: "Wayfinder map: <destination>"`. The body is the map body above.
- **Tickets:** `tickets/NN-slug.md`, numbered after the highest number already in `tickets/` (`01` when it's empty), blockers first where known. A ticket added later takes the next free number, whatever it blocks. When the map clears and `/to-tickets` writes build tickets into the same folder, they continue this sequence, so a number always names one ticket. These are decision tickets, not build tickets, so they skip `to-tickets`' What to build and Acceptance criteria. Each has `**Type:**` (Research, Prototype, Grilling or Task), `**Status:**` (`ready-for-human`, `ready-for-agent`, `in-progress`, `resolved` or `wontfix`), `**Blocked by:**`, `**Parent:** [[../map]]`, then `## Question`. The resolution goes under an `## Answer` heading in the same file.
- **Names:** link a ticket as `[[tickets/03-sign-in-flow|Sign-in flow]]`.
- Append one line to the project's `memory.md` when a map is charted.
