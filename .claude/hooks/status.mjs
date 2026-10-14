#!/usr/bin/env node
/**
 * StatusLine command — context % and git info.
 *
 * Shows: 145K 72% | main U:6
 * Critical: ! 160K 80% | main U:6
 */
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { resolveRepoRoot } from './lib/resolve-project-root.mjs';

function getContextInfo(data) {
  const ctx = data.context_window || {};
  const usage = ctx.current_usage || {};
  const total = (usage.input_tokens || 0)
    + (usage.cache_read_input_tokens || 0)
    + (usage.cache_creation_input_tokens || 0)
    + 45000; // system overhead estimate
  const size = ctx.context_window_size || 200000;
  const pct = Math.min(100, Math.floor(total * 100 / size));
  return { pct, display: `${(total / 1000).toFixed(1)}K` };
}

function getGitInfo(cwd) {
  try {
    // Single call: branch + staged/unstaged/untracked
    const out = execSync('git --no-optional-locks status --porcelain -b', {
      cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 5000,
    });
    const lines = out.split('\n');
    let branch = '';
    if (lines[0] && lines[0].startsWith('## ')) {
      branch = lines[0].slice(3).split('...')[0];
      if (branch === 'No commits yet on master' || branch === 'No commits yet on main') branch = '(init)';
      else if (branch.length > 12) branch = branch.slice(0, 10) + '..';
    }
    let staged = 0, unstaged = 0, added = 0;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l || l.length < 2) continue;
      const x = l[0], y = l[1];
      if (x === '?' && y === '?') { added++; continue; }
      if (x !== ' ' && x !== '?') staged++;
      if (y !== ' ' && y !== '?') unstaged++;
    }
    const counts = [];
    if (staged) counts.push(`S:${staged}`);
    if (unstaged) counts.push(`U:${unstaged}`);
    if (added) counts.push(`A:${added}`);
    if (counts.length) return `${branch} \x1b[33m${counts.join(' ')}\x1b[0m`;
    return `\x1b[32m${branch}\x1b[0m`;
  } catch { return ''; }
}

function main() {
  let data = {};
  try { data = JSON.parse(readFileSync(0, 'utf-8')); } catch {}

  let cwd = (data.workspace || {}).current_dir || process.env.CLAUDE_PROJECT_DIR || '';
  if (!cwd) cwd = resolveRepoRoot(process.cwd());
  else if (!existsSync(join(cwd, '.git'))) cwd = resolveRepoRoot(cwd);

  const { pct, display } = getContextInfo(data);
  const git = getGitInfo(cwd);
  let ctx;
  if (pct >= 80) ctx = `\x1b[31m! ${display} ${pct}%\x1b[0m`;
  else if (pct >= 60) ctx = `\x1b[33m${display} ${pct}%\x1b[0m`;
  else ctx = `\x1b[32m${display} ${pct}%\x1b[0m`;

  const parts = [ctx];
  if (git) parts.push(git);

  process.stdout.write(parts.join(' | '));
}

main();
