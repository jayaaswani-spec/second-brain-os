#!/usr/bin/env python3
"""collect-memories.py — READ-ONLY. Lists every memory line Claude and Codex already hold
about the user, one JSON object per line on stdout, so migrate-work can route them.

  claude-global   ~/.claude/CLAUDE.md                       (honors $CLAUDE_CONFIG_DIR)
  claude-memory   ~/.claude/projects/<folder>/memory/*.md   (Claude Code auto-memory; MEMORY.md is
                                                            only an index of these files, so skipped)
  codex-global    ~/.codex/AGENTS.md                        (honors $CODEX_HOME)
  codex-memory    ~/.codex/memories*/memory_summary.md      (Codex's own summary, newest version only;
                                                            raw notes and rollout summaries are its
                                                            working files, skipped)

Each item: id, source, file, line (1-based, so every written line traces back), text (the source
line as written, minus list markers and Codex's internal file pointers), hint (the store's own
label: user / feedback / project / reference / profile / preference / tip / project-note, or null),
section, project_key (the folder a project memory belongs to, normalized like the session
enumerator), sensitive (looks like a credential: its text is never emitted, only file and line), exists_in (workspace files that
already contain this text), same_as (an earlier item with the same text).

Usage: collect-memories.py [--workspace-root <abs path>] [--sessions <enumerate-sessions.sh output>]
stderr: one JSON line saying which stores were read. Never writes anything else.
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

HOME = os.path.expanduser("~")
CLAUDE = Path(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(HOME, ".claude"))
CODEX = Path(os.environ.get("CODEX_HOME") or os.path.join(HOME, ".codex"))

TMP_RE = re.compile(r"^(/private)?/tmp(/|$)|^(/private)?/var/folders/[^/]+/[^/]+/T/|/scratchpad(/|$)")
# Credential shapes. A match means the line is held back and its text never emitted. Errs toward
# holding back: a false positive costs one line the user can add by hand; a miss puts a key in a file.
SECRET_RE = re.compile(
    r"\bsk[-_](?:live_|test_|proj-|ant-)?[A-Za-z0-9_-]{16,}"           # OpenAI, Anthropic, Stripe
    r"|\bgh[opsur]_[A-Za-z0-9]{20,}|\bgithub_pat_\w{20,}"               # GitHub
    r"|\bxox[a-z]-[A-Za-z0-9-]{10,}|\bxapp-[A-Za-z0-9-]{10,}"           # Slack
    r"|\bAKIA[0-9A-Z]{16}|\bAIza[0-9A-Za-z_-]{30,}"                     # AWS, Google
    r"|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"                     # JWT
    r"|-----BEGIN [A-Z ]*PRIVATE KEY|\bBearer\s+[A-Za-z0-9._~+/-]{16,}"
    r"|\b[a-z][a-z0-9+.-]*://[^\s/:@]+:[^\s/@]+@"                        # user:password@host URLs
    r"|(?<![A-Za-z0-9])[A-Za-z0-9_]*(api[_-]?key|secret|token|passw(or)?d|pwd|credential)s?"
    r"\s*[:=]\s*['\"]?[^\s'\"]{6,}"                                      # NAME_KEY=value, password: x
    r"|\b(password|passcode|pin)\s+(is|was)\s+\S{4,}", re.I)
BULLET_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?")
CODEX_POINTER_RE = re.compile(r"^rollout_summaries/\S+\s+[—–-]+\s+")


def project_key(path):
    """Same rules as enumerate-sessions.sh: no key for sandboxes, temp and container dirs."""
    if not path:
        return None
    if re.search(r"^/sessions/|/local-agent-mode-sessions/|/\.codex/", path) or TMP_RE.search(path):
        return None
    if path.startswith(HOME + "/Documents/Codex/"):
        return None
    if path in (HOME, HOME + "/Desktop", HOME + "/Downloads", HOME + "/Documents"):
        return None
    return re.sub(r"/\.claude/worktrees/[^/]+$", "", path.rstrip("/"))


def norm(text):
    """Case and punctuation folded for duplicate checks; signs kept, so UTC+1 and UTC-1 differ."""
    return re.sub(r"[^a-z0-9+-]+", " ", text.lower().replace("\u2019", "'")).strip()


def read_lines(path):
    try:
        with open(path, encoding="utf-8-sig", errors="replace") as f:
            return f.read().splitlines()
    except OSError:
        return None


def prose_items(lines):
    """Bullets and prose lines of a plain instructions file: (line_no, text, section)."""
    out, section, fence, fm, comment = [], None, False, False, False
    for i, raw in enumerate(lines, 1):
        s = raw.strip()
        if i == 1 and s == "---":
            fm = True
            continue
        if fm:
            fm = s != "---"
            continue
        if s.startswith("```") or s.startswith("~~~"):
            fence = not fence
            continue
        if comment:
            comment = "-->" not in s
            continue
        if s.startswith("<!--"):
            comment = "-->" not in s
            continue
        if (fence or not s or s.startswith("@") or s.startswith("|") or s.startswith(">")
                or raw.startswith("    ") and not BULLET_RE.match(raw) or set(s) <= set("-=*_|: ")):
            continue
        if s.startswith("#"):
            section = s.lstrip("#").strip()
            continue
        text = BULLET_RE.sub("", s).strip()
        if len(text) >= 3:
            out.append((i, text, section))
    return out


def frontmatter(lines):
    """Tiny YAML subset: top-level `key: value` plus one nested level. Returns (dict, line_of_key, body_start)."""
    data, where, parent = {}, {}, None
    if not lines or lines[0].strip() != "---":
        return data, where, 0
    for i in range(1, len(lines)):
        raw = lines[i]
        if raw.strip() == "---":
            return data, where, i + 1
        m = re.match(r"^(\s*)([A-Za-z_][\w-]*):\s*(.*)$", raw)
        if not m:
            continue
        indent, key, val = m.groups()
        val = val.strip()
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if val[:1] in (">", "|") or (val and nxt[:1] in (" ", "\t") and not re.match(r"^\s+[A-Za-z_][\w-]*:", nxt)
                                     and nxt.strip() != "---"):
            val = "\0multiline"  # a block or wrapped value spans lines: not one quotable line
        elif len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            # YAML quoting is encoding, not content: unescape so the written line reads as meant.
            val = val[1:-1].replace('\\"', '"').replace("\\\\", "\\") if val[0] == '"' else val[1:-1].replace("''", "'")
        if indent and parent:
            data.setdefault(parent, {})
            if isinstance(data[parent], dict):
                data[parent][key] = val
            where[parent + "." + key] = i + 1
        else:
            parent = key if val == "" else None
            data[key] = val if val != "" else {}
            where[key] = i + 1
    return data, where, 0


def folder_cwd(folder):
    """The real folder a Claude projects/<encoded> dir belongs to, read from its transcripts' cwd.
    Never decode the folder name: '/', '.' and spaces all became '-'."""
    def mtime(p):
        try:
            return p.stat().st_mtime
        except OSError:  # dangling link, or deleted by cleanup mid-run
            return 0
    for t in sorted(folder.glob("*.jsonl"), key=mtime, reverse=True)[:3]:
        try:
            with open(t, encoding="utf-8", errors="replace") as f:
                for n, line in enumerate(f):
                    if n > 200:
                        break
                    if '"cwd"' in line:
                        try:
                            cwd = json.loads(line).get("cwd")
                        except ValueError:
                            continue
                        if cwd:
                            return cwd
        except OSError:
            continue
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace-root", default="")
    ap.add_argument("--sessions", default="", help="enumerate-sessions.sh output, to place memories of "
                    "folders whose transcripts are gone")
    args = ap.parse_args()
    ws = args.workspace_root.rstrip("/")
    items, stores, unreadable = [], {}, 0

    # Claude names a project's folder by replacing every character outside [A-Za-z0-9] with '-'.
    # That can't be reversed, but known paths can be encoded forward and compared.
    known = {}
    if args.sessions:
        for l in read_lines(args.sessions) or []:
            try:
                row = json.loads(l)
            except ValueError:
                continue
            for pth in (row.get("project_key"), row.get("cwd")):
                if pth:
                    known.setdefault(re.sub(r"[^A-Za-z0-9]", "-", pth), pth)

    def add(source, file, line, text, hint=None, section=None, key=None, cwd_known=True):
        items.append({"id": "m%d" % (len(items) + 1), "source": source, "file": str(file), "line": line,
                      "text": text, "hint": hint, "section": section, "project_key": key,
                      "project_folder_known": cwd_known,
                      "in_workspace": bool(ws and key and (key == ws or key.startswith(ws + "/"))),
                      "is_workspace_root": bool(ws and key == ws)})

    # 1. global instruction files
    for source, path in (("claude-global", CLAUDE / "CLAUDE.md"), ("codex-global", CODEX / "AGENTS.md")):
        lines = read_lines(path) if path.is_file() else None
        stores[source.replace("-", "_")] = "read" if lines is not None else "absent"
        for n, text, section in prose_items(lines or []):
            add(source, path, n, text, section=section)

    # 2. Claude Code auto-memory, one memory per file
    folders = 0
    projects = CLAUDE / "projects"
    if projects.is_dir():
        for mem_dir in sorted(projects.glob("*/memory")):  # glob, never `ls`: folder names start with '-'
            files = sorted(p for p in mem_dir.glob("*.md") if p.name != "MEMORY.md")
            if not files:
                continue
            folders += 1
            cwd = folder_cwd(mem_dir.parent) or known.get(mem_dir.parent.name)
            key = project_key(cwd)
            for f in files:
                lines = read_lines(f)
                if lines is None:
                    unreadable += 1
                if not lines:
                    continue
                fm, where, body = frontmatter(lines)
                # A dated file with no frontmatter is a journal kept in the folder, not a memory.
                if not fm and re.match(r"\d{4}-\d{2}-\d{2}", f.stem):
                    continue
                meta = fm.get("metadata") if isinstance(fm.get("metadata"), dict) else {}
                hint = (meta.get("type") or (fm.get("type") if isinstance(fm.get("type"), str) else "") or None)
                text, line = fm.get("description") if isinstance(fm.get("description"), str) else "", where.get("description")
                if text.startswith("\0"):
                    text = ""
                if not text:
                    for i in range(body, len(lines)):
                        s = lines[i].strip()
                        if s and not s.startswith("#") and s != "---":
                            text, line = BULLET_RE.sub("", s), i + 1
                            break
                if text:
                    add("claude-memory", f, line, text, hint=hint, section=fm.get("name") or f.stem,
                        key=key, cwd_known=cwd is not None)
    stores["claude_memory"] = "read" if folders else ("absent" if not projects.is_dir() else "empty")

    # 3. Codex memory summaries
    # Codex keeps one summary per memory version (memories/, memories_v2/, ...). Only the newest is
    # current; reading all of them would import stale facts beside new ones.
    def mtime(p):
        try:
            return p.stat().st_mtime
        except OSError:
            return 0
    found = sorted(CODEX.glob("memories*/memory_summary.md"), key=mtime, reverse=True)
    summaries = found[:1]
    stores["codex_memory"] = "read" if summaries else "absent"
    hints = {"user profile": "profile", "user preferences": "preference", "general tips": "tip",
             "what's in memory": "project-note", "older memory topics": "project-note"}
    for path in summaries:
        lines = read_lines(path)
        if lines is None:
            unreadable += 1
            lines = []
        top, sub, fence = None, None, False
        for i, raw in enumerate(lines, 1):
            s = raw.strip()
            if s.startswith("```"):
                fence = not fence
                continue
            if fence or not s:
                continue
            if s.startswith("## ") and not s.startswith("### "):
                top, sub, folder = hints.get(s[3:].strip().lower().replace("\u2019", "'")), None, None
                continue
            if s.startswith("#"):
                head = s.lstrip("#").strip()
                if s.startswith("### "):
                    sub, folder = head, (head if head.startswith("/") else None)
                elif head.startswith("/"):  # a path heading one level down names the folder
                    folder = head
                continue
            if top is None:
                continue
            text = CODEX_POINTER_RE.sub("", BULLET_RE.sub("", s)).strip()
            if len(text) < 3:
                continue
            key = project_key(folder) if top == "project-note" else None
            add("codex-memory", path, i, text, hint=top,
                section=sub if top == "project-note" else None, key=key,
                cwd_known=not (top == "project-note" and not folder))

    # 4. flags: credentials, already in the workspace, repeated across stores
    existing = {}
    if ws:
        root = Path(ws)
        cfg = read_lines(root / "CLAUDE.md") or []
        # folder names from the Configuration; a missing value or a <...> placeholder keeps the default
        names = {"root": "workspace", "projects": "1-Projects", "areas": "2-Areas", "archive": "5-Archive"}
        for l in cfg:
            m = re.match(r"^- `workspace\.(root|projects|areas|archive)` = `([^`<]+)`", l)
            if m:
                names[m.group(1)] = m.group(2)
        wroot = names["root"]
        cands = [root / n for n in ("USER.md", "SOUL.md", "IDENTITY.md", "CLAUDE.md", "memory.md")]
        for bucket in (names["projects"], names["areas"], names["archive"]):
            cands += sorted((root / wroot / bucket).glob("*/memory.md")) + sorted((root / wroot / bucket).glob("*/CLAUDE.md"))
        for p in cands:
            body = read_lines(p)
            if body is not None:
                existing[str(p.relative_to(root))] = " " + norm(" ".join(body)) + " "
    seen = {}
    for it in items:
        it["sensitive"] = bool(SECRET_RE.search(it["text"]))
        n = norm(it["text"])
        if it["sensitive"]:
            it["text"] = None  # never emitted: the row keeps only its file and line
        it["exists_in"] = [p for p, body in existing.items() if len(n) >= 12 and (" " + n + " ") in body]
        it["same_as"] = seen.get(n) if len(n) >= 12 else None
        if len(n) >= 12:
            seen.setdefault(n, it["id"])
        print(json.dumps(it, ensure_ascii=False))
    print(json.dumps({"memory_stores": stores, "items": len(items), "claude_memory_folders": folders,
                      "unreadable_files": unreadable,
                      "codex_summaries_skipped": [str(p) for p in found[1:]]}), file=sys.stderr)


if __name__ == "__main__":
    main()
