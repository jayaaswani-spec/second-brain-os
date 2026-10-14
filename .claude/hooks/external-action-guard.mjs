#!/usr/bin/env node
/**
 * PreToolUse hook — show-and-confirm friction on irreversible external actions.
 *
 * Four sub-handlers, dispatched by tool name:
 *
 *   62a. Message send guard     — Slack send/schedule/canvas, Gmail
 *                                  send_message/reply/forward, iMessage
 *   62b. GitHub destructive-push — Bash matching `git push --force` OR
 *                                  `git push` targeting main/master
 *   62c. Atlassian write guard  — <atlassian server>__(create|edit|
 *                                  transition|add|update|execute).*
 *   62d. rm -rf guard           — Bash matching `rm -rf` outside a whitelist
 *
 * Output is `permissionDecision: "ask"` (modern hookSpecificOutput format).
 * Blocks are show-and-confirm, not show-and-deny. Goal is friction at the moment of action, not refusal.
 *
 * Spec: locked decision — show-and-confirm friction on irreversible external
 *       actions (Slack send, force push to main/master, Atlassian writes,
 *       rm -rf outside whitelisted paths).
 *
 * Performance: Bash fires constantly. handleBash() exits in <1ms on the 99%
 * case via plain string includes() before any regex runs.
 *
 * Failure-mode discipline: any uncaught error → exit 0 (action proceeds).
 * A hook that errors on every prompt is worse than one that misses.
 */

// rm -rf is allowed (silently) when the target path matches one of these
// fragments. Covers transient build/cache state and explicit /tmp scratch.
const SAFE_RM_PATHS = [
  "/tmp/",
  "node_modules/",
  "__pycache__/",
  ".venv/",
  "dist/",
  "build/",
  ".tldr/",
  ".workflow/",
];

// The same service ships under many MCP server names: local servers
// (mcp__slack__), claude.ai connectors (mcp__claude_ai_Slack__), and the
// desktop app's ID-named connectors (mcp__<connector-uuid>__). Match on the action
// suffix alone, never the server prefix, so a server rename can't silently
// disable the guard. Keep settings.json matchers in sync.
const SLACK_SEND_ACTIONS = new Set([
  "slack_send_message",
  "slack_schedule_message",
  "slack_create_canvas",
  "slack_update_canvas",
]);

// Other messaging surfaces: the Gmail connector (send_message, reply,
// forward; drafts stay unguarded) and iMessage. The desktop app's own
// session tools (mcp__ccd_*) also have a send_message action; those talk to
// other Claude sessions, not people, so they are skipped.
const MESSAGE_SEND_ACTIONS = new Set([
  "send_message",
  "reply",
  "forward",
  "send_imessage",
]);

// Atlassian MCP write/mutate tools (Jira + Confluence). Reads (get*, search*,
// fetch, executeRead) and metadata calls (getJiraProject*, atlassianUserInfo)
// are NOT guarded — they're idempotent and safe.
const ATLASSIAN_WRITE_ACTIONS = new Set([
  "createJiraIssue",
  "editJiraIssue",
  "transitionJiraIssue",
  "addCommentToJiraIssue",
  "addOrEditJiraIssueComment",
  "addWorklogToJiraIssue",
  "createIssueLink",
  "createConfluencePage",
  "createConfluenceContent",
  "updateConfluencePage",
  "updateConfluenceContent",
  "createConfluenceFooterComment",
  "createConfluenceInlineComment",
  "executeWrite",
  "executeDestructive",
]);

// Returns the action suffix of an MCP tool name (mcp__<server>__<action>).
function mcpAction(toolName) {
  if (!toolName.startsWith("mcp__")) return null;
  return toolName.slice(toolName.lastIndexOf("__") + 2);
}

