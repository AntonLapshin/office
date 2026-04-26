import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { readSession, readCharacterState } from "./session-io.js";

export class SessionServer {
  private server: http.Server;
  private sseClients: http.ServerResponse[] = [];
  private messageResolve: ((msg: string | null) => void) | null = null;

  constructor(
    private sessionDir: string,
    private port: number,
  ) {
    this.server = http.createServer((req, res) => this.handle(req, res));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`[office] API server on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop(): void {
    for (const res of this.sseClients) {
      res.end();
    }
    this.sseClients = [];
    this.server.close();
  }

  emit(event: string, data: unknown): void {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.sseClients = this.sseClients.filter((res) => {
      try {
        res.write(msg);
        return true;
      } catch {
        return false;
      }
    });
  }

  waitForMessage(characterName: string): Promise<string | null> {
    this.emit("waiting", { character: characterName });
    return new Promise((resolve) => {
      this.messageResolve = resolve;
    });
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${this.port}`);

    try {
      if (req.method === "GET" && url.pathname === "/api/session") {
        this.getSession(res);
      } else if (req.method === "GET" && url.pathname === "/api/state") {
        this.getState(res);
      } else if (req.method === "GET" && url.pathname === "/api/timeline") {
        this.getTimeline(res);
      } else if (req.method === "GET" && url.pathname === "/api/layout") {
        this.getLayout(res);
      } else if (req.method === "GET" && url.pathname === "/api/events") {
        this.handleSse(res);
      } else if (req.method === "POST" && url.pathname === "/api/message") {
        this.postMessage(req, res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    } catch (err) {
      res.writeHead(500);
      res.end(err instanceof Error ? err.message : "Internal error");
    }
  }

  private getSession(res: http.ServerResponse): void {
    const session = readSession(this.sessionDir);
    this.json(res, session);
  }

  private getState(res: http.ServerResponse): void {
    const session = readSession(this.sessionDir);
    const characters: Record<string, unknown> = {};
    for (const name of session.characters) {
      characters[name] = readCharacterState(this.sessionDir, name);
    }
    this.json(res, { session, characters });
  }

  private getTimeline(res: http.ServerResponse): void {
    const file = path.join(this.sessionDir, "timeline.log");
    if (!fs.existsSync(file)) {
      this.json(res, { lines: [] });
      return;
    }
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    this.json(res, { lines });
  }

  private getLayout(res: http.ServerResponse): void {
    const session = readSession(this.sessionDir);
    const file = path.join(this.sessionDir, "spaces", `${session.spaceName}.json`);
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end("Layout not found");
      return;
    }
    const layout = JSON.parse(fs.readFileSync(file, "utf8"));
    this.json(res, layout);
  }

  private handleSse(res: http.ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(":\n\n");
    this.sseClients.push(res);

    req_cleanup(res, () => {
      this.sseClients = this.sseClients.filter((c) => c !== res);
    });
  }

  private postMessage(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!this.messageResolve) {
      res.writeHead(409);
      this.json(res, { error: "Not waiting for input" });
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body) as { message: string };
        const resolve = this.messageResolve!;
        this.messageResolve = null;

        if (parsed.message === "/quit") {
          resolve(null);
        } else {
          resolve(parsed.message);
        }

        this.json(res, { ok: true });
      } catch {
        res.writeHead(400);
        this.json(res, { error: "Invalid JSON, expected { \"message\": \"...\" }" });
      }
    });
  }

  private json(res: http.ServerResponse, data: unknown): void {
    if (!res.headersSent) {
      res.writeHead(200, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify(data));
  }
}

function req_cleanup(res: http.ServerResponse, fn: () => void): void {
  res.on("close", fn);
}
