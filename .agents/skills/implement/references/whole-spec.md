# Whole spec: every ticket at once

For building every ticket in a spec in one run, or a named set of tickets the user wants built together. Read [SKILL.md](../SKILL.md) steps 1 and 2 first; each ticket ends at its step 3.

The goal is the entire spec built: code on a single **integration branch**, written work in its own homes, every ticket resolved the way the tracker closes work. If the spec has no tickets yet, stop and suggest `/to-tickets`.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them (each ticket's `**Blocked by:**` line). This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Before starting

- **Sort the tickets.** Each ticket is code or knowledge work, by the table in [SKILL.md](../SKILL.md) step 2.
  - **Code tickets** build in parallel, each in its own worktree, merged onto the integration branch.
  - **Knowledge-work tickets** build one at a time with [knowledge-work.md](knowledge-work.md), in this session or one subagent at a time, never in parallel: written work for one effort needs one voice, and most of it ends at a person.
  - A knowledge-work ticket counts as landed for its dependents once its artifact passes every objective criterion; a pending sign-off doesn't hold up code that only needs the artifact.
- **Person-owned tickets** (a credential from someone, an admin step, a pilot with real users) aren't built: show them in the graph as waiting on a person. An open one holds up only the tickets it blocks; everything else proceeds.
- **The repo** for code is the project's app repo, found as in [code.md](code.md). Whole-spec code works in app repos only. For work on this workspace's own harness, build code tickets one at a time; the workspace checkout is shared by many sessions.
- **Seams.** Take them from the spec's "How We'll Know It's Right" section or the tickets. There's no interactive seam step once the run starts, so if neither names them, propose them and confirm once before step 3.
- **Shared surfaces.** If two code tickets on the same frontier will touch one shared surface (a config registry, a message catalogue, a shared type), either add a blocking edge so they run one after the other, or fix the exact names each one adds in the exploration notes.
- Show the user the graph (each ticket, code or knowledge work, its blockers, which run first) and the integration branch name, and start only on approval.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents (the session's scratchpad). This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch off the default branch, named for the spec (`spec-usage-digest`), and check it out in its own **integration worktree** outside the repo, so the main checkout stays where it was. Note the commit it starts from; that's the review's start point.

4. Use **implementer subagents** to implement each code ticket on the frontier, each in its own worktree (created outside the repo) on its own branch named for the ticket. Set the ticket's status to `in-progress` as its implementer starts. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket at the agreed seams;
   - runs the repo's checks for what it touched, and the full test suite before reporting;
   - commits only its ticket's files;
   - merges the integration branch tip into its own branch before reporting done.

   A ticket whose tests rely on untracked material (gitignored fixtures, local databases, credentials) can silently skip in a worktree. Build that one in the main checkout instead.

   Knowledge-work tickets on the frontier run alongside, one at a time, through [knowledge-work.md](knowledge-work.md).

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**, working in the integration worktree. Run mergers one at a time. The first ticket of a wave usually fast-forwards; a sibling that ran in parallel needs a real merge, so the merger resolves it and reruns the full test suite before reporting.

6. If this changes the **frontier** of available tickets, kick off more work on the new tickets. This allows for maximum concurrency. Compute the frontier from what has merged into the integration branch and which written artifacts have landed, not from the tracker: the tracker only learns a blocker is done at close-out.

7. Once all code tickets are complete, call the Skill tool with `code-review` on the integration branch, against the start point from step 3. Fix every in-scope issue it raises in a single **implementer subagent**, on its own branch merged in like any ticket. Findings that need the user's decision, or that predate this run, go on the follow-ups list instead. Then run focused checks for the fixed findings and stop; don't start a second broad review.

8. Run every check the repo's CI runs on the integration branch, plus one real run of the app, script or service. Then close every ticket with [SKILL.md](../SKILL.md) step 3. Report the integration branch, each ticket and its state, and where each written artifact lives.

9. Clean up every worktree, the implementers' and the integration one. Keep the branches.

Append one line to the project's `memory.md` with the spec, the integration branch and the tickets closed.
