// resolve-project-root.mjs — runtime project-shape resolver for CCv4 hooks.
// Three resolvers + module-level parse cache. No external deps.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

// Per-process cache: repo_root -> { root, projects, areas, resources } | null
const configCache = new Map();

function walkUpForGit(start) {
  let cur = resolve(start);
  while (true) {
    if (existsSync(join(cur, ".git"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

// Find the canonical repo CLAUDE.md (outermost).
// Strategy: if a .git ancestor has a CLAUDE.md, that's the repo root.
// Otherwise fall back to the nearest CLAUDE.md (single-project / non-git case).
function walkUpForCLAUDE(start) {
  const gitRoot = walkUpForGit(start);
  if (gitRoot && existsSync(join(gitRoot, "CLAUDE.md"))) return gitRoot;
  let cur = resolve(start);
  while (true) {
    if (existsSync(join(cur, "CLAUDE.md"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function parseConfig(repoRoot) {
  if (configCache.has(repoRoot)) return configCache.get(repoRoot);
  let cfg = null;
  try {
    const md = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
    // Slice the "## Configuration" section up to the next "## " heading.
    const startIdx = md.search(/^##\s+Configuration\b/m);
    if (startIdx !== -1) {
      const tail = md.slice(startIdx);
      const nextIdx = tail.slice(2).search(/^##\s+/m); // skip the leading "##"
      const section = nextIdx === -1 ? tail : tail.slice(0, nextIdx + 2);
      const tokens = {};
      const re = /^- `([\w.]+)` = `([^`]+)`/gm;
      let m;
      while ((m = re.exec(section)) !== null) {
        tokens[m[1].trim()] = m[2].trim();
      }
      // An unfilled <placeholder> (a fork before /bootstrap) counts as unset.
      const val = (k, d) => (tokens[k] && !tokens[k].startsWith("<") ? tokens[k] : d);
      cfg = {
        root: val("workspace.root", "workspace"),
        projects: val("workspace.projects", "1-Projects"),
        areas: val("workspace.areas", "2-Areas"),
        resources: val("workspace.resources", "4-Resources"),
      };
    }
  } catch (err) {
    process.stderr.write(`[resolve-project-root] CLAUDE.md parse failed at ${repoRoot}: ${err.message}\n`);
  }
  configCache.set(repoRoot, cfg);
  return cfg;
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function resolveRepoRoot(cwd) {
  const fromClaude = walkUpForCLAUDE(cwd);
  if (fromClaude) return fromClaude;
  const fromGit = walkUpForGit(cwd);
  if (fromGit) return fromGit;
  return resolve(cwd);
}

export function resolveStateRoot(cwd) {
  const repoRoot = walkUpForCLAUDE(cwd);
  if (!repoRoot) return resolve(cwd);
  const cfg = parseConfig(repoRoot);
  if (cfg && cfg.root && (cfg.projects || cfg.areas)) {
    // Walk up from cwd looking for the multi-project shape.
    let cur = resolve(cwd);
    while (cur.startsWith(repoRoot) && cur !== repoRoot) {
      const rel = cur.slice(repoRoot.length + 1).split(sep);
      // <root>/<projects>/<slug> (a COD project's app/ resolves to the project)
      if (cfg.projects && rel.length >= 3 && rel[0] === cfg.root && rel[1] === cfg.projects) {
        return join(repoRoot, rel[0], rel[1], rel[2]);
      }
      // <root>/<areas>/<area>/apps/<name>
      if (cfg.areas && rel.length >= 5 && rel[0] === cfg.root && rel[1] === cfg.areas && rel[3] === "apps") {
        return join(repoRoot, rel[0], rel[1], rel[2], rel[3], rel[4]);
      }
      cur = dirname(cur);
    }
  }
  return repoRoot;
}

export function resolveHandoffRoot(cwd) {
  const repoRoot = walkUpForCLAUDE(cwd);
  if (!repoRoot) {
    return join(resolveStateRoot(cwd), "thoughts", "shared");
  }
  const cfg = parseConfig(repoRoot);
  if (cfg && cfg.root && cfg.resources && isDir(join(repoRoot, cfg.root))) {
    return join(repoRoot, cfg.root, cfg.resources);
  }
  return join(resolveStateRoot(cwd), "thoughts", "shared");
}
