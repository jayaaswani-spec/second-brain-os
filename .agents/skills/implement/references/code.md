# Code: one ticket

For one ticket whose deliverable runs. Read [SKILL.md](../SKILL.md) steps 1 and 2 first; this path ends at its step 3.

## 1. Seams

Take the seams from the spec's "How We'll Know It's Right" section or the ticket. If neither names them, propose them and confirm once with the user before writing any test. Seams named in the spec or ticket count as agreed, so `/tdd` doesn't ask again.

## 2. Find the repo and the branch

- **The repo** is the project's app repo: the one whose `app.manifest.json` names the project, a COD project's `app/`, or the repo the ticket or spec names. Code for an app never goes into the workspace repo's `<workspace.root>/` tree.
- **The branch.** In an app repo, create a branch named for the ticket (`ticket-03-oauth-callback`) off the default branch (the remote's default, or `main` when there's no remote). If a blocker's work hasn't merged yet, branch off the blocker's branch and say so.
- **The workspace harness is the exception.** Work on this workspace's own `.claude/`, `scripts/` or `docs/` commits to the current branch, because many sessions share this one checkout and switching branches would move them all. Note `git rev-parse HEAD` before the first commit; that's the start point for the review.
- **Commit only this ticket's files,** with `git commit --only -- <paths>`, so changes another session already staged stay out of your commit. Check the commit's file list right after.

Claim the ticket: set its status to `in-progress`.

## 3. Build

Use `/tdd` where possible, at the agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Before finishing, run every check the repo's CI runs (lint, typecheck, build, schema and eval checks, not only the tests). With no CI, run what the repo has: its tests, its pre-commit hooks, a syntax check. Then run the real thing once: load the running app for a change a user sees, or invoke the script or hook for real. Tests and builds miss runtime errors. A CI check you can't run locally is reported as not run, never as a pass.

## 4. Commit, then review

Commit your work to the ticket's branch.

A written part of a code ticket (a README section, a methodology note, a message) gets the knowledge-work review for its kind: a fact-check for claims and numbers, drafts-only for messages.

Then use `/code-review` against the commit the branch started from. Fix what it finds within the ticket's scope in a follow-up commit and rerun the affected checks. Problems that were already there, or that sit outside the ticket, go on the follow-ups list.

Then close the ticket with [SKILL.md](../SKILL.md) step 3.
