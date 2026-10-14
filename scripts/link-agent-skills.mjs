#!/usr/bin/env node
// link-agent-skills.mjs — keep .claude/skills/ linked to .agents/skills/.
//
// Skills live once, in .agents/skills/<name>/ (the folder Codex, Cursor and
// other AGENTS.md-aware agents read). Claude Code reads .claude/skills/, so
// each skill gets a relative symlink there: .claude/skills/<name> ->
// ../../.agents/skills/<name>.
//
// Add a skill by creating .agents/skills/<name>/SKILL.md, then run
//   node scripts/link-agent-skills.mjs
// (the pre-commit hook runs it for you). Real folders you put directly in
// .claude/skills/ are left alone. Links whose skill is gone are removed.
//
// Flags: --check (exit 1 if anything is out of sync, change nothing)

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const agentsDir = path.join(root, ".agents", "skills");
const claudeDir = path.join(root, ".claude", "skills");
const check = process.argv.includes("--check");

if (!fs.existsSync(agentsDir)) {
  console.error("link-agent-skills: no .agents/skills/ here — run from the repo root.");
  process.exit(1);
}
fs.mkdirSync(claudeDir, { recursive: true });

const skills = fs
  .readdirSync(agentsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(agentsDir, e.name, "SKILL.md")))
  .map((e) => e.name);

const changes = [];

for (const name of skills) {
  const linkPath = path.join(claudeDir, name);
  const target = path.join("..", "..", ".agents", "skills", name);
  let stat = null;
  try { stat = fs.lstatSync(linkPath); } catch {}
  if (stat && !stat.isSymbolicLink()) {
    console.warn(`link-agent-skills: .claude/skills/${name} is a real folder — left alone (move it into .agents/skills/ to share it).`);
    continue;
  }
  if (stat && fs.readlinkSync(linkPath) === target) continue;
  changes.push(`link ${name}`);
  if (!check) {
    if (stat) fs.unlinkSync(linkPath);
    fs.symlinkSync(target, linkPath);
  }
}

for (const entry of fs.readdirSync(claudeDir, { withFileTypes: true })) {
  if (!entry.isSymbolicLink()) continue;
  const linkPath = path.join(claudeDir, entry.name);
  const dest = fs.readlinkSync(linkPath);
  if (dest.startsWith(path.join("..", "..", ".agents", "skills")) && !skills.includes(entry.name)) {
    changes.push(`unlink ${entry.name}`);
    if (!check) fs.unlinkSync(linkPath);
  }
}

if (check && changes.length) {
  console.error(`link-agent-skills: out of sync — ${changes.join(", ")}`);
  process.exit(1);
}
if (changes.length) console.log(`link-agent-skills: ${changes.join(", ")}`);
