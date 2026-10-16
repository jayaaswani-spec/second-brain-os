#!/usr/bin/env python3
"""apply.py — the deterministic half of /bootstrap.

Fills persona files from their templates, updates the Configuration block in
CLAUDE.md, creates the workspace folders and checks that nothing was left
unresolved. Python 3.9+, standard library only. Run from the repo root.

  python3 .claude/skills/bootstrap/scripts/apply.py detect
      Print what the machine already knows (git name/email, GitHub login,
      timezone, language) and each persona file's state, as JSON.

  python3 .claude/skills/bootstrap/scripts/apply.py write --values values.json
          [--fill FILE ...] [--force FILE ...] [--suggest FILE ...]
      Write everything. A persona file that no longer matches its template
      (edited by hand, or filled in by an earlier setup) is left untouched (T1)
      unless named with --fill (keep the person's text, fill in the tokens
      around it), --force (replace it from the template) or --suggest (write
      the new version beside it as FILE.bootstrap-suggested). Prints a JSON
      report.

  python3 .claude/skills/bootstrap/scripts/apply.py add-connectors slack atlassian figma
      Copy those opt-in servers from .mcp.json's _notes into mcpServers and
      refresh .codex/config.toml if the Codex generator is present.

  python3 .claude/skills/bootstrap/scripts/apply.py verify [--kept FILE ...]
      Exit 1 if any Configuration value or persona file still holds a
      placeholder, or setup_completed isn't a date. Files named with --kept
      (left untouched at the person's request) are reported, not failed.

values.json holds the dotted keys: user.name, user.full_name, user.email,
user.timezone, user.github, user.company, user.email_signature, user.language,
user.role_description, assistant.name, assistant.role, assistant.vibe,
assistant.emoji, workspace.root. Missing optional values become "—".
"""

import argparse
import datetime
import json
import os
import re
import subprocess
import sys

PERSONA_FILES = ["SOUL.md", "IDENTITY.md", "USER.md", "README.md"]
CONFIG_KEYS = [
    "user.name", "user.full_name", "user.email", "user.timezone", "user.github",
    "user.email_signature", "user.company",
    "assistant.name", "assistant.role", "assistant.vibe", "assistant.emoji",
    "workspace.root",
]
REQUIRED = ["user.name", "user.full_name", "assistant.name", "assistant.vibe"]
WEBMAIL = {"gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
           "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com"}
# Every token a persona file can hold: identity, workspace paths, the setup date.
PERSONA_TOKEN = re.compile(r"<(?:user|assistant|workspace)\.[a-z_]+>|<YYYY-MM-DD>")
# A template hint that follows a token: "<assistant.role> (e.g., ...)" or
# "<user.role_description> — e.g., ...". Matched against the token itself, so a
# value's own "(e.g., ...)" text is never touched. One level of nested parens.
HINT_AFTER_TOKEN = re.compile(
    r"(" + PERSONA_TOKEN.pattern + r")(?:\s*\(e\.g\.,(?:[^()]|\([^()]*\))*\)|\s+— e\.g\.,.*$)")
CODE_SPAN = re.compile(r"`[^`\n]*`")


def run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def write_file(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


# --- the Configuration block -------------------------------------------------

def config_line(key):
    return re.compile(r"^(- `" + re.escape(key) + r"` = `)([^`]*)(`.*)$", re.M)


def config_value(text, key):
    m = config_line(key).search(text)
    return m.group(2).strip() if m else None


def real(value):
    """A filled-in Configuration value: present and not a <placeholder>."""
    return value if value and not value.startswith("<") else None


def configured_date(text):
    v = config_value(text, "setup_completed")
    return v if v and re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) else None


def config_section(text):
    """(start, end) of the '## Configuration' section, or None."""
    m = re.search(r"^## Configuration.*?(?=^## (?!#)|\Z)", text, re.S | re.M)
    return (m.start(), m.end()) if m else None


