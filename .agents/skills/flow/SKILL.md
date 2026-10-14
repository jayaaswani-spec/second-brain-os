---
name: flow
description: Pick the right path through the planning and build skills for the piece of work in front of you, code or knowledge work. Small change means just do it; an idea to sharpen means grilling; ready to build means to-spec, to-tickets, then implement; raw requests mean triage; a huge foggy effort means wayfinder. Use for "/flow", "which skill should I use for this", "how should we tackle this", "where do I start with X", "how do we go from here", "what's next with this idea", "is this a spec or just a ticket". Not for questions about how the OS itself works (paths, config, tools, what a skill does in general); that's /os-guide.
---

# Flow

You don't remember every skill, so ask.

A **flow** is a path through the skills. Most paths run along one **main flow**, and a few **on-ramps** merge onto it. Everything else is standalone, or a vocabulary layer that runs underneath.

Every flow skill resolves the project and its paths from `docs/agents/project-context.md`; specs, tickets and maps live as files in the project folder. Resolve it first; each later skill reuses it, and a `/handoff` file carries it into the next session.

When invoked, read the situation, name the path in two or three lines (which skills, in what order, and why), and offer to start the first one. Don't run the whole chain unasked.

## First: is it small?

If the change fits in this session and nothing about it is unclear (a typo, a one-line config change, a short email, a quick edit to an existing doc), **just do it**. No spec, no tickets. The flow is for work that needs thinking or spans sessions.

## The main flow: idea → done

The route most work travels. You have an idea and want it built, whether it's an app feature, an annual plan, a curriculum, a set of docs or a program launch.

1. **Sharpen the idea by interview.**
   - **`/grill-with-docs`** when the project should keep its terms and decisions: `CONTEXT.md` and ADRs in an app repo, `glossary.md` and `decisions/` in a knowledge project (an annual plan, a curriculum, a program).
   - **`/grill-me`** when nothing should be recorded: a decision you're weighing, a draft plan, an idea. Both run the same `/grilling` primitive.
2. **Branch: can you settle every question in conversation?** If a question needs something concrete to react to (a UI, a state model, a rough outline, a first draft of one section), detour through **`/prototype`**, bridged by **`/handoff`** in both directions:
   - **`/handoff`** out, then open a fresh session against that file,
   - **`/prototype`** to answer the question with something throwaway,
   - **`/handoff`** back what you learned, and reference it from the original idea thread.
3. **Branch: is this a multi-session build?** Decide after grilling, not before. It's multi-session when building takes more than one sitting, or when other people contribute, review or sign off along the way.
   - **Yes** → **`/to-spec`** (the thread becomes `spec.md` in the project), then **`/to-tickets`** to split it into tracer-bullet tickets (`tickets/NN-slug.md`), each declaring its **blocking edges** on a `**Blocked by:**` line. Then build one ticket per session, **clearing context between each one**.
   - **No** → build it right here, in the same context window: `/implement` builds straight from the conversation, code or knowledge work.
4. **Build** → **`/implement`**, which routes itself:
   - **Code** (something that runs): drives **`/tdd`** at the agreed seams, commits on the ticket's branch in the app repo, runs **`/code-review`** on the commit, and closes the ticket with evidence.
   - **Knowledge work** (a doc, page, deck, diagram, plan, message): hands the making to the skill that owns the medium, reviews it, and closes the ticket with evidence.
   - **The whole spec at once**: every code ticket on the frontier builds in parallel in its own worktree, merged onto one integration branch, with the written tickets done one at a time alongside. Use it when the tickets are solid and you'd rather review the result than each ticket.
   - Reach for **`/tdd`** on its own for one behaviour test-first with no spec, and **`/code-review`** on its own to review a branch against a fixed point.


### Context hygiene

Keep steps 1–3 in **one unbroken context window** — don't compact or clear until after `/to-tickets` — so the grilling, spec and tickets all build on the same thinking. Each build ticket then starts fresh, working from the ticket.

The limit on this is the **smart zone**: the window (~120k tokens on state-of-the-art models) within which the model still reasons sharply. If a session reaches ~100k tokens before `/to-tickets`, don't push on degraded — `/handoff` and continue in a fresh thread. Don't `/compact` here; a summary loses the thinking the spec and tickets build on.

## On-ramps

A starting situation that generates work, then merges onto the main flow.

- **Requests and bugs piling up** → **`/triage`**. It moves tickets through the triage statuses (Needs triage, Needs info, Ready for Agent, Ready for Human, Won't fix) and writes agent-ready briefs, which `/implement` later picks up.

  Triage is only for tickets **you didn't create**: help desk intake, requests from other people, anything that arrives raw. Tickets `/to-tickets` produced are already triaged, so **don't triage them**.

- **Something's broken** → **`/diagnosing-bugs`**. A bug that arrives as a help desk ticket goes through `/triage` first; diagnose it once it's been triaged. For the hard ones: the bug that resists a first glance, the intermittent flake, the regression between two known-good states. It won't theorise until it has a **tight feedback loop** — one command that already goes red on *this* bug — then fixes with a regression test.

- **A huge, foggy effort, too big for one session** → **`/wayfinder`**, the most demanding flow here. When the way from here to the destination isn't visible yet (a platform migration, a company-wide rollout, next year's AI program), it charts a **shared map** of **decision tickets** and resolves them one at a time — producing **decisions, not deliverables** — until the way is clear. Where grilling sharpens an idea you can hold in one session, wayfinder is for the idea you can't; save it for exactly that, never a well-scoped piece of work. The test: if you can name the destination and one grilling session could settle the open questions, it's the main flow (most annual plans are). Wayfinder is for when you can't yet name the destination, or the questions need research, other people or experiments before they can be answered.

  When the map clears, **it hands off, it doesn't build**: merge onto the main flow at **`/to-spec`**, which collapses the map's decisions into a buildable plan, then `/to-tickets` and build as usual. Locally, the build tickets go in the map's `tickets/` folder and continue its numbering rather than restarting at `01`. Go straight to building from a map only when the effort turned out genuinely small.

## Vocabulary underneath

Model-invoked references that run *beneath* the other skills. Reach for them directly when the **words**, not the process, are the problem; or let the skills above pull them in.

- **`/domain-modeling`** — sharpen the project's language: challenge a fuzzy term, resolve an overloaded word, record a hard-to-reverse decision. It keeps `CONTEXT.md` (code) or `glossary.md` (knowledge work) clean.
- **`/codebase-design`** — the deep-module vocabulary (module, interface, depth, seam, adapter) for designing a module's *shape*. `/tdd` speaks it.

## Crossing sessions

- **`/handoff`** — when a thread is full or you need to branch off (for example into a `/prototype` session), this compacts the conversation into a markdown file. You don't continue in place — you **open a new session and reference that file**. Use it when you want a **fresh session** but need the **current conversation preserved**.
- **`/compact`** (built-in) — stay in the **same conversation**, letting the earlier turns be summarized. Use it at **intentional breaks between phases**. Don't compact mid-phase. `/handoff` forks; `/compact` continues.

## Standalone

Off the main flow entirely.

- **`/prototype`** — something small and throwaway that answers one design question. Keep the answer, delete the artifact.
- **`/research`** — delegate reading to a **background agent**: it investigates a question against **primary sources** and saves a cited file to the project's `research/` folder, or to Resources when no project owns it. Research feeds the thinking at the grilling step; it doesn't replace it.
