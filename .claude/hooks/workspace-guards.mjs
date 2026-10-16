#!/usr/bin/env node
/**
 * PreToolUse hook — enforce two CLAUDE.md rules deterministically.
 *
 * (The 1-Projects drafts rule is a habit, not a hook: a block on project
 * edits kept firing during normal project work and was removed 2026-06-04.)
 *
 * 1. MEMORY APPEND-ONLY GUARD — block non-append Edit/MultiEdit to
 *    memory/YYYY-MM-DD.md files. New content must add to the end of the
 *    existing file, never rewrite earlier entries.
 *    Source rule: CLAUDE.md "Memory writes are append-only under
 *    memory/YYYY-MM-DD.md. Don't rewrite history."
 *
 * 2. OUTPUT-AT-ROOT GUARD — block Write of *.html / *.md at the repo root
 *    outside the allowlist (CLAUDE, README, SOUL, USER, IDENTITY, TOOLS,
 *    DESIGN, PRODUCT, AGENTS, EXAMPLE-CONFIG, INSTALL, CHANGELOG, LICENSE).
 *    Force outputs into <workspace.root>/<workspace.resources>/<type>/ subdirs
 *    (resolved from the Configuration block in root CLAUDE.md).
 *    Source rule: CLAUDE.md "Never write outputs at the root. Never mix
 *    briefings with project files."
 *
 * Decision model: BLOCK with show-and-deny — emit a clear message explaining
 * what would have happened and what to do instead. There is no per-turn
 * allowance; blocks are unconditional. To bypass, either relocate the write,
 * have the user edit manually, or temporarily disable the hook in settings.json.
 *
 * Failure-mode discipline: any uncaught error → exit 0 (fail open). A noisy
 * hook that blocks every write is worse than a silent one that misses an
 * edge case.
 *
 * Anthropic's hooks-vs-rules guidance: hooks are deterministic, rules are
 * probabilistic. For "do not" guardrails that matter, the hook is the right
 * tool — not the CLAUDE.md sentence.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const REPO_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readToken(md, key, fallback) {
  const m = md.match(new RegExp("`" + key.replace(/\./g, "\\.") + "` = `([^`]+)`"));
  const v = m ? m[1].trim() : "";
  // Unfilled template values (`<workspace.root>` before /bootstrap) fall back to defaults.
  return v && !v.startsWith("<") ? v : fallback;
}
let CONFIG_MD = "";
try { CONFIG_MD = readFileSync(resolve(REPO_ROOT, "CLAUDE.md"), "utf8"); } catch {}
const RESOURCES_REL = `${readToken(CONFIG_MD, "workspace.root", "workspace")}/${readToken(CONFIG_MD, "workspace.resources", "4-Resources")}`;

// ---------------------------------------------------------------------------
// Allowlist for root-level *.html / *.md files (output-at-root guard)
// ---------------------------------------------------------------------------
const ROOT_FILE_ALLOWLIST = new Set([
  "CLAUDE.md",
  "README.md",
  "SOUL.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "DESIGN.md",
  "PRODUCT.md",
  "AGENTS.md",
  "EXAMPLE-CONFIG.md",
  "INSTALL.md",
  "CHANGELOG.md",
  "LICENSE",
  "LICENSE.md",
  "THIRD-PARTY-NOTICES.md",
  "memory.md",
]);

const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "Update"]);

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
  if (!toolName || !FILE_TOOLS.has(toolName)) return;

  const targetPath = toolInput.file_path;
  if (!targetPath) return;

  const absPath = resolve(targetPath);
  const relPath = absPath.startsWith(REPO_ROOT)
    ? absPath.slice(REPO_ROOT.length + 1)
    : absPath;

  // -------------------------------------------------------------------------
  // GUARD 1 — Memory append-only protection
  // -------------------------------------------------------------------------
  // Match memory/YYYY-MM-DD.md anywhere in the path (project memory.md is
  // append-only too, but uses the unscoped memory.md filename — covered by
  // a softer warning, not a hard block).
  if (/\/memory\/\d{4}-\d{2}-\d{2}\.md$/.test(relPath) || /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(relPath)) {
    // For Edit/Update: check if the old_string appears at the END of the file.
    // For MultiEdit: check the first edit's old_string.
    // For Write: block when the day log already exists (that would overwrite it);
    // creating today's log with Write is fine.
    if (toolName === "Write" && existsSync(absPath)) {
      blockWith(
        toolName,
        targetPath,
        [
          `🛑 Write blocked — ${relPath} is a dated memory day log.`,
          "",
          "CLAUDE.md rule: \"Memory writes are append-only under memory/YYYY-MM-DD.md. Don't rewrite history.\"",
          "",
          "Write would replace the entire file. Use Edit to append instead:",
          "  - Edit with old_string = <last entry from file>",
          "  - new_string = <last entry> + '\\n\\n## <new heading>\\n<new content>'",
          "",
          "Or use bash: `cat >> memory/YYYY-MM-DD.md <<EOF ... EOF` to append literally.",
        ].join("\n")
      );
      return;
    }

    if (toolName === "Edit" || toolName === "Update" || toolName === "MultiEdit") {
      const oldString =
        toolName === "MultiEdit"
          ? (Array.isArray(toolInput.edits) && toolInput.edits[0]?.old_string) || ""
          : toolInput.old_string || "";

      if (!oldString) return; // can't check, fail open

      try {
        const fileContent = existsSync(absPath) ? readFileSync(absPath, "utf8") : "";
        const trimmedFile = fileContent.trimEnd();
        const trimmedOld = oldString.trimEnd();

        // Append-style edit = old_string appears as a SUFFIX of file content
        // (with optional whitespace). Anything else = rewrite of earlier content.
        const isAppendLike = trimmedFile.endsWith(trimmedOld);

        if (!isAppendLike) {
          blockWith(
            toolName,
            targetPath,
            [
              `🛑 Edit blocked — ${relPath} non-append modification.`,
              "",
              "CLAUDE.md rule: \"Memory writes are append-only — don't rewrite history.\"",
              "",
              "The old_string this edit targets is NOT at the end of the file, which means earlier history would be rewritten.",
              "",
              "FIX: append-only flow:",
              "  1. Use Edit with old_string = the LAST entry (or trailing marker like '---')",
              "  2. new_string = <same last entry> + '\\n\\n## <new heading>\\n<new content>'",
              "",
              "If the intent really is to fix a typo / correct an earlier entry, this hook will still block — there is no per-turn allowance. Either edit the file manually outside Claude, or temporarily disable this hook in .claude/settings.json.",
            ].join("\n")
          );
          return;
        }
      } catch {
        // File read failed → fail open
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // GUARD 2 — Output-at-root protection
  // -------------------------------------------------------------------------
  // Only triggers on Write (not Edit) — Edit means the file already exists,
  // and if it exists at root, it's either allowed or it was a prior violation
  // we don't want to re-litigate on every edit.
  if (toolName === "Write") {
    // relPath has no slash = file is at repo root
    const isRoot = !relPath.includes("/");
    if (isRoot) {
      const fileName = basename(relPath);
      const isAllowed = ROOT_FILE_ALLOWLIST.has(fileName);
      const isMdOrHtml = /\.(md|html)$/i.test(fileName);

      if (isMdOrHtml && !isAllowed) {
        blockWith(
          toolName,
          targetPath,
          [
            `🛑 Write blocked — ${fileName} would land at the repo root.`,
            "",
            "CLAUDE.md rule: \"Never write outputs at the root. Never mix briefings with project files.\"",
            "",
            `Outputs belong in ${RESOURCES_REL}/<type>/. Pick the right type:`,
            "  - briefings/          → morning/evening briefs",
            "  - meeting-prep/       → pre-meeting context packs",
            "  - organization-reports/ → audits, system reviews",
            "  - reference/          → durable docs",
            "  - research/           → exploratory dumps",
            "",
            `Suggested path: ${RESOURCES_REL}/<type>/${fileName}`,
            "",
            "Or if this really is a root-level persona/system file (rare), add it to ROOT_FILE_ALLOWLIST in .claude/hooks/workspace-guards.mjs.",
          ].join("\n")
        );
        return;
      }
    }
  }
};

function blockWith(toolName, targetPath, reason) {
  const output = {
    decision: "block",
    reason: reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

main().catch(() => {
  // Fail open on any uncaught error
  process.exit(0);
});
