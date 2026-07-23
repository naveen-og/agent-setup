#!/usr/bin/env python3
"""pi-bridge MCP server: hashline editing + persistent Python kernel + DAP debugging.

Stdio JSON-RPC (MCP 2024-11-05). Stdlib only, except debugpy for the debug tools.
Ported from pi extensions (hashline.ts, microvm-kernel.ts, debugger-driver.ts) as
self-consistent reimplementations — anchors are computed here, not shared with pi.
"""
import ast, contextlib, hashlib, io, json, os, signal, subprocess, sys, threading, queue, traceback

# ---------------- hashline ----------------

def _hash(lines, i):
    prev = lines[i - 1] if i > 0 else ""
    nxt = lines[i + 1] if i + 1 < len(lines) else ""
    return hashlib.sha1((prev + "\x00" + lines[i] + "\x00" + nxt).encode()).hexdigest()[:2].upper()

def _read_lines(path):
    with open(path, encoding="utf-8") as f:
        return f.read().split("\n")

def _anchors(lines):
    return [f"{i + 1}#{_hash(lines, i)}" for i in range(len(lines))]

def read_hashline(path, offset=1, limit=None):
    lines = _read_lines(path)
    a = _anchors(lines)
    end = len(lines) if limit is None else min(len(lines), offset - 1 + int(limit))
    out = [f"{a[i]}│ {lines[i]}" for i in range(int(offset) - 1, end)]
    return "\n".join(out) or "(empty file)"

def _resolve(anchor, lines):
    n, h = anchor.split("#")
    i = int(n) - 1
    if i < 0 or i >= len(lines) or _hash(lines, i) != h.upper():
        raise ValueError(f"stale anchor {anchor}: re-read the file")
    return i

def edit_hashline(path, edits):
    lines = _read_lines(path)
    spans = []
    for e in edits:
        s, t = e["range"]
        si, ti = _resolve(s, lines), _resolve(t, lines)
        if ti < si:
            raise ValueError(f"range reversed: {s}..{t}")
        spans.append((si, ti, e["lines"]))
    spans.sort()
    for (a, b, _), (c, _d, _e) in zip(spans, spans[1:]):
        if c <= b:
            raise ValueError("overlapping edits")
    for si, ti, new in reversed(spans):
        lines[si:ti + 1] = new
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return f"applied {len(spans)} edit(s); re-read before further hashline edits"

def insert_hashline(path, placement, new_lines, anchor=None):
    if anchor is None:
        if os.path.exists(path) and _read_lines(path) != [""]:
            raise ValueError("anchor required for non-empty file")
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(new_lines))
        return f"wrote {len(new_lines)} line(s)"
    lines = _read_lines(path)
    i = _resolve(anchor, lines)
    at = i if placement == "before" else i + 1
    lines[at:at] = new_lines
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return f"inserted {len(new_lines)} line(s) at line {at + 1}"

# ---------------- persistent python kernel ----------------

KERNEL_NS = {"__name__": "__main__"}
KERNEL_TIMEOUT = 10  # ponytail: no VM/namespace sandbox here; CC's permission model is the boundary

def _alarm(_sig, _frm):
    raise TimeoutError(f"execution exceeded {KERNEL_TIMEOUT}s")

def py_exec(code):
    buf = io.StringIO()
    tree = ast.parse(code)
    last_expr = None
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last_expr = ast.Expression(tree.body.pop(-1).value)
    old = signal.signal(signal.SIGALRM, _alarm)
    signal.alarm(KERNEL_TIMEOUT)
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            exec(compile(tree, "<cell>", "exec"), KERNEL_NS)
            if last_expr is not None:
                v = eval(compile(last_expr, "<cell>", "eval"), KERNEL_NS)
                if v is not None:
                    print(repr(v), file=buf)
    except Exception:
        print(traceback.format_exc(limit=8), file=buf)
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)
    return buf.getvalue() or "(no output)"

# ---------------- DAP (python via debugpy) ----------------

