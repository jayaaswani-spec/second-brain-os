#!/usr/bin/env node
// SessionStart hook — injects a unified inventory of active projects and
// Area-owned apps so the assistant knows what the user is currently working on
// without having to ask.
//
// Sources merged:
//   1. project-query.sh --tsv  → meta/planning projects in <workspace.root>/<workspace.projects>/
//      (a project with an `app/` folder has code still being built)
//   2. <workspace.root>/<workspace.areas>/*/apps/*/app.manifest.json → shipped, maintained apps
//
// Paths resolve from the Configuration block in root CLAUDE.md, so forks with
// renamed workspace folders work unchanged.
//
// Enrichment: reads each project's CLAUDE.md frontmatter for `parent_hq:` to
// surface which Area owns each project. Lets the assistant immediately see
// project → Area relationships.
//
// Fails silently if script missing or files unreadable — never blocks session start.
// Timeout: 5s (script typically <500ms).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const REPO_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readToken(md, key, fallback) {
  const m = md.match(new RegExp("`" + key.replace(/\./g, "\\.") + "` = `([^`]+)`"));
  const v = m ? m[1].trim() : "";
  // Unfilled template values (`<workspace.root>` before /bootstrap) fall back to defaults.
  return v && !v.startsWith("<") ? v : fallback;
}
let CONFIG_MD = "";
try { CONFIG_MD = readFileSync(join(REPO_ROOT, "CLAUDE.md"), "utf8"); } catch {}
const WS_ROOT = readToken(CONFIG_MD, "workspace.root", "workspace");
const WS_PROJECTS = readToken(CONFIG_MD, "workspace.projects", "1-Projects");
const WS_AREAS = readToken(CONFIG_MD, "workspace.areas", "2-Areas");
const WS_RESOURCES = readToken(CONFIG_MD, "workspace.resources", "4-Resources");
const PROJECT_QUERY_REL = `${WS_ROOT}/${WS_RESOURCES}/templates/project-query.sh`;
const PROJECT_QUERY = join(REPO_ROOT, PROJECT_QUERY_REL);
const PROJECTS_DIR = join(REPO_ROOT, WS_ROOT, WS_PROJECTS);
const AREAS_DIR = join(REPO_ROOT, WS_ROOT, WS_AREAS);

// ---------------------------------------------------------------------------
// Source 1: project-query.sh --tsv
// Output columns: slug \t status \t type \t created \t touched \t days \t flag
// ---------------------------------------------------------------------------
function readProjects() {
  if (!existsSync(PROJECT_QUERY)) return [];
  try {
    const out = execFileSync("bash", [PROJECT_QUERY, "--tsv"], {
      encoding: "utf8",
      timeout: 3000,
    });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [slug, status, type, created, touched, days, flag] = line.split("\t");
        return { slug, status, type, created, touched, days: Number(days) || 0, flag: flag || "" };
      })
      .filter((p) => p.status === "active");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Enrichment: parent_hq from each project's CLAUDE.md frontmatter
// ---------------------------------------------------------------------------
function readParentHq(slug) {
  const path = join(PROJECTS_DIR, slug, "CLAUDE.md");
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, "utf8");
    // Pull first frontmatter block
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const hqMatch = fmMatch[1].match(/^parent_hq:\s*(\S+)/m);
    if (!hqMatch) return null;
    // Canonical form is the bare Area slug; strip a path-form prefix defensively
    // so a stray `parent_hq: 2-Areas/foo` never renders as `2-Areas/2-Areas/foo`.
    return hqMatch[1].replace(new RegExp(`^${WS_AREAS}/`), "");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Source 2: Area-owned app manifests (plus app folders missing one)
