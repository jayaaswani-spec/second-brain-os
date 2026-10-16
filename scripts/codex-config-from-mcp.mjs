#!/usr/bin/env node
// codex-config-from-mcp.mjs — writes .codex/config.toml from .mcp.json so Codex
// gets the same MCP servers as Claude Code. The pre-commit hook runs it; run it
// by hand after editing .mcp.json if you want Codex to see the change sooner.
//
//   node scripts/codex-config-from-mcp.mjs            # write .codex/config.toml
//   node scripts/codex-config-from-mcp.mjs --check    # exit 1 if it is out of date
//
// Mapping:
//   stdio  → command + args. A server whose args name a file in this repo
//            (`.claude/mcp-servers/x.mjs`) is started through `sh -c` from the git
//            root, because Codex starts stdio servers in its own working folder,
//            which is a subfolder when you launch Codex from one.
//            Literal env values go in `env`; env vars the server
//            needs from your shell go in `env_vars` (Codex forwards only a short
//            default list otherwise): "${VAR}" values with the same name, plus
//            any variable the server's own script reads.
//   http   → url. "Authorization: Bearer ${VAR}" becomes bearer_token_env_var,
//            other "${VAR}" headers become env_http_headers, literal headers
//            become http_headers.
//   _notes.opt_in_* entries that start with a JSON server object are written as
//   commented-out blocks, so opt-in servers stay opt-in. A server that needs a
//   pre-registered OAuth client (oauth.clientId, e.g. Slack) is always written
//   commented out, since Codex can't use Claude Code's client. Anything the
//   script can't express in Codex stops it with an error instead of being dropped.
//
// Codex reads a project's .codex/config.toml only after you trust the folder.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const mcpPath = path.join(root, ".mcp.json");
const outPath = path.join(root, ".codex", "config.toml");
const checkOnly = process.argv.includes("--check");

// Codex always forwards these to stdio servers on macOS/Linux.
const CODEX_DEFAULT_ENV = new Set([
  "HOME", "LOGNAME", "PATH", "SHELL", "USER", "__CF_USER_TEXT_ENCODING",
  "LANG", "LC_ALL", "TERM", "TMPDIR", "TZ",
]);
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
// Runs "$@" from the repo root; outside a git repo it stays where Codex started it.
const FROM_REPO_ROOT = 'root=$(git rev-parse --show-toplevel 2>/dev/null) && cd "$root"; exec "$@"';
// True when an arg is a relative path to a file in this repo.
const isRepoPath = (arg) =>
  !String(arg).startsWith("-") && !path.isAbsolute(String(arg)) && fs.existsSync(path.resolve(root, String(arg)));

function fail(msg) {
  console.error(`codex-config-from-mcp: ${msg}`);
  process.exit(1);
}

// TOML basic string: escape backslash, quote and every control character.
function q(value) {
  const s = String(value);
  if (/[\uD800-\uDFFF]/.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""))) fail(`lone surrogate in ${JSON.stringify(s)}`);
  return `"${s.replace(/[\\"\u0000-\u001F\u007F]/g, (c) => {
    if (c === "\\" || c === '"') return `\\${c}`;
    return `\\u${c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}`;
  })}"`;
}
const bareKey = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : q(k));
const inlineTable = (obj) =>
  `{ ${Object.entries(obj).map(([k, v]) => `${bareKey(k)} = ${q(v)}`).join(", ")} }`;
// Single-line text for a # comment.
const oneLine = (s) => String(s).replace(/[\u0000-\u001F\u007F]+/g, " ").trim();

// Env vars a local stdio server's entry script reads. Only the entry file is
// scanned; a server that reads env in an imported module should list the
// variable in .mcp.json's "env" as "NAME": "${NAME}".
function envVarsReadBy(server) {
  const names = new Set();
  for (const arg of server.args ?? []) {
    const file = path.resolve(root, arg);
    if (!/\.(m?js|cjs|ts|py)$/.test(arg) || !fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const patterns = [
      /process\.env\??\.([A-Za-z_][A-Za-z0-9_]*)/g,
      /process\.env\??\.?\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
      /os\.(?:environ\.get|getenv)\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g,
      /os\.environ\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
    ];
    for (const re of patterns) for (const m of src.matchAll(re)) names.add(m[1]);
    for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)) {
      for (const part of m[1].split(",")) {
        const name = part.split(/[:=]/)[0].trim();
        if (ENV_NAME.test(name)) names.add(name);
      }
    }
  }
  return names;
}