class Dap:
    def __init__(self):
        self.proc = None
        self.seq = 0
        self.pending = {}
        self.events = queue.Queue()
        self.thread_id = None
        self.output = []
        self.breakpoints = {}  # file -> set(lines)

    def start(self, program, args=None, cwd=None, stop_on_entry=False):
        self.stop()
        bps = self.breakpoints
        self.__init__()
        self.breakpoints = bps
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "debugpy.adapter"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        threading.Thread(target=self._reader, daemon=True).start()
        self.request("initialize", {"adapterID": "pi-bridge", "linesStartAt1": True,
                                    "columnsStartAt1": True, "supportsRunInTerminalRequest": False})
        self.request("launch", {"program": program, "args": args or [], "cwd": cwd or os.path.dirname(program),
                                "console": "internalConsole", "stopOnEntry": stop_on_entry,
                                "justMyCode": True}, wait=False)
        self._wait_event("initialized")
        for f, ls in self.breakpoints.items():
            self._set_bps(f, ls)
        self.request("configurationDone")
        return self._wait_stop()  # first breakpoint hit, entry stop, or program end

    def _reader(self):
        f = self.proc.stdout
        while True:
            line = f.readline()
            if not line:
                return
            if not line.startswith(b"Content-Length"):
                continue
            n = int(line.split(b":")[1])
            f.readline()
            msg = json.loads(f.read(n))
            if msg["type"] == "response":
                self.pending[msg["request_seq"]] = msg
            elif msg["type"] == "event":
                if msg["event"] == "output":
                    if msg["body"].get("category") != "telemetry":
                        self.output.append(msg["body"].get("output", ""))
                else:
                    self.events.put(msg)

    def request(self, cmd, args=None, wait=True, timeout=10):
        self.seq += 1
        seq = self.seq
        payload = json.dumps({"seq": seq, "type": "request", "command": cmd, "arguments": args or {}}).encode()
        self.proc.stdin.write(b"Content-Length: %d\r\n\r\n" % len(payload) + payload)
        self.proc.stdin.flush()
        if not wait:
            return None
        import time
        t0 = time.time()
        while seq not in self.pending:
            if time.time() - t0 > timeout:
                raise TimeoutError(f"no response to {cmd}")
            time.sleep(0.02)
        r = self.pending.pop(seq)
        if not r.get("success", False):
            raise RuntimeError(f"{cmd} failed: {r.get('message')}")
        return r.get("body") or {}

    def _wait_event(self, name, timeout=10):
        import time
        t0 = time.time()
        while True:
            try:
                ev = self.events.get(timeout=max(0.05, timeout - (time.time() - t0)))
            except queue.Empty:
                raise TimeoutError(f"no {name} event")
            if ev["event"] == name:
                return ev  # unrelated events are dropped

    def _wait_stop(self, timeout=15):
        import time
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                ev = self.events.get(timeout=0.5)
            except queue.Empty:
                continue
            if ev["event"] == "stopped":
                self.thread_id = ev["body"].get("threadId")
                out, self.output = "".join(self.output), []
                frames = self.request("stackTrace", {"threadId": self.thread_id, "levels": 1})["stackFrames"]
                top = frames[0] if frames else {}
                return (f"stopped: {ev['body'].get('reason')} at "
                        f"{top.get('source', {}).get('path')}:{top.get('line')}"
                        + (f"\noutput:\n{out}" if out.strip() else ""))
            if ev["event"] in ("terminated", "exited"):
                out, self.output = "".join(self.output), []
                self.stop()
                return "program finished" + (f"\noutput:\n{out}" if out.strip() else "")
        return "still running (no stop within timeout)"

    def _set_bps(self, file, lines):
        return self.request("setBreakpoints", {
            "source": {"path": file}, "breakpoints": [{"line": l} for l in sorted(lines)]})

    def breakpoint(self, action, file=None, line=None):
        if action == "list":
            return json.dumps({f: sorted(l) for f, l in self.breakpoints.items()}) or "{}"
        ls = self.breakpoints.setdefault(file, set())
        (ls.add if action == "set" else ls.discard)(int(line))
        if self.proc:
            self._set_bps(file, ls)
        return f"{action} {file}:{line}"

    def step(self, action):
        if not self.proc:
            return "no session"
        cmd = {"continue": "continue", "stepIn": "stepIn", "stepOver": "next",
               "stepOut": "stepOut", "pause": "pause"}[action]
        self.request(cmd, {"threadId": self.thread_id or 1})
        return self._wait_stop()

    def inspect(self, what, expression=None, frame_id=None):
        if not self.proc:
            return "no session"
        if what == "stack":
            fs = self.request("stackTrace", {"threadId": self.thread_id or 1})["stackFrames"]
            return "\n".join(f"[{f['id']}] {f['name']} {f.get('source', {}).get('path')}:{f['line']}" for f in fs)
        if frame_id is None:
            fs = self.request("stackTrace", {"threadId": self.thread_id or 1, "levels": 1})["stackFrames"]
            frame_id = fs[0]["id"]
        if what == "evaluate":
            return self.request("evaluate", {"expression": expression, "frameId": frame_id,
                                             "context": "repl"}).get("result", "")
        scopes = self.request("scopes", {"frameId": frame_id})["scopes"]
        out = []
        for s in scopes:
            vs = self.request("variables", {"variablesReference": s["variablesReference"]})["variables"]
            out.append(s["name"] + ":\n" + "\n".join(f"  {v['name']} = {v['value']}" for v in vs[:50]))
        return "\n".join(out)

    def stop(self):
        if self.proc:
            try:
                self.proc.kill()
            except Exception:
                pass
            self.proc = None
        return "terminated"

