#!/usr/bin/env node
// PreToolUse hook: when drafting/sending a Slack message to a known contact,
// hand their contact-file context to the model as additional context.
//
// Why: prevents wrong-tone drafts to recurring contacts whose context (role,
// relationship, open commitments, last-interaction notes) lives in the
// contacts directory but isn't auto-loaded. Surfaces it just-in-time.
//
// Setup: drop a `.claude/.slack-id-map.json` at the project root mapping
// Slack user IDs to contact slugs:
//   {
//     "U05ABCDE1234": "alex-chen",
//     "U05ABCDE5678": "priya-patel"
//   }
// Each slug must match a file at <workspace.root>/4-Resources/contacts/<slug>.md.
// If either the map or a contact file is missing, the hook exits silently —
// the Slack tool call proceeds normally without context injection.
//
// Behavior: non-blocking warning. Hook reads stdin (Claude Code PreToolUse
// JSON), checks tool_name + channel_id, looks up in .claude/.slack-id-map.json,
// reads matching contact file from <workspace.root>/4-Resources/contacts/<slug>.md,
// emits frontmatter + first ~70 lines as hookSpecificOutput.additionalContext
// on stdout. Exit 0.
//
// Stderr on exit 0 never reaches the model, so the context goes out as
// PreToolUse additionalContext; the tool call still proceeds.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let payload;
try {
  const input = readFileSync(0, "utf8");
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || "";
// Slack ships under many server names (mcp__slack__, mcp__claude_ai_Slack__,
// the desktop app's ID-named connector). Match on the action suffix only.
// Keep settings.json matcher in sync.
const SLACK_WRITE_ACTIONS = new Set([
  "slack_send_message_draft",
  "slack_send_message",
  "slack_schedule_message",
]);
const action = toolName.startsWith("mcp__") ? toolName.slice(toolName.lastIndexOf("__") + 2) : "";
if (!SLACK_WRITE_ACTIONS.has(action)) process.exit(0);

const channelId = payload.tool_input?.channel_id;
if (!channelId) process.exit(0);

const projectRoot = process.env.CLAUDE_PROJECT_DIR || resolve(__dirname, "..", "..");
const mapPath = `${projectRoot}/.claude/.slack-id-map.json`;
if (!existsSync(mapPath)) process.exit(0);

let map;
try {
  map = JSON.parse(readFileSync(mapPath, "utf8"));
} catch {
  process.exit(0);
}

const slug = map[channelId];
if (!slug || slug.startsWith("_")) process.exit(0);

// Auto-discover workspace root by globbing for */4-Resources/contacts/ at project root.
// Works for any workspace name (workspace, brain, vault, etc.) — set by /bootstrap.
let workspaceRoot = null;
try {
  for (const entry of readdirSync(projectRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(`${projectRoot}/${entry.name}/4-Resources/contacts`)) {
      workspaceRoot = entry.name;
      break;
    }
  }
} catch {
  process.exit(0);
}
if (!workspaceRoot) process.exit(0);

const contactPath = `${projectRoot}/${workspaceRoot}/4-Resources/contacts/${slug}.md`;
if (!existsSync(contactPath)) process.exit(0);

const contact = readFileSync(contactPath, "utf8");
const lines = contact.split("\n");
// Show frontmatter + first ~40 body lines (enough for About + Recurring topics + Open commitments preview)
const trimmed = lines.slice(0, 70).join("\n");

const warning = [
  "",
  `## ⚠️ Contact context for ${slug} (auto-loaded by pre-slack-draft-contact-check hook)`,
  "",
  "**Known recipient — you should have read this file BEFORE drafting.**",
  `**Path:** ${workspaceRoot}/4-Resources/contacts/${slug}.md`,
  "",
  "**Contact summary:**",
  "",
  trimmed,
  "",
  "---",
  "If the draft you just created doesn't match this context (wrong tone, missed open commitments, wrong relationship framing), REWRITE before the user sees it. Run `/contact " + slug + "` for the full file.",
  "",
].join("\n");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: warning,
  },
}));
process.exit(0);
