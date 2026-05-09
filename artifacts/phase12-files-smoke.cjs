/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = "http://localhost:3010";
const screenshotPath = path.resolve("artifacts/phase12-files-library.png");
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
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "phase12-chrome-"));
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

    const marker = `Phase 12 Library Smoke ${Date.now()}`;
    const seeded = await evaluate(`(async () => {
      const libraryResponse = await fetch('/api/orgs/${orgId}/files');
      const libraryPayload = await libraryResponse.json();
      const generalFolderId = libraryPayload.data?.generalFolderId;
      const businessPlan = libraryPayload.data?.files?.find((file) => file.name === 'Business Plan.md');
      const department = libraryPayload.data?.catalog?.departments?.[0];
      if (!libraryResponse.ok || !generalFolderId || !businessPlan || !department) return { ok: false, stage: 'library', payload: libraryPayload };

      const folderResponse = await fetch('/api/orgs/${orgId}/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: ${JSON.stringify(marker)}, parentFolderId: generalFolderId })
      });
      const folderPayload = await folderResponse.json();
      const folderId = folderPayload.data?.id;
      if (!folderResponse.ok || !folderId) return { ok: false, stage: 'folder', payload: folderPayload };

      const fileResponse = await fetch('/api/orgs/${orgId}/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: ${JSON.stringify(`${marker}.md`)},
          mimeType: 'text/markdown',
          sizeBytes: 220,
          folderId,
          visibility: 'organization',
          content: '# ${marker}\\n\\nA searchable preview for the Phase 12 library smoke.'
        })
      });
      const filePayload = await fileResponse.json();
      const fileId = filePayload.data?.id;
      if (!fileResponse.ok || !fileId) return { ok: false, stage: 'file', payload: filePayload };

      const versionResponse = await fetch('/api/orgs/${orgId}/files/' + fileId + '/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: ${JSON.stringify(`${marker}-v2.md`)},
          mimeType: 'text/markdown',
          sizeBytes: 260,
          content: '# ${marker} v2\\n\\nUpdated preview content and version history.'
        })
      });
      const versionPayload = await versionResponse.json();
      if (!versionResponse.ok || !versionPayload.data?.versions?.length) return { ok: false, stage: 'version', payload: versionPayload };

      const shareResponse = await fetch('/api/orgs/${orgId}/files/' + fileId, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibility: 'shared' })
      });
      const sharePayload = await shareResponse.json();
      if (!shareResponse.ok || sharePayload.data?.visibility !== 'shared') return { ok: false, stage: 'share', payload: sharePayload };

      const archiveResponse = await fetch('/api/orgs/${orgId}/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: ${JSON.stringify(`${marker}-archive.md`)},
          mimeType: 'text/markdown',
          folderId,
          visibility: 'organization',
          content: 'Archive target'
        })
      });
      const archivePayload = await archiveResponse.json();
      const archiveId = archivePayload.data?.id;
      if (!archiveResponse.ok || !archiveId) return { ok: false, stage: 'archive-create', payload: archivePayload };
      const archivedResponse = await fetch('/api/orgs/${orgId}/files/' + archiveId + '/archive', { method: 'POST' });
      const archivedPayload = await archivedResponse.json();
      if (!archivedResponse.ok || !archivedPayload.data?.archivedAt) return { ok: false, stage: 'archive', payload: archivedPayload };

      const departmentFileResponse = await fetch('/api/orgs/${orgId}/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: ${JSON.stringify(`${marker}-department.md`)},
          mimeType: 'text/markdown',
          folderId,
          departmentId: department.id,
          visibility: 'department',
          content: 'Department panel verification file'
        })
      });
      const departmentFilePayload = await departmentFileResponse.json();
      if (!departmentFileResponse.ok || !departmentFilePayload.data?.id) return { ok: false, stage: 'department-file', payload: departmentFilePayload };

      const searchResponse = await fetch('/api/orgs/${orgId}/files?q=' + encodeURIComponent(${JSON.stringify(marker)}));
      const searchPayload = await searchResponse.json();
      const found = searchPayload.data?.files?.some((file) => file.id === fileId);
      return { ok: Boolean(found), orgId: ${JSON.stringify(orgId)}, fileId, folderId, departmentSlug: department.slug, departmentFileName: departmentFilePayload.data.name, businessPlanId: businessPlan.id, marker: ${JSON.stringify(marker)}, searchCount: searchPayload.data?.files?.length ?? 0 };
    })()`, 30000);
    if (!seeded?.ok) throw new Error(`File library seed failed: ${JSON.stringify(seeded)}`);

    await navigate(`${baseUrl}/org/${orgId}/canvas?tab=library&file=${seeded.fileId}`);
    await waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(marker)})`, 25000);
    await waitFor("document.body && document.body.innerText.includes('Business Plan.md')", 15000);
    await waitFor("document.body && document.body.innerText.includes('Version history')", 15000);
    await waitFor("document.body && document.body.innerText.includes('shared')", 15000);

    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    await navigate(`${baseUrl}/org/${orgId}/canvas?department=${seeded.departmentSlug}`);
    await waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(seeded.departmentFileName)})`, 25000);

    const filteredErrors = consoleErrors.filter(Boolean).filter((entry) => !entry.includes("Download the React DevTools"));
    resultForExit = filteredErrors.length === 0 ? 0 : 1;
    console.log(JSON.stringify({ ok: filteredErrors.length === 0, orgId, fileId: seeded.fileId, folderId: seeded.folderId, marker, screenshotPath, consoleErrors: filteredErrors }, null, 2));
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