DAP = Dap()

# ---------------- MCP plumbing ----------------

def S(**props):
    req = [k for k, v in props.items() if v.pop("_req", False)]
    return {"type": "object", "properties": props, "required": req}

TOOLS = [
    ("read_hashline", "Read a file with LINE#HH anchors for hashline editing. Anchors are needed by edit_hashline/insert_hashline and go stale after any write.",
     S(path={"type": "string", "_req": True}, offset={"type": "number"}, limit={"type": "number"}),
     lambda a: read_hashline(a["path"], a.get("offset", 1), a.get("limit"))),
    ("edit_hashline", "Replace or delete anchored line ranges. edits[]: {range:[startAnchor,endAnchor], lines:[...]} (empty lines deletes). Stale anchor aborts the whole batch.",
     S(path={"type": "string", "_req": True}, edits={"type": "array", "_req": True}),
     lambda a: edit_hashline(a["path"], a["edits"])),
    ("insert_hashline", "Insert raw lines before/after an anchor from a recent read_hashline. Omit anchor only to seed an empty/new file.",
     S(path={"type": "string", "_req": True}, placement={"type": "string", "enum": ["before", "after"], "_req": True},
       lines={"type": "array", "_req": True}, anchor={"type": "string"}),
     lambda a: insert_hashline(a["path"], a["placement"], a["lines"], a.get("anchor"))),
    ("py_exec", "Execute Python in a persistent kernel (variables/imports survive across calls). 10s limit. Prefer over bash for computation, data analysis, text processing.",
     S(code={"type": "string", "_req": True}),
     lambda a: py_exec(a["code"])),
    ("debug_launch", "Start a Python DAP debug session (debugpy) and launch a program.",
     S(program={"type": "string", "_req": True}, args={"type": "array"}, cwd={"type": "string"},
       stopOnEntry={"type": "boolean"}),
     lambda a: DAP.start(a["program"], a.get("args"), a.get("cwd"), a.get("stopOnEntry", False))),
    ("debug_breakpoint", "Set/clear/list breakpoints. Persist across relaunch.",
     S(action={"type": "string", "enum": ["set", "clear", "list"], "_req": True},
       file={"type": "string"}, line={"type": "number"}),
     lambda a: DAP.breakpoint(a["action"], a.get("file"), a.get("line"))),
    ("debug_step", "continue/pause/stepIn/stepOver/stepOut; waits for next stop or completion.",
     S(action={"type": "string", "enum": ["continue", "pause", "stepIn", "stepOver", "stepOut"], "_req": True}),
     lambda a: DAP.step(a["action"])),
    ("debug_inspect", "Inspect stopped target: stack, variables, or evaluate an expression.",
     S(what={"type": "string", "enum": ["stack", "variables", "evaluate"], "_req": True},
       expression={"type": "string"}, frameId={"type": "number"}),
     lambda a: DAP.inspect(a["what"], a.get("expression"), a.get("frameId"))),
    ("debug_terminate", "Kill the debuggee and adapter.", S(), lambda a: DAP.stop()),
]

def main():
    handlers = {t[0]: t[3] for t in TOOLS}
    for line in sys.stdin:
        if not line.strip():
            continue
        msg = json.loads(line)
        mid, method = msg.get("id"), msg.get("method")
        if mid is None:
            continue  # notification
        try:
            if method == "initialize":
                result = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                          "serverInfo": {"name": "pi-bridge", "version": "1.0.0"}}
            elif method == "tools/list":
                result = {"tools": [{"name": n, "description": d, "inputSchema": s} for n, d, s, _ in TOOLS]}
            elif method == "tools/call":
                name = msg["params"]["name"]
                text = handlers[name](msg["params"].get("arguments") or {})
                result = {"content": [{"type": "text", "text": str(text)}]}
            else:
                result = {}
            out = {"jsonrpc": "2.0", "id": mid, "result": result}
        except Exception as e:
            out = {"jsonrpc": "2.0", "id": mid,
                   "result": {"content": [{"type": "text", "text": f"error: {e}"}], "isError": True}}
        sys.stdout.write(json.dumps(out) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