def workspace(text, values=None):
    """Workspace folders from the Configuration block. The root comes from the
    block when it's filled in, else from the answers, else the default."""
    root = real(config_value(text, "workspace.root")) or (values or {}).get("workspace.root") or "workspace"
    tok = lambda key, default: real(config_value(text, key)) or default
    return {
        "root": root,
        "inbox": tok("workspace.inbox", "0-Inbox"),
        "projects": tok("workspace.projects", "1-Projects"),
        "areas": tok("workspace.areas", "2-Areas"),
        "resources": tok("workspace.resources", "4-Resources"),
        "archive": tok("workspace.archive", "5-Archive"),
    }


def templates_dir(text, values=None):
    ws = workspace(text, values)
    return os.path.join(ws["root"], ws["resources"], "templates", "persona")


# --- persona files -------------------------------------------------------------

def template_path(text, name, values=None):
    return os.path.join(templates_dir(text, values), name.replace(".md", "-template.md"))


def persona_state(text, name, values=None):
    """clean: still exactly its template (a fresh fork ships them byte-identical),
    so regenerating it loses nothing. edited: anything else, whether hand-edited,
    filled in by an earlier setup, or a copy with no git history. missing."""
    if not os.path.exists(name):
        return "missing"
    tpl = template_path(text, name, values)
    if os.path.exists(tpl) and read(tpl) == read(name):
        return "clean"
    return "edited"


def fill_persona(text, values):
    """Fill identity, workspace and date tokens, dropping the template's "e.g."
    hint that follows a token (before filling, so a value is never trimmed)."""
    out = []
    for line in text.split("\n"):
        if PERSONA_TOKEN.search(line):
            line = HINT_AFTER_TOKEN.sub(lambda m: m.group(1), line)
            line = PERSONA_TOKEN.sub(lambda m: str(values.get(m.group(0)[1:-1], m.group(0))), line)
        out.append(line)
    return "\n".join(out)


def fill_prose(text, values):
    """Names in CLAUDE.md's prose (title, load order) get real values. The
    Configuration section and anything inside a `code span` stay as written:
    those document the placeholder system that skills resolve at run time."""
    token = re.compile(r"<(?:user|assistant)\.[a-z_]+>")

    def fill(segment):
        parts, last = [], 0
        for m in CODE_SPAN.finditer(segment):
            parts.append(token.sub(lambda t: str(values.get(t.group(0)[1:-1], t.group(0))), segment[last:m.start()]))
            parts.append(m.group(0))
            last = m.end()
        parts.append(token.sub(lambda t: str(values.get(t.group(0)[1:-1], t.group(0))), segment[last:]))
        return "".join(parts)

    span = config_section(text)
    if not span:
        return fill(text)
    return fill(text[:span[0]]) + text[span[0]:span[1]] + fill(text[span[1]:])


def prose_values(values, ws, today):
    """Values for prose: workspace paths and the date added, and an unknown
    company read as "your company" rather than "—"."""
    pv = dict(values)
    for key in ["inbox", "projects", "areas", "resources", "archive"]:
        pv.setdefault("workspace." + key, ws[key])
    pv["workspace.root"] = ws["root"]
    pv["YYYY-MM-DD"] = today
    if pv.get("user.company") == "—":
        pv["user.company"] = "your company"
    return pv


# --- commands ------------------------------------------------------------------

def detect_timezone():
    tz = os.environ.get("TZ", "")
    if not tz:
        link = os.path.realpath("/etc/localtime")
        if "zoneinfo/" in link:
            tz = link.split("zoneinfo/", 1)[1]
    return tz or run(["timedatectl", "show", "-p", "Timezone", "--value"])


def detect_language():
    lang = os.environ.get("LC_ALL", "") or os.environ.get("LANG", "")
    names = {"en": "English", "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese",
             "it": "Italian", "nl": "Dutch", "ja": "Japanese", "zh": "Chinese", "ko": "Korean", "hi": "Hindi"}
    return names.get(lang[:2].lower(), "English")


