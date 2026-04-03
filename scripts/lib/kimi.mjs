/**
 * Kimi Wire protocol client.
 *
 * Communicates with `kimi --wire` subprocess via stdin/stdout JSON-RPC 2.0.
 * Each JSON message is newline-delimited (NDJSON).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

const KIMI_BIN = process.env.KIMI_BIN || "kimi";

/**
 * Spawn a kimi --wire subprocess and return a WireClient handle.
 */
export function spawnKimiWire({ workDir, session, yolo = true, model, thinking } = {}) {
  const args = ["--wire"];
  if (workDir) args.push("--work-dir", workDir);
  if (session) args.push("--session", session);
  if (yolo) args.push("--yolo");
  if (model) args.push("--model", model);
  if (thinking === true) args.push("--thinking");
  if (thinking === false) args.push("--no-thinking");

  const child = spawn(KIMI_BIN, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: workDir || process.cwd(),
  });

  return new WireClient(child);
}

/**
 * JSON-RPC 2.0 client over stdin/stdout of a kimi --wire child process.
 */
export class WireClient {
  constructor(child) {
    this._child = child;
    this._pending = new Map();       // id -> { resolve, reject }
    this._eventHandlers = [];        // (event) => void
    this._requestHandlers = [];      // (request) => response
    this._nextId = 1;
    this._alive = true;
    this._buffer = "";

    // Read NDJSON from stdout
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => this._onLine(line));

    child.on("exit", (code) => {
      this._alive = false;
      // Reject all pending
      for (const [id, { reject }] of this._pending) {
        reject(new Error(`kimi process exited with code ${code}`));
      }
      this._pending.clear();
    });

    child.on("error", (err) => {
      this._alive = false;
    });
  }

  get alive() {
    return this._alive;
  }

  get pid() {
    return this._child.pid;
  }

  /**
   * Send a JSON-RPC request and await the response.
   */
  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this._alive) {
        reject(new Error("kimi process is not running"));
        return;
      }
      const id = String(this._nextId++);
      const msg = { jsonrpc: "2.0", method, params, id };
      this._pending.set(id, { resolve, reject });
      this._write(msg);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  notify(method, params = {}) {
    const msg = { jsonrpc: "2.0", method, params };
    this._write(msg);
  }

  /**
   * Register a handler for event notifications from kimi.
   */
  onEvent(handler) {
    this._eventHandlers.push(handler);
  }

  /**
   * Register a handler for requests from kimi (approval, tool calls, etc.).
   * Handler should return a result object or throw.
   */
  onRequest(handler) {
    this._requestHandlers.push(handler);
  }

  /**
   * Send initialize handshake.
   */
  async initialize({ clientName = "kimi-plugin-cc", protocolVersion = "1.7" } = {}) {
    return this.request("initialize", {
      protocol_version: protocolVersion,
      client_info: { name: clientName, version: "0.1.0" },
      capabilities: {},
      external_tools: [],
    });
  }

  /**
   * Send a prompt (user turn) and collect all events until turn completes.
   * Returns { status, events, text } where text is the concatenated assistant text.
   */
  async prompt(userInput, { onEvent } = {}) {
    const events = [];
    let textParts = [];

    const eventCollector = (event) => {
      events.push(event);
      if (onEvent) onEvent(event);

      // Collect text content — Wire: params.type=ContentPart, params.payload.type=text
      if (event.params?.type === "ContentPart" && event.params?.payload?.type === "text") {
        textParts.push(event.params.payload.text);
      }
    };
    this._eventHandlers.push(eventCollector);

    try {
      const result = await this.request("prompt", { user_input: userInput });
      return {
        status: result?.status || "finished",
        events,
        text: textParts.join(""),
        raw: result,
      };
    } finally {
      const idx = this._eventHandlers.indexOf(eventCollector);
      if (idx !== -1) this._eventHandlers.splice(idx, 1);
    }
  }

  /**
   * Cancel the active turn.
   */
  async cancel() {
    return this.request("cancel");
  }

  /**
   * Kill the subprocess.
   */
  kill() {
    this._alive = false;
    try {
      this._child.kill("SIGTERM");
    } catch {}
  }

  // --- internal ---

  _write(msg) {
    try {
      this._child.stdin.write(JSON.stringify(msg) + "\n");
    } catch (err) {
      // stdin may be closed
    }
  }

  _onLine(line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // ignore non-JSON lines
    }

    // Response to our request
    if (msg.id && this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
      return;
    }

    // Notification from kimi (event)
    if (!msg.id && msg.method) {
      for (const handler of this._eventHandlers) {
        try { handler(msg); } catch {}
      }
      return;
    }

    // Request from kimi (needs response) — e.g. ApprovalRequest
    if (msg.id && msg.method) {
      this._handleAgentRequest(msg);
      return;
    }
  }

  async _handleAgentRequest(msg) {
    // Default: auto-approve everything (yolo mode handles most, but just in case)
    let result = { approved: true };
    for (const handler of this._requestHandlers) {
      try {
        const r = await handler(msg);
        if (r !== undefined) { result = r; break; }
      } catch {}
    }
    // Send response
    this._write({ jsonrpc: "2.0", id: msg.id, result });
  }
}

export { KIMI_BIN };
