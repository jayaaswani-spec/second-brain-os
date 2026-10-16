# Project context for the flow skills

Every flow skill (flow, grill-with-docs, domain-modeling, to-spec, to-tickets, triage, wayfinder, implement, research, code-review) reads this file first. It answers three questions: **which project am I in, which tracker does it use, and where do files go.** Work out the answers once per conversation. After that, every later skill in the same conversation reuses them without asking again.

`.scratch/` is never an output location. It holds throwaway working files only.

## 1. Find the project

Try these in order. The first one that matches wins.

1. **Already resolved.** A skill earlier in this conversation settled the project. Reuse it.
2. **Working directory.** The current directory is inside `<workspace.root>/<workspace.projects>/<slug>/`. That's the project.
3. **App repo.** The current directory is inside an app repo (`<workspace.root>/<workspace.areas>/<area>/apps/<app>/`, or a COD project's `app/`), and its `app.manifest.json` has a `project` field. That field names the project. The field is optional and `/new-project` doesn't write it, so it is often missing: then go to step 5, keep the candidates whose `parent_hq` matches the manifest's `owner_area` at the top, and afterwards offer to add the field.
4. **Named.** The request or the skill's arguments name a project or a slug. Match it against the folders in `<workspace.root>/<workspace.projects>/`.
5. **Topic match.** Run `bash <workspace.root>/<workspace.resources>/templates/project-query.sh --tsv` and pick the best match for the topic. **Confirm it with <user.name>** (AskUserQuestion, with the 2-3 closest projects as options) before writing anything.
6. **Nothing fits.** Offer `/new-project`. Never guess a folder, and never fall back to `.scratch/`.

## 2. Pick the tracker

Every project tracks its work as **local files** in the project folder: specs, tickets, wayfinder maps and rejected ideas all live at the paths in section 3. There is no external tracker.

## 3. Where files go

### Paths inside the project

| What | Path inside the project |
|---|---|
| Spec | `spec.md` |
| Tickets | `tickets/NN-slug.md`, numbered in dependency order (blockers first), starting after the highest number already in `tickets/` (`01` when it's empty). Wayfinder decision tickets and `to-tickets` build tickets can share one `tickets/` folder, so they share one number sequence and a number always names one ticket |
| Wayfinder map | `map.md` |
| Rejected ideas | `out-of-scope/<concept>.md` |
| Research | `research/<topic>.md` |
| Glossary | `glossary.md` |
| Hard-to-reverse decisions | `decisions/001-slug.md` |

**One effort or several.**
- A project holding one effort keeps these files at the root.
- If the root already holds files for a *different* effort, the new effort gets its own concept folder: `<effort>/spec.md`, `<effort>/tickets/`, and so on.
- Never move an existing effort's files into a folder without asking.
- The folder name is the effort's short kebab-case name, per the Naming conventions in root CLAUDE.md (folders are named for their concept and created when content arrives).

**Local ticket body.** Each build ticket (from `to-tickets`) follows the ticket template in that skill. Wayfinder's decision tickets use the Question shape in the wayfinder skill instead.
- A `# NN - <title>` heading, then the `**Type:**` (Story or Task), `**Status:**`, `**Blocked by:**` and `**Parent:**` lines.
- One labelled line set: `Goal:` for a Story; `What needs doing:`, `Why:` and `Done when:` for a Task. Each label appears once, on one line, and never starts any other line in the ticket.
- Then `### What to build`, `### Acceptance criteria` (as `- [ ]` checkboxes), `### Out of scope` and `### Notes`, in that order. Extra headings go above `### Acceptance criteria`.
- `**Status:**` holds a triage role (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), `in-progress` once someone claims it, or `resolved`.
- `**Blocked by:**` lists ticket numbers, or `None - can start immediately`.

## 4. Domain docs for code

Code keeps its glossary and decision records in the app repo: `CONTEXT.md` and `docs/adr/` at the app repo's root. Knowledge projects use `glossary.md` and `decisions/` from section 3.