def cmd_detect(_args):
    text = read("CLAUDE.md") if os.path.exists("CLAUDE.md") else ""
    email = run(["git", "config", "user.email"])
    git_name = run(["git", "config", "user.name"])
    domain = email.split("@", 1)[1].lower() if "@" in email else ""
    company_guess = domain.split(".")[0].capitalize() if domain and domain not in WEBMAIL else ""
    # The gh CLI login belongs to whoever signed in on this machine, which isn't
    # always the person in git config. Keep it only when its name or email matches.
    github, github_unmatched = "", ""
    gh = run(["gh", "api", "user", "--jq", '[.login, .name // "", .email // ""] | @tsv']).split("\t")
    if gh and gh[0]:
        same_name = len(gh) > 1 and gh[1] and gh[1].strip().lower() == git_name.strip().lower()
        same_email = len(gh) > 2 and gh[2] and email and gh[2].strip().lower() == email.strip().lower()
        if same_name or same_email:
            github = gh[0]
        else:
            github_unmatched = gh[0]
    print(json.dumps({
        "configured": configured_date(text),
        "git_name": git_name,
        "git_email": email,
        "company_guess": company_guess,
        "github": github,
        "github_unmatched": github_unmatched,
        "timezone": detect_timezone(),
        "language": detect_language(),
        "persona_files": {f: persona_state(text, f) for f in PERSONA_FILES},
        "templates_dir": templates_dir(text),
    }, indent=2))


def load_values(path):
    values = json.load(open(path, encoding="utf-8"))
    missing = [k for k in REQUIRED if not str(values.get(k, "")).strip()]
    if missing:
        sys.exit("apply.py: missing required values: " + ", ".join(missing))
    values.setdefault("workspace.root", "workspace")
    if not str(values.get("user.team", "")).strip():
        values["user.team"] = "your team"  # only used in SOUL.md's illustrative prose
    for k in CONFIG_KEYS + ["user.language", "user.role_description"]:
        if not str(values.get(k, "")).strip():
            values[k] = "—"
    return values


def set_config(text, values, today):
    """Write the identity values and setup_completed into the Configuration block.
    Returns (text, keys that had no line to write into)."""
    missing = []
    for key in CONFIG_KEYS + ["setup_completed"]:
        value = today if key == "setup_completed" else str(values[key]).replace("`", "'")
        pat = config_line(key)
        if pat.search(text):
            text = pat.sub(lambda m: m.group(1) + value + m.group(3), text, count=1)
        elif key == "setup_completed" and re.search(r"^### lifecycle[ \t]*$", text, re.M):
            text = re.sub(r"^### lifecycle[ \t]*$", "### lifecycle\n- `setup_completed` = `%s`" % today,
                          text, count=1, flags=re.M)
        else:
            missing.append(key)
    return text, missing


def cmd_write(args):
    if not os.path.exists("CLAUDE.md"):
        sys.exit("apply.py: run from the repo root (no CLAUDE.md here)")
    claude = read("CLAUDE.md")
    if configured_date(claude):
        sys.exit("apply.py: already configured (setup_completed = %s); refusing (T2)" % configured_date(claude))
    values = load_values(args.values)
    today = args.date or datetime.date.today().isoformat()
    ws = workspace(claude, values)
    pvals = prose_values(values, ws, today)
    report = {"written": [], "unchanged": [], "filled_in_place": [], "kept_untouched": [],
              "suggested": [], "missing_template": [], "folders_created": []}

    for name in PERSONA_FILES:
        target = name
        if persona_state(claude, name, values) == "edited" and name not in args.force:
            if name in args.fill:
                write_file(name, fill_persona(read(name), pvals))  # read() finishes before the write opens
                report["filled_in_place"].append(name)
                continue
            if name not in args.suggest:
                report["kept_untouched"].append(name)
                continue
            target = name + ".bootstrap-suggested"
        tpl = template_path(claude, name, values)
        if not os.path.exists(tpl):
            report["missing_template"].append(name)
            continue
        out = fill_persona(read(tpl), pvals)
        if target == name and os.path.exists(name) and read(name) == out:
            report["unchanged"].append(name)  # nothing personal in it
            continue
        write_file(target, out)
        report["suggested" if target != name else "written"].append(target)

    claude, missing = set_config(claude, values, today)
    if "setup_completed" in missing:
        sys.exit("apply.py: CLAUDE.md has no setup_completed line or '### lifecycle' heading; nothing written to it")
    write_file("CLAUDE.md", fill_prose(claude, pvals))
    report["written"].append("CLAUDE.md (Configuration)")
    report["config_keys_not_found"] = missing
    report["setup_completed"] = today

    for sub in [ws["inbox"], ws["projects"], ws["areas"], ws["archive"]] + [
            os.path.join(ws["resources"], d) for d in ["templates", "research", "reference", "meetings", "contacts"]]:
        path = os.path.join(ws["root"], sub)
        if not os.path.isdir(path):
            os.makedirs(path)
            report["folders_created"].append(path)
    print(json.dumps(report, indent=2))


