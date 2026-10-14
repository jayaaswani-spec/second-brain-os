---
status: active                # active | paused | done
created: YYYY-MM-DD
project-type: execution       # design | research | execution | content | meeting | ongoing
stakeholders: [<user.name>]
parent_hq: <area-name>        # bare name of the Area this project belongs to (its index.md lists it); 'none' is a smell, see root CLAUDE.md
kickoff_date: YYYY-MM-DD      # optional, if the project has a hard launch date
last_doc_audit: YYYY-MM-DD    # bump on every canonical-doc change in this project
---

# <project-slug>

<one-line summary — what is this project, why does it exist, what success looks like>

## Project-specific rules

- <project-only deltas from root CLAUDE.md + the parent Area's CLAUDE.md>
- <only list rules that diverge from root/Area; don't restate them>

## Authoritative docs (read these first)

| Doc | Location | Last verified |
|---|---|---|
| <Strategy / canonical artifact> | <relative path, no version suffix per root CLAUDE.md rule 1> | YYYY-MM-DD |

When you lock a new version of any doc in this table:
1. Edit the file in place (don't suffix-version)
2. Bump `Last verified` above
3. Bump `last_doc_audit` frontmatter
4. Move the predecessor to `_archive/` in the same commit

## Tactical (this sprint, lives here)

- <in-progress files/folders, drafts, raw data>
- <when a tactical artifact proves durable, list it under Authoritative docs above; it stays in this project and moves with it to the archive>

## Related (read on demand)

- Parent Area rules: [[<workspace.areas>/<area-name>/CLAUDE.md]]
- Sibling projects under the same Area: [[<slug>]], [[<slug>]]
- Stale/archived: <`_archive/` subdir or `<workspace.archive>/<old-slug>/` path>

---

*Keep under 80 lines. Decisions go in `memory.md`, not here. **Status = active means in flight**; if this project isn't active, it shouldn't be in `1-Projects/` (see root CLAUDE.md "Area / Active Project model").*
