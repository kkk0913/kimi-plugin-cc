/**
 * Broker client — connects to the broker via Unix socket and sends JSON-RPC.
 */
import { connect } from "node:net";
import { createInterface } from "node:readline";
import { getBrokerSocketPath } from "./broker-endpoint.mjs";

/**
 * Connect to the broker and return a BrokerClient handle.
 */
export async function connectToBroker() {
  const socketPath = await getBrokerSocketPath();
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Broker connection timeout"));
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(new BrokerClient(socket));
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Cannot connect to broker: ${err.message}`));
    });
  });
}

export class BrokerClient {
  constructor(socket) {
    this._socket = socket;
    this._pending = new Map();
    this._eventHandlers = [];
    this._nextId = 1;

    const rl = createInterface({ input: socket });
    rl.on("line", (line) => this._onLine(line));

    socket.on("error", () => this._cleanup("socket error"));
    socket.on("close", () => this._cleanup("socket closed"));
  }

  /**
   * Send a JSON-RPC request and await the response.
   */
  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this._nextId++);
      const msg = { jsonrpc: "2.0", method, params, id };
      this._pending.set(id, { resolve, reject });
      this._write(msg);
    });
  }

  /**
   * Send a prompt to kimi via the broker.
   * Collects streamed events and returns { status, text, events }.
   */
  async prompt(userInput, { onEvent } = {}) {
    const events = [];
    const textParts = [];

    const collector = (msg) => {
      events.push(msg);
      if (onEvent) onEvent(msg);

      // Collect text content — Wire event: params.type=ContentPart, params.payload.type=text
      if (msg.params?.type === "ContentPart" && msg.params?.payload?.type === "text") {
        textParts.push(msg.params.payload.text);
      }
    };
    this._eventHandlers.push(collector);

    try {
      const result = await this.request("prompt", { user_input: userInput });
      return {
        status: result?.status || "finished",
        text: textParts.join(""),
        events,
        raw: result,
      };
    } finally {
      const idx = this._eventHandlers.indexOf(collector);
      if (idx !== -1) this._eventHandlers.splice(idx, 1);
    }
  }

  /**
   * Ping the broker to check health.
   */
  async ping() {
    const result = await this.request("broker/ping");
    return result;
  }

  /**
   * Get broker status.
   */
  async status() {
    return this.request("broker/status");
  }

  /**
   * Cancel the active kimi turn.
   */
  async cancel() {
    return this.request("cancel");
  }

  /**
   * Close the connection.
   */
  close() {
    this._socket.destroy();
  }

  // --- internal ---

  _write(msg) {
    try {
      this._socket.write(JSON.stringify(msg) + "\n");
    } catch {}
  }

  _onLine(line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch { return; }

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

    // Event/notification from broker (forwarded from kimi)
    for (const handler of this._eventHandlers) {
      try { handler(msg); } catch {}
    }
  }

  _cleanup(reason) {
    for (const [, { reject }] of this._pending) {
      reject(new Error(reason));
    }
    this._pending.clear();
  }
}
