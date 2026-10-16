#!/usr/bin/env node
/**
 * intent-detector.mjs — UserPromptSubmit hook
 *
 * Reads the user's prompt from stdin, regex-tests it against a narrow set of
 * project-lifecycle trigger patterns, and on a match (a) appends a JSONL
 * entry to .claude/intent-detector-log.jsonl (keeps precision auditable) and
 * (b) emits hookSpecificOutput.additionalContext nudging the assistant toward
 * the matching skill — a soft suggestion the model may ignore on false
 * positives. NEVER blocks; ALWAYS exits 0.
 *
 * Failure modes are silent on purpose — a hook that errors loudly on every
 * prompt is worse than one that silently no-ops. Any uncaught error → exit 0.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const main = async () => {
  // 1. Read stdin (Claude Code passes hook event as JSON)
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return; // can't parse → exit silently, don't block the user's prompt
  }

  const prompt = (event.prompt || "").toString();
  if (!prompt) return;

  // Skip machine-generated turns: subagent hand-backs, task notifications,
  // system reminders and slash-command expansions. They quote other text
  // (often test prompts), so matching them only produces false suggestions.
  const MACHINE_PREFIXES = ["<agent-message", "<task-notification", "<scheduled-task", "[SYSTEM NOTIFICATION", "<system-reminder", "<local-command-", "<command-"];
  if (MACHINE_PREFIXES.some((p) => prompt.trimStart().startsWith(p))) return;

  // 2. Named pattern set. Keep narrow — precision over recall. Each entry
  //    has a name (for audit), a regex, and the slash command to suggest.
  const patterns = [
    // /new-project triggers — both meta-project and code-repo cases
    { name: "new-project-explicit",     regex: /\bnew project\b/i,                                                 suggest: "/new-project" },
    { name: "start-a-project",          regex: /\b(start|kick off|kicking off|scaffold|spin up) (a |the |an )?(new )?project\b/i, suggest: "/new-project" },
    { name: "create-project-for",       regex: /\bcreate (a |the |an )?(new )?project (for|on|to|about)\b/i,        suggest: "/new-project" },
    { name: "set-up-deliverable",       regex: /\bset up (the |a |an )?(deck|memo|prep|plan|brief|doc|presentation|qbr|prd)\b/i, suggest: "/new-project" },
    { name: "track-properly",           regex: /\b(track|set up) (this|that|it|the X) (properly|with the assistant)\b/i,       suggest: "/new-project" },

    // /new-project code-repo branch triggers
    { name: "new-mcp-or-agent",         regex: /\bnew (mcp server|agent|library|cli tool|tool|bot|service|repo)\b/i, suggest: "/new-project (code-repo)" },
    { name: "spin-up-repo",             regex: /\bspin up (a |the |an )?(new )?repo\b/i,                            suggest: "/new-project (code-repo)" },
    { name: "scaffold-code",            regex: /\bscaffold (a |the |an )?(new )?(mcp|agent|repo|tool|server|library)\b/i, suggest: "/new-project (code-repo)" },

    // /archive-project triggers
    { name: "archive-named-project",    regex: /\barchive (the |a )?(\w+[- ]?){1,4}project\b/i,                     suggest: "/archive-project" },
    { name: "im-done-with",              regex: /\bI[''']?m done with (the )?[\w-]+\b/i,                              suggest: "/archive-project" },
    { name: "wrap-up-project",          regex: /\bwrap up (the )?[\w-]+( project| prep| memo| deck)?\b/i,            suggest: "/archive-project" },
    { name: "move-to-archive",          regex: /\bmove (\w+ )?to archive\b/i,                                        suggest: "/archive-project" },

    // /prune-projects triggers
    { name: "whats-stale",              regex: /\bwhat[''']?s stale( right now)?\??/i,                                suggest: "/prune-projects" },
    { name: "friday-review",            regex: /\b(friday review|friday cleanup)\b/i,                                suggest: "/prune-projects" },
    { name: "prune-projects-explicit",  regex: /\bprune projects?\b/i,                                                suggest: "/prune-projects" },
    { name: "what-should-archive",      regex: /\b(what|anything) (should I|to) (archive|close out|clean up)\b/i,    suggest: "/prune-projects" },
    { name: "review-my-projects",       regex: /\b(review my projects|whats? gone cold|any stale projects)\b/i,       suggest: "/prune-projects" },

    // /briefing triggers — chief-of-staff morning orient
    { name: "morning-briefing",         regex: /\b(morning briefing|daily brief|brief me|give me the rundown)\b/i,    suggest: "/briefing" },
    { name: "whats-on-my-plate",        regex: /\bwhat[''']?s on my plate( today)?\??/i,                              suggest: "/briefing" },
    { name: "orient-me",                regex: /\b(orient me|orient me for the day|where do I stand)\b/i,             suggest: "/briefing" },
    { name: "what-needs-me",            regex: /\bwhat needs (me|my attention)( today)?\b/i,                          suggest: "/briefing" },
    { name: "what-should-work-on",      regex: /\bwhat should I (work on|do first)( today| this morning)?\b/i,         suggest: "/briefing" },

    // /find triggers — recall existing knowledge
    { name: "find-explicit",            regex: /^\/?find\b/i,                                                          suggest: "/find" },
    { name: "do-i-have-on",             regex: /\bdo I have (anything|notes|research|something|a note) (on|about|for)\b/i, suggest: "/find" },
    { name: "what-do-i-know",           regex: /\bwhat do I (have|know) (on|about)\b/i,                                suggest: "/find" },
    { name: "search-my-notes",          regex: /\b(search|grep|look through) my (notes|vault|workspace|files)\b/i,     suggest: "/find" },
    { name: "what-did-i-save",          regex: /\bwhat did I (save|write|note) about\b/i,                              suggest: "/find" },
    { name: "is-there-a-note",          regex: /\bis there (a |any )?(note|project|research|doc) (on|for|about)\b/i,  suggest: "/find" },

    // /contact triggers — recall a person
    { name: "tell-me-about-person",     regex: /\b[Tt]ell me about [A-Z][a-z]+\b/,                                     suggest: "/contact" },
    { name: "who-is-x",                 regex: /\b[Ww]ho is [A-Z][a-z]+( again)?\??/,                                  suggest: "/contact" },
    { name: "context-on-person",        regex: /\b(what[''']?s my context with|context on|remind me about) \w+/i,      suggest: "/contact" },
    { name: "contact-explicit",         regex: /^\/?contact\b/i,                                                       suggest: "/contact" },

    // /contact-log triggers — write-mode, log an interaction
    { name: "log-meeting-with",         regex: /\b(log|record|append) (my )?(meeting|call|1[: -]?1|chat|conversation|sync) with \w+/i, suggest: "/contact-log" },
    { name: "just-talked-to",           regex: /\b(just (talked to|spoke with|met with|caught up with|had a call with)|just got off (a call|the phone) with) \w+/i, suggest: "/contact-log" },
    { name: "contact-log-explicit",     regex: /^\/?contact-log\b/i,                                                   suggest: "/contact-log" },

    // /save-resource triggers — stash something for later
    { name: "save-this-resource",       regex: /\b(save|stash|bookmark) (this|that|it)( for later| somewhere| in resources)?\b/i, suggest: "/save-resource" },
    { name: "save-resource-explicit",   regex: /^\/?save[- ]resource\b/i,                                              suggest: "/save-resource" },

    // /inbox-process triggers — Friday-style inbox triage
    { name: "process-inbox",            regex: /\b(process|triage|clear out|sort through) (the |my )?inbox\b/i,        suggest: "/inbox-process" },
    { name: "inbox-process-explicit",   regex: /^\/?inbox[- ]process\b/i,                                              suggest: "/inbox-process" },
    { name: "whats-in-my-inbox",        regex: /\bwhat[''']?s in (the |my )?inbox\b/i,                                  suggest: "/inbox-process" },


    // /reindex app-audit triggers — Area app manifest bookkeeping
    { name: "sync-indexes-explicit",    regex: /\b(sync indexes|audit (code repos|apps|app manifests))\b/i,            suggest: "/reindex app-audit" },
    { name: "orphan-repos",             regex: /\b(orphan (repos|apps)|apps? (without|missing) (a )?manifests?)\b/i,   suggest: "/reindex app-audit" },

    // /os-guide triggers — OS-shaped questions answered from canonical files, not memory
    { name: "os-guide-explicit",        regex: /^\/?os-guide\b/i,                                                      suggest: "/os-guide" },
    { name: "how-does-os-work",         regex: /\bhow (does|do) (the |my |our )?(os|second brain|workspace|para|memory system|area routing|routing map|contacts? (system|schema))s? work\b/i, suggest: "/os-guide" },
    { name: "where-does-x-belong",      regex: /\bwhere (does|do|should) [\w' -]{1,30}(live|go|belong|get (saved|filed|stored))\b/i, suggest: "/os-guide" },
    { name: "what-skills-exist",        regex: /\bwhat skills (do (i|we) have|exist|are (available|installed))\b/i,   suggest: "/os-guide" },
    { name: "config-token-question",    regex: /\b(configuration (section|token|value)|workspace\.(root|projects|areas|area_apps|project_apps|resources|archive))\b/i, suggest: "/os-guide" },

    // Flow skills — the planning and build path (docs/agents/project-context.md)
    { name: "which-skill-for-this",     regex: /\b(which|what) (skill|flow|path) (should (i|we) use|fits|do (i|we) use)\b/i, suggest: "/flow" },
    { name: "how-to-tackle",            regex: /\b(how (should|do) we (tackle|approach|go from here)|where do (i|we) (start|begin) with)\b/i, suggest: "/flow" },
    { name: "write-the-spec",           regex: /\b(write (up )?the spec|spec (this|it) up|turn this into a (spec|prd))\b/i, suggest: "/to-spec" },
    { name: "break-into-tickets",       regex: /\b(break (this|it) (up |down )?into tickets|slice (this|it) up|make tickets for (this|it))\b/i, suggest: "/to-tickets" },
    { name: "triage-queue",             regex: /\b(triage (the )?(queue|intake|backlog|tickets|help ?desk|[A-Z][A-Z0-9]+-\d+)|work through the intake)\b/i, suggest: "/triage" },
    { name: "too-big-for-a-session",    regex: /\b(too big for one session|wayfind (this|it)|chart (this|it) out|map (this|it) out)\b/i, suggest: "/wayfinder" },
  ];

  // 3. Test all patterns. Multiple may match (e.g., "new MCP server project" hits two).
  const matches = patterns
    .filter((p) => p.regex.test(prompt))
    .map((p) => ({ name: p.name, suggest: p.suggest }));

  if (matches.length === 0) return;

  // 4. Append to JSONL log. Bound the prompt size in the log so secrets / huge
  //    pastes don't get persisted forever.
  // Log at the project root, not wherever the session's shell happens to be.
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const logFile = join(root, ".claude", "intent-detector-log.jsonl");
  const logDir = dirname(logFile);
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const entry = {
    ts: new Date().toISOString(),
    matched: matches.map((m) => m.name),
    would_suggest: [...new Set(matches.map((m) => m.suggest))],
    prompt: prompt.length > 500 ? prompt.slice(0, 500) + "…" : prompt,
    session_id: event.session_id || null,
  };

  try {
    appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch {
    // Disk full, permissions, whatever — silent. The user's prompt must not be blocked.
  }

  // 5. Surface the suggestion as additionalContext. Soft nudge — the
  //    model decides; a false positive costs one ignored sentence.
  const suggestions = entry.would_suggest.join(", ");
  const context =
    `<intent-detector> The user's phrasing matches the trigger patterns for: ${suggestions}. ` +
    `If that intent is real, invoke the matching skill via the Skill tool instead of handling it ad hoc. ` +
    `If it's a false positive, ignore this note silently.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: context,
      },
    })
  );
};

// Contract: never block. Any path → exit 0.
main()
  .catch(() => {})
  .finally(() => process.exit(0));