function truncate(s, n = 200) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// 62b + 62d: dispatch on the bash command content.
function handleBash(toolInput) {
  const cmd = (toolInput.command || "").toString();
  if (!cmd) return null;

  // Fast string filter — most bash commands aren't destructive
  const hasRm = cmd.includes("rm -rf") || cmd.includes("rm -fr");
  const hasGitPush = cmd.includes("git push");
  if (!hasRm && !hasGitPush) return null;

  // 62d. rm -rf guard
  if (hasRm) {
    // Extract the FIRST positional arg after `rm -rf` for whitelist check.
    // (Multi-arg rm -rf could have a mix; we check the first; user can review
    // the full command in the surfaced preview.)
    const match = cmd.match(/\brm\s+-(?:rf|fr)\s+(\S+)/);
    const path = match ? match[1] : "<unparseable>";

    const safe = SAFE_RM_PATHS.some((s) => path.includes(s));
    if (safe) return null;

    return [
      "🛑 Destructive `rm -rf` detected outside whitelist:",
      "",
      `  ${truncate(cmd)}`,
      "",
      `Parsed target: ${path}`,
      "",
      `Auto-allowed paths: ${SAFE_RM_PATHS.join(", ")}`,
      "",
      "This op is irreversible. Confirm only if you're certain.",
    ].join("\n");
  }

  // 62b. GitHub destructive-push guard
  if (hasGitPush) {
    const isForce = /git push\s+(?:[^\n]*\s)?--force\b/.test(cmd) ||
                    /git push\s+(?:[^\n]*\s)?-f\b/.test(cmd) ||
                    cmd.includes("--force-with-lease");
    const isMain = /git push\s+\w+\s+(?:HEAD:)?(main|master)\b/.test(cmd) ||
                   /git push.*\bHEAD:(main|master)\b/.test(cmd);

    if (!isForce && !isMain) return null; // regular push to feature branch — allow

    const flags = [];
    if (isForce) flags.push("force-push");
    if (isMain) flags.push("push to main/master");

    return [
      `🛑 Destructive git push detected (${flags.join(" + ")}):`,
      "",
      `  ${truncate(cmd)}`,
      "",
      "Force-pushes rewrite history; pushes to main affect everyone with the remote.",
      "Confirm only if you're certain.",
    ].join("\n");
  }

  return null;
}

// 62a. Message send guard
function handleMessageSend(toolName, action, toolInput) {
  const isSlack = action.startsWith("slack_");
  const target = toolInput.channel_id || toolInput.channel || toolInput.channel_name ||
    toolInput.to || toolInput.recipient || toolInput.recipients || toolInput.thread_id ||
    toolInput.message_id || toolInput.canvas_id || "<unknown recipient>";
  const text = (toolInput.message || toolInput.text || toolInput.markdown_text ||
    toolInput.body || toolInput.content || toolInput.subject || "").toString();
  const preview = truncate(text);
  const scheduleNote = action === "slack_schedule_message"
    ? `\n  Scheduled for: ${toolInput.post_at || "<unspecified>"}`
    : "";

  return [
    `📨 About to send a message (${action}) — confirm send?`,
    "",
    `Tool: ${toolName}`,
    `To: ${truncate(Array.isArray(target) ? target.join(", ") : String(target), 120)}${scheduleNote}`,
    "",
    "Message preview:",
    ...preview.split("\n").map((l) => "  > " + l),
    "",
    isSlack ? "Slack sends are immediate and visible to channel members."
            : "Sends are immediate and reach real people.",
    "Per locked rule: no auto-send to messaging surfaces without explicit user approval.",
  ].join("\n");
}

// 62c. Atlassian write guard
function handleAtlassianWrite(action, toolInput) {
  // Identify the target resource if possible
  let identity = "(new resource)";
  if (action.startsWith("execute")) identity = `operation ${toolInput.name || "<unnamed>"}`;
  else if (toolInput.issueIdOrKey) identity = `issue ${toolInput.issueIdOrKey}`;
  else if (toolInput.pageId) identity = `page ${toolInput.pageId}`;
  else if (toolInput.projectKey) identity = `project ${toolInput.projectKey}`;
  else if (toolInput.spaceKey || toolInput.spaceId) identity = `space ${toolInput.spaceKey || toolInput.spaceId}`;

  return [
    `🎫 About to perform Atlassian write: ${action}`,
    "",
    `Target: ${identity}`,
    "",
    "This mutates live Atlassian state (Jira tickets / Confluence pages).",
    "Bulk-create runs are the dangerous case — a misconfigured spec can",
    "create dozens of unwanted tickets.",
    "",
    "Confirm only if you intend this exact mutation.",
  ].join("\n");
}

const main = async () => {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }

  const toolName = event.tool_name;
  const toolInput = event.tool_input || {};
  if (!toolName) return;

  let reason = null;

  if (toolName === "Bash") {
    reason = handleBash(toolInput);
  } else {
    const action = mcpAction(toolName);
    if (SLACK_SEND_ACTIONS.has(action) ||
        (MESSAGE_SEND_ACTIONS.has(action) && !toolName.startsWith("mcp__ccd_"))) {
      reason = handleMessageSend(toolName, action, toolInput);
    } else if (ATLASSIAN_WRITE_ACTIONS.has(action)) {
      reason = handleAtlassianWrite(action, toolInput);
    }
  }

  if (!reason) return;

  // Modern hookSpecificOutput format. permissionDecision: "ask" prompts the
  // user — this is the "show-and-confirm" semantics we want.
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason,
    },
  };

  process.stdout.write(JSON.stringify(output));
};

main()
  .catch(() => {})
  .finally(() => process.exit(0));
