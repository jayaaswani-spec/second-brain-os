"""Stand-in for anthropic.Anthropic() when no API key is set: answers messages.create() through `claude -p`,
which uses the same sign-in as run_eval.py's trigger tests. Thinking is not requested; text comes back as one block."""

import json
import os
import subprocess
from types import SimpleNamespace


def _text(content) -> str:
    if isinstance(content, str):
        return content
    return "\n".join(part.get("text", "") for part in content if isinstance(part, dict))


class _Messages:
    def create(self, model=None, messages=(), **_ignored):
        turns = list(messages)
        if len(turns) == 1:
            prompt = _text(turns[0]["content"])
        else:
            prompt = "\n\n".join(f"<{m['role']}>\n{_text(m['content'])}\n</{m['role']}>" for m in turns)
            prompt += "\n\nContinue the conversation: reply as the assistant to the last user turn."
        cmd = ["claude", "-p", prompt, "--output-format", "json", "--allowedTools", ""]
        if model:
            cmd += ["--model", model]
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        out = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=600)
        try:
            text = json.loads(out.stdout).get("result", "")
        except json.JSONDecodeError:
            text = out.stdout
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


class CliAnthropic:
    def __init__(self):
        self.messages = _Messages()


def make_client():
    """The SDK client when ANTHROPIC_API_KEY is set, otherwise the claude CLI stand-in."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        return anthropic.Anthropic()
    return CliAnthropic()