// ---------------------------------------------------------------------------
function readAreaApps() {
  const apps = [];
  const unlisted = [];
  if (!existsSync(AREAS_DIR)) return { apps, unlisted };
  try {
    const areas = readdirSync(AREAS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    for (const area of areas) {
      const appsDir = join(AREAS_DIR, area.name, "apps");
      if (!existsSync(appsDir)) continue;
      const appDirs = readdirSync(appsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
      for (const appDir of appDirs) {
        // A `.git` file (not directory) marks a linked worktree of another app's
        // repo: a temporary second checkout, not a separate app.
        const gitPath = join(appsDir, appDir.name, ".git");
        if (existsSync(gitPath) && statSync(gitPath).isFile()) continue;
        const manifestPath = join(appsDir, appDir.name, "app.manifest.json");
        if (!existsSync(manifestPath)) {
          unlisted.push(`${WS_ROOT}/${WS_AREAS}/${area.name}/apps/${appDir.name}`);
          continue;
        }
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          // Surface any in-flight status; only hide explicitly parked/retired apps.
          if (["retired", "archived", "paused"].includes(manifest.status)) continue;
          apps.push({
            app: manifest.name || appDir.name,
            kind: manifest.kind || "app",
            ownerArea: manifest.owner_area || area.name,
            status: manifest.status,
            stack: Array.isArray(manifest.stack) ? manifest.stack.join(", ") : (manifest.stack || "—"),
            purpose: manifest.purpose || manifest.description || "—",
          });
        } catch {
          // A malformed manifest is omitted; app-level validation owns the error.
        }
      }
    }
  } catch {
    // Never block session start.
  }
  return { apps, unlisted };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const projects = readProjects();
const { apps: areaApps, unlisted } = readAreaApps();

if (projects.length === 0 && areaApps.length === 0) process.exit(0);

const lines = [];
lines.push("## Active projects + Area apps (auto-loaded at session start)");
lines.push("");
lines.push(
  `Source: \`project-query.sh\` (${projects.length}) + Area app manifests (${areaApps.length}) · refresh: \`bash ${PROJECT_QUERY_REL}\``
);
lines.push("");

if (projects.length) {
  lines.push(`### Meta/planning projects (${projects.length})`);
  lines.push("");
  lines.push("| slug | type | touched | days | parent Area | code |");
  lines.push("|---|---|---|---|---|---|");
  for (const p of projects) {
    const hq = readParentHq(p.slug);
    const hqCell = hq && hq !== "none" ? `\`${WS_AREAS}/${hq}\`` : "—";
    const daysCell = p.days > 7 ? `**${p.days}** ⚠️` : String(p.days);
    const codeCell = existsSync(join(PROJECTS_DIR, p.slug, "app")) ? "`app/`" : "—";
    lines.push(`| ${p.slug} | ${p.type} | ${p.touched} | ${daysCell} | ${hqCell} | ${codeCell} |`);
  }
  lines.push("");
}

if (areaApps.length) {
  lines.push(`### Area-owned apps (${areaApps.length})`);
  lines.push("");
  lines.push("| app | kind | owner Area | status | stack | purpose |");
  lines.push("|---|---|---|---|---|---|");
  for (const app of areaApps) {
    const purpose = app.purpose.length > 80 ? app.purpose.slice(0, 77) + "..." : app.purpose;
    lines.push(`| ${app.app} | ${app.kind} | \`${WS_AREAS}/${app.ownerArea}\` | ${app.status} | ${app.stack} | ${purpose} |`);
  }
  lines.push("");
}

if (unlisted.length) {
  lines.push(`### ⚠️ Area app folders without \`app.manifest.json\` (${unlisted.length})`);
  lines.push("");
  for (const d of unlisted) lines.push(`- \`${d}\``);
  lines.push("");
  lines.push("Add a manifest so the app shows up here, or run `/reindex app-audit`.");
  lines.push("");
}

lines.push(
  `**When user mentions a project — check this table first.** Projects nest under Areas via \`parent_hq:\` frontmatter; when the task is in an Area's domain, load that Area's \`${WS_ROOT}/${WS_AREAS}/<name>/\` CLAUDE.md + memory.md (root memory.md's routing map, if you keep one, says which).`
);

process.stdout.write(lines.join("\n") + "\n");