function serverLines(name, server) {
  const lines = [`[mcp_servers.${bareKey(name)}]`];
  const notes = [];
  const type = server.type ?? (server.url ? "http" : "stdio");
  if (type === "stdio") {
    if (!server.command) fail(`${name}: stdio server has no command`);
    if ((server.args ?? []).some(isRepoPath)) {
      lines.push(`command = "sh"`);
      lines.push(`args = [${["-c", FROM_REPO_ROOT, "sh", server.command, ...server.args].map(q).join(", ")}]`);
      notes.push("Started from the repo root, so it also works when Codex runs in a subfolder.");
    } else {
      lines.push(`command = ${q(server.command)}`);
      if (server.args?.length) lines.push(`args = [${server.args.map(q).join(", ")}]`);
    }
    const literal = {};
    const forwarded = envVarsReadBy(server);
    for (const [key, value] of Object.entries(server.env ?? {})) {
      const ref = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
      if (ref && ref[1] === key) forwarded.add(key);
      else if (ref || String(value).includes("${")) fail(`${name}: env ${key}=${value} renames or embeds a variable; Codex can only forward a variable under its own name`);
      else literal[key] = value;
    }
    for (const key of Object.keys(literal)) forwarded.delete(key);
    if (Object.keys(literal).length) lines.push(`env = ${inlineTable(literal)}`);
    const envVars = [...forwarded].filter((n) => !CODEX_DEFAULT_ENV.has(n)).sort();
    if (envVars.length) {
      lines.push(`env_vars = [${envVars.map(q).join(", ")}]`);
      notes.push(`Needs ${envVars.join(", ")} set in your shell.`);
    }
  } else if (type === "http") {
    if (!server.url) fail(`${name}: http server has no url`);
    lines.push(`url = ${q(server.url)}`);
    const literal = {};
    const fromEnv = {};
    for (const [header, value] of Object.entries(server.headers ?? {})) {
      const bearer = /^Bearer \$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
      const whole = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
      if (header.toLowerCase() === "authorization" && bearer) {
        lines.push(`bearer_token_env_var = ${q(bearer[1])}`);
        notes.push(`Needs ${bearer[1]} set in your shell.`);
      } else if (whole) fromEnv[header] = whole[1];
      else if (String(value).includes("${")) fail(`${name}: header ${header} mixes text and an env var; Codex can't express that`);
      else literal[header] = value;
    }
    if (Object.keys(literal).length) lines.push(`http_headers = ${inlineTable(literal)}`);
    if (Object.keys(fromEnv).length) {
      lines.push(`env_http_headers = ${inlineTable(fromEnv)}`);
      notes.push(`Needs ${Object.values(fromEnv).join(", ")} set in your shell.`);
    }
    if (server.oauth?.clientId) {
      notes.push(`Not expected to work in Codex as is: this server needs a pre-registered OAuth client (Claude Code uses client id ${oneLine(server.oauth.clientId)}), so register your own before enabling it.`);
    }
  } else {
    fail(`${name}: server type "${type}" isn't supported for Codex (use stdio or http)`);
  }
  return [...notes.map((n) => `# ${n}`), ...lines];
}

// The server object at the start of an opt_in_* note ("{ ...json... }  — Claude-specific
// setup text"). Returns null for a note with no object; stops with an error when the
// note starts with "{" but no prefix of it parses, so an opt-in is never dropped silently.
function parseOptIn(key, note) {
  const text = String(note).trimStart();
  if (!text.startsWith("{")) return null;
  for (let i = text.indexOf("}"); i !== -1; i = text.indexOf("}", i + 1)) {
    try {
      const obj = JSON.parse(text.slice(0, i + 1));
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    } catch {
      // not a complete object yet; try the next closing brace
    }
  }
  return fail(`_notes.${key} starts with "{" but holds no valid JSON server object`);
}

function render(mcp) {
  const servers = mcp.mcpServers ?? {};
  const out = [
    "# Codex MCP servers, generated from .mcp.json by scripts/codex-config-from-mcp.mjs.",
    "# Edit .mcp.json, then re-run the script (the pre-commit hook does); hand edits here are overwritten.",
    "# Codex loads this file only once you trust this folder (it asks on first run).",
    "",
  ];
  for (const [name, server] of Object.entries(servers)) {
    // A server that needs a pre-registered OAuth client (Slack) can't sign in from
    // Codex as is, so it stays commented out here even when Claude Code uses it.
    const lines = serverLines(name, server);
    out.push(...(server.oauth?.clientId ? lines.map((l) => (l.startsWith("#") ? l : `# ${l}`)) : lines), "");
  }

  const optIns = [];
  const noBlock = [];
  for (const [key, note] of Object.entries(mcp._notes ?? {})) {
    if (!key.startsWith("opt_in_")) continue;
    const name = key.slice("opt_in_".length);
    if (name === "mcps") continue; // the general opt-in explainer, not a server
    if (name in servers) continue; // already switched on above; a commented copy would duplicate it
    const server = parseOptIn(key, note);
    if (server) optIns.push([name, server]);
    else noBlock.push(name);
  }
  if (optIns.length || noBlock.length) {
    out.push("# Opt-in servers: uncomment a block, then sign in with `codex mcp login <name>`.", "");
    for (const [name, server] of optIns) {
      out.push(...serverLines(name, server).map((l) => (l.startsWith("#") ? l : `# ${l}`)), "");
    }
    if (noBlock.length) {
      out.push(`# No Codex block (connect these through Codex's own connectors): ${noBlock.join(", ")}.`, "");
    }
  }
  return out.join("\n").replace(/\n+$/, "\n");
}

if (!fs.existsSync(mcpPath)) fail(`no .mcp.json in ${root}`);
let mcp;
try {
  mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
} catch (e) {
  fail(`.mcp.json is not valid JSON: ${e.message}`);
}
const toml = render(mcp);

if (checkOnly) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";
  if (current !== toml) fail(".codex/config.toml is out of date with .mcp.json; run without --check");
  console.log(".codex/config.toml matches .mcp.json");
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, toml);
  console.log(`wrote .codex/config.toml (${Object.keys(mcp.mcpServers ?? {}).length} servers)`);
}
