---
name: to-spec
description: Turn the current conversation into a spec for code or knowledge work (an app feature, an annual plan, a curriculum, a video, a program launch) and save it as spec.md in the project folder. No interview, just synthesis of what's already been discussed. Use after a grilling session or when the user says "write the spec", "spec this up", or "turn this into a PRD".
---

This skill takes the current conversation and what you know about the project and produces a spec (you may know it as a PRD). Do NOT interview the user. Just synthesize what you already know.

The work can be code or knowledge work: a feature, a Google Doc such as an annual plan, a curriculum, a video, a program. The template below works for both.

## Process

1. **Resolve the project.** Read `docs/agents/project-context.md` and follow sections 1 and 2 to find the project and where its files go. If a skill earlier in this conversation already resolved it, reuse that answer.

2. **Read the project.** For code, explore the repo. For knowledge work, read the project folder: `CLAUDE.md`, `memory.md`, past versions of the artifact, any `glossary.md` and `decisions/`. Use the project's own vocabulary throughout the spec, and respect decisions already recorded.

3. **Agree how we'll know it's right.** Propose the highest single checkpoint that proves the work is done. This is the one confirmation the skill asks for, and it isn't an interview. If the conversation already settled the checkpoint, state it and move on without asking again. Prefer an existing checkpoint to a new one. The ideal number is one.
   - **Code:** the test seam. Test at the highest seam possible, and prefer existing seams.
   - **Knowledge work:** the acceptance point: who signs off, by when, and against what (last year's plan, the best past video, a rubric).

4. **Write the spec** using the template below, then save it as `spec.md` at the path from section 3 of the project-context doc (the project root, or `<effort>/spec.md` when the project already holds another effort). Add frontmatter `type: spec`, `status: active`, and `description` (one sentence), then append one line to the project's `memory.md` pointing at the new spec.

   Never write the spec to `.scratch/`.

<spec-template>

## Problem Statement

The problem, from the perspective of the person facing it (a user, a reader, a viewer, a stakeholder).

## Solution

The solution, from that same person's perspective.

## User Stories

A LONG, numbered list of user stories in the format:

1. As a <actor>, I want <something>, so that <benefit>

<user-story-examples>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
2. As a department head, I want my headcount ask captured in the planning doc's staffing section, so that finance can model it before the budget review
3. As a first-time viewer, I want the payoff shown in the first 30 seconds, so that I know the video is worth watching
</user-story-examples>

This list should be extremely extensive and cover every aspect of the work. Each story may later become a ticket.

## Decisions

The hard calls made while discussing the work. Include whichever apply:

- **Code:** the modules to build or change, their interfaces, architectural decisions, schema changes, API contracts, specific interactions, technical clarifications.
- **Knowledge work:** structure or outline, audience, format and channel, sources and data, owners and contributors, review cycle, dependencies on other people or teams.

Do NOT include file paths, code snippets, or the artifact's actual prose. They go stale quickly, and the spec says what and why, not the finished thing.

Exception: if a prototype produced a fragment that states a decision more precisely than prose can (a state machine, a schema, a type shape, a section outline, a beat sheet, a title shortlist), inline it in the relevant decision and note that it came from a prototype. Keep only the decision-rich parts.

## How We'll Know It's Right

The checkpoint agreed in step 3, and what makes a good check:

- **Code:** only test external behavior, not implementation details. List which modules get tested and the prior art (similar tests already in the codebase).
- **Knowledge work:** judge what the reader or viewer actually gets, not the process. Name who signs off, by when, and against what, plus the prior art (last year's version, the best past example).

## Out of Scope

What this spec deliberately does not cover.

## Further Notes

Anything else worth knowing.

</spec-template>