def cmd_verify(args):
    problems, notes = [], []
    claude = read("CLAUDE.md")
    if not configured_date(claude):
        problems.append("setup_completed is not a date")
    span = config_section(claude)
    block = claude[span[0]:span[1]] if span else claude
    for key in CONFIG_KEYS:
        value = config_value(block, key)
        if value is None:
            problems.append("Configuration has no %s line" % key)
        elif value.startswith("<"):
            problems.append("Configuration %s is still a placeholder" % key)
    # Every persona file is checked. One the person chose to leave untouched (--kept)
    # is reported, not failed: their call, but they should know names are missing.
    for name in PERSONA_FILES:
        if not os.path.exists(name):
            continue
        left = sorted(set(m.group(0) for m in PERSONA_TOKEN.finditer(read(name))))
        if left:
            line = "%s still holds %s" % (name, ", ".join(left))
            (notes if name in args.kept else problems).append(line)
    for n in notes:
        print("verify: note: " + n + " (kept as you had it)")
    for p in problems:
        print("verify: " + p)
    if problems:
        sys.exit(1)
    print("verify: OK — Configuration resolved, persona files filled in")


def opt_in_server(note):
    """The JSON server object at the start of a .mcp.json `_notes.opt_in_*` entry
    (the rest of the note is prose), or None."""
    note = str(note).lstrip()
    if not note.startswith("{"):
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(note)
    except ValueError:
        return None
    return obj if isinstance(obj, dict) else None


def cmd_add_connectors(args):
    """Copy opt-in servers from _notes into mcpServers, then refresh Codex's config."""
    path = ".mcp.json"
    doc = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {"mcpServers": {}}
    doc.setdefault("mcpServers", {})
    notes = doc.get("_notes", {})
    added, already, no_entry = [], [], []
    for name in args.names:
        server = opt_in_server(notes.get("opt_in_" + name, ""))
        if server is None:
            no_entry.append(name)  # e.g. google_workspace: connects through /mcp, no server entry
        elif name in doc["mcpServers"]:
            already.append(name)
        else:
            doc["mcpServers"][name] = server
            added.append(name)
    codex = "not needed"
    if added:
        write_file(path, json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        codex = "no generator in this fork"
        if os.path.exists("scripts/codex-config-from-mcp.mjs"):
            try:
                rc = subprocess.run(["node", "scripts/codex-config-from-mcp.mjs"], capture_output=True, text=True)
                codex = "refreshed" if rc.returncode == 0 else "failed: " + (rc.stderr.strip() or rc.stdout.strip())
            except OSError as e:
                codex = "not refreshed (%s); run node scripts/codex-config-from-mcp.mjs later" % e.strerror
    print(json.dumps({"added": added, "already_there": already, "no_server_entry": no_entry,
                      "codex_config": codex}, indent=2))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("detect")
    w = sub.add_parser("write")
    w.add_argument("--values", required=True)
    w.add_argument("--fill", nargs="*", default=[])
    w.add_argument("--force", nargs="*", default=[])
    w.add_argument("--suggest", nargs="*", default=[])
    w.add_argument("--date")
    v = sub.add_parser("verify")
    v.add_argument("--kept", nargs="*", default=[])
    c = sub.add_parser("add-connectors")
    c.add_argument("names", nargs="+")
    args = ap.parse_args()
    {"detect": cmd_detect, "write": cmd_write, "verify": cmd_verify,
     "add-connectors": cmd_add_connectors}[args.cmd](args)


if __name__ == "__main__":
    main()
