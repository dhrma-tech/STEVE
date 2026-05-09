/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = "http://localhost:3010";
const screenshotPath = path.resolve("artifacts/phase11-chat.png");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function main() {
  const port = await freePort();
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "phase11-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,1000",
    "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let ws;
  let resultForExit = 1;

  try {
    async function fetchJson(url, options) {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
      return response.json();
    }

    async function waitForEndpoint(url, timeoutMs = 15000) {
      const started = Date.now();
      let lastError;
      while (Date.now() - started < timeoutMs) {
        try {
          return await fetchJson(url);
        } catch (error) {
          lastError = error;
          await sleep(200);
        }
      }
      throw lastError ?? new Error(`Timed out waiting for ${url}`);
    }

    await waitForEndpoint(`http://127.0.0.1:${port}/json/version`);
    const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}/login`)}`, { method: "PUT" });
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let id = 0;
    const pending = new Map();
    const consoleErrors = [];

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, method, timeout } = pending.get(message.id);
        clearTimeout(timeout);
        pending.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result ?? {});
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        const text = (message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
        consoleErrors.push(text);
      }
      if (message.method === "Runtime.exceptionThrown") {
        consoleErrors.push(message.params?.exceptionDetails?.text ?? "Runtime exception");
      }
      if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
        consoleErrors.push(message.params.entry.text);
      }
    });

    function send(method, params = {}, timeoutMs = 15000) {
      const callId = ++id;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(callId);
          reject(new Error(`${method}: timed out`));
        }, timeoutMs);
        pending.set(callId, { resolve, reject, method, timeout });
        ws.send(JSON.stringify({ id: callId, method, params }));
      });
    }

    async function evaluate(expression, timeoutMs = 15000) {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true
      }, timeoutMs);
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Evaluation failed");
      }
      return result.result?.value;
    }

    async function waitFor(predicateExpression, timeoutMs = 20000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await evaluate(predicateExpression, 5000)) return;
        await sleep(250);
      }
      throw new Error(`Timed out waiting for ${predicateExpression}`);
    }

    async function navigate(url) {
      await send("Page.navigate", { url });
      await waitFor("document.readyState === 'complete' || document.readyState === 'interactive'", 20000);
    }

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Log.enable");
    await navigate(`${baseUrl}/login`);

    const login = await evaluate(`(async () => {
      const response = await fetch('/api/auth/sandbox-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Sandbox Founder', email: 'sandbox-founder@example.com' })
      });
      const payload = await response.json();
      return { ok: response.ok, payload };
    })()`);
    if (!login?.ok) throw new Error(`Sandbox login failed: ${JSON.stringify(login)}`);
    const orgId = login.payload?.data?.activeOrgId ?? login.payload?.data?.organizations?.[0]?.id;
    if (!orgId) throw new Error(`No org id after login: ${JSON.stringify(login)}`);

    const title = `Phase 11 Browser Chat ${Date.now()}`;
    const seed = await evaluate(`(async () => {
      const threadResponse = await fetch('/api/orgs/${orgId}/chat/threads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'cofounder', title: ${JSON.stringify(title)} })
      });
      const threadPayload = await threadResponse.json();
      const threadId = threadPayload.data?.id;
      if (!threadResponse.ok || !threadId) return { ok: false, stage: 'thread', payload: threadPayload };
      const messageResponse = await fetch('/api/orgs/${orgId}/chat/threads/' + threadId + '/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: '@engineering prepare a browser-visible chat brief.',
          mentions: ['engineering'],
          attachmentNames: ['phase11-ui.md']
        })
      });
      const messagePayload = await messageResponse.json();
      return { ok: messageResponse.ok, threadId, payload: messagePayload };
    })()`);
    if (!seed?.ok) throw new Error(`Seed failed: ${JSON.stringify(seed)}`);

    await navigate(`${baseUrl}/org/${orgId}/canvas?tab=cofounder`);
    await waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(title)})`, 25000);
    await waitFor("document.body && document.body.innerText.includes('phase11-ui.md')", 15000);
    await waitFor("document.body && document.body.innerText.includes('Ran 2 actions')", 15000);
    await waitFor("document.body && document.body.innerText.includes('thinking')", 15000);

    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    const filteredErrors = consoleErrors.filter(Boolean).filter((entry) => !entry.includes("Download the React DevTools"));
    resultForExit = filteredErrors.length === 0 ? 0 : 1;
    console.log(JSON.stringify({ ok: filteredErrors.length === 0, orgId, threadId: seed.threadId, title, screenshotPath, consoleErrors: filteredErrors }, null, 2));
  } finally {
    if (ws) ws.close();
    chrome.kill();
    await new Promise((resolve) => {
      const done = () => resolve();
      chrome.once("exit", done);
      setTimeout(done, 1200);
    });
    try {
      await fs.rm(profileDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`Cleanup skipped: ${cleanupError.message}`);
    }
    process.exitCode = resultForExit;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
