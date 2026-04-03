#!/usr/bin/env node
/**
 * app-server-broker.mjs — JSON-RPC broker between Claude Code commands and a
 * single long-lived `kimi --wire` subprocess.
 *
 * Architecture:
 *   [Claude Code command] --(Unix socket)--> [Broker] --(stdin/stdout)--> [kimi --wire]
 *
 * The broker:
 *   1. Spawns one `kimi --wire` process on startup
 *   2. Listens on a Unix socket for client connections
 *   3. Routes client JSON-RPC requests to the kimi process
 *   4. Routes kimi responses/events back to the originating client
 *   5. Enforces single-request-at-a-time (queues concurrent requests)
 */

import { createServer, createConnection } from "node:net";
import { createInterface } from "node:readline";
import { parseArgs } from "./lib/args.mjs";
import { getBrokerSocketPath } from "./lib/broker-endpoint.mjs";
import { spawnKimiWire } from "./lib/kimi.mjs";
import { removeFile, existsSync } from "./lib/fs.mjs";

const { flags } = parseArgs(process.argv.slice(2));

const workDir = flags["work-dir"] || process.cwd();
const model = flags.model || undefined;
const session = flags.session || undefined;

// --- State ---
let kimiClient = null;
let activeClient = null;      // The client currently holding the "turn"
let requestQueue = [];         // Queued client requests waiting for the turn
let activeRequestId = null;    // The JSON-RPC id of the current in-flight prompt

// --- Spawn kimi --wire ---
async function startKimi() {
  kimiClient = spawnKimiWire({ workDir, session, yolo: true, model });

  // Forward events from kimi to the active client
  kimiClient.onEvent((event) => {
    if (activeClient && !activeClient.destroyed) {
      writeToSocket(activeClient, event);
    }
  });

  // Handle agent requests (approval, etc.) — auto-approve in yolo mode
  kimiClient.onRequest((req) => {
    return { approved: true };
  });

  // Initialize the Wire handshake
  try {
    const initResult = await kimiClient.initialize({ clientName: "kimi-plugin-cc-broker" });
    log(`kimi Wire initialized: ${JSON.stringify(initResult)}`);
  } catch (err) {
    log(`kimi Wire initialize failed: ${err.message}`);
    process.exit(1);
  }
}

// --- Unix socket server ---
async function startServer() {
  const socketPath = await getBrokerSocketPath();

  // Clean up stale socket
  if (existsSync(socketPath)) {
    await removeFile(socketPath);
  }

  const server = createServer((clientSocket) => {
    log("Client connected");

    const rl = createInterface({ input: clientSocket });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      handleClientMessage(clientSocket, msg);
    });

    clientSocket.on("error", () => {
      if (activeClient === clientSocket) {
        activeClient = null;
        drainQueue();
      }
    });

    clientSocket.on("close", () => {
      log("Client disconnected");
      if (activeClient === clientSocket) {
        activeClient = null;
        drainQueue();
      }
      // Remove any queued requests from this client
      requestQueue = requestQueue.filter((r) => r.socket !== clientSocket);
    });
  });

  server.listen(socketPath, () => {
    log(`Broker listening on ${socketPath}`);
  });

  // Graceful shutdown
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, async () => {
      log(`Received ${sig}, shutting down...`);
      server.close();
      if (kimiClient) kimiClient.kill();
      await removeFile(socketPath);
      process.exit(0);
    });
  }
}

// --- Message routing ---

function handleClientMessage(socket, msg) {
  // Special broker-level commands
  if (msg.method === "broker/ping") {
    writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, result: { status: "ok", alive: kimiClient?.alive } });
    return;
  }

  if (msg.method === "broker/status") {
    writeToSocket(socket, {
      jsonrpc: "2.0", id: msg.id,
      result: {
        kimi_alive: kimiClient?.alive,
        kimi_pid: kimiClient?.pid,
        active_client: !!activeClient,
        queue_length: requestQueue.length,
      },
    });
    return;
  }

  // For "prompt" requests, enforce single-request-at-a-time
  if (msg.method === "prompt") {
    if (activeClient) {
      // Queue it
      requestQueue.push({ socket, msg });
      log(`Queued prompt request (queue size: ${requestQueue.length})`);
      return;
    }
    executePrompt(socket, msg);
    return;
  }

  // For "cancel", route immediately
  if (msg.method === "cancel") {
    if (kimiClient?.alive) {
      kimiClient.cancel().then((result) => {
        writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, result });
      }).catch((err) => {
        writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, error: { code: -1, message: err.message } });
      });
    }
    return;
  }

  // Pass through other requests directly to kimi
  if (msg.method && msg.id) {
    if (kimiClient?.alive) {
      kimiClient.request(msg.method, msg.params || {}).then((result) => {
        writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, result });
      }).catch((err) => {
        writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, error: { code: -1, message: err.message } });
      });
    } else {
      writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, error: { code: -1, message: "kimi process is not running" } });
    }
    return;
  }
}

async function executePrompt(socket, msg) {
  activeClient = socket;
  activeRequestId = msg.id;

  try {
    // Use request() directly — the global onEvent handler forwards events to activeClient
    const result = await kimiClient.request("prompt", { user_input: msg.params?.user_input || "" });
    if (!socket.destroyed) {
      writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, result });
    }
  } catch (err) {
    if (!socket.destroyed) {
      writeToSocket(socket, { jsonrpc: "2.0", id: msg.id, error: { code: -1, message: err.message } });
    }
  } finally {
    activeClient = null;
    activeRequestId = null;
    drainQueue();
  }
}

function drainQueue() {
  if (requestQueue.length === 0) return;
  const next = requestQueue.shift();
  if (!next.socket.destroyed) {
    executePrompt(next.socket, next.msg);
  } else {
    drainQueue(); // Skip destroyed sockets
  }
}

function writeToSocket(socket, msg) {
  try {
    socket.write(JSON.stringify(msg) + "\n");
  } catch {}
}

function log(msg) {
  process.stderr.write(`[broker] ${new Date().toISOString()} ${msg}\n`);
}

// --- Main ---
(async () => {
  await startKimi();
  await startServer();
})().catch((err) => {
  process.stderr.write(`[broker] Fatal: ${err.message}\n`);
  process.exit(1);
});
