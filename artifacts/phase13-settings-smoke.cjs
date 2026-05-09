/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = "http://localhost:3010";
const screenshotPath = path.resolve("artifacts/phase13-settings-integrations.png");
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
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "phase13-chrome-"));
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
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }, timeoutMs);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Evaluation failed");
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

    const marker = `Phase 13 Settings Smoke ${Date.now()}`;
    const apiResult = await evaluate(`(async () => {
      const json = async (path, options = {}) => {
        const response = await fetch(path, {
          ...options,
          headers: { 'content-type': 'application/json', ...(options.headers || {}) }
        });
        const payload = await response.json();
        if (!response.ok) return { ok: false, path, payload };
        return { ok: true, payload };
      };

      const preferences = await json('/api/orgs/${orgId}/settings/preferences', { method: 'PATCH', body: JSON.stringify({ preferredName: ${JSON.stringify(marker)}, timezone: 'Asia/Calcutta', theme: 'dark', shadowsEnabled: true }) });
      if (!preferences.ok) return { stage: 'preferences', ...preferences };

      const ai = await json('/api/orgs/${orgId}/settings/ai', { method: 'PATCH', body: JSON.stringify({ suggestedTasksEnabled: true, queueMessagesEnabled: true, reviewBotMode: 'every_change', promptPersonalization: ${JSON.stringify(marker)}, aiModel: 'gpt-5.4-mini-sandbox' }) });
      if (!ai.ok) return { stage: 'ai', ...ai };

      const env = await json('/api/orgs/${orgId}/settings/env-files', { method: 'POST', body: JSON.stringify({ fileName: 'phase13.env', content: 'STRIPE_SECRET_KEY=sk_test_phase13_secret\\\\nPOSTIZ_TOKEN=postiz_phase13_secret', environment: 'test', pushToVercel: true }) });
      if (!env.ok) return { stage: 'env', ...env };
      const envString = JSON.stringify(env.payload);
      if (envString.includes('sk_test_phase13_secret') || envString.includes('postiz_phase13_secret')) return { ok: false, stage: 'secret-redaction', payload: env.payload };

      const notifications = await json('/api/orgs/${orgId}/settings/notifications', { method: 'PATCH', body: JSON.stringify({ desktopAlerts: true, emailTaskUpdates: true, emailBilling: true, inAppMentions: true }) });
      if (!notifications.ok) return { stage: 'notifications', ...notifications };

      const organization = await json('/api/orgs/${orgId}/settings/organization', { method: 'PATCH', body: JSON.stringify({ name: 'Phase 13 Sandbox Co', description: ${JSON.stringify(marker)} }) });
      if (!organization.ok) return { stage: 'organization', ...organization };
      const contextImport = await json('/api/orgs/${orgId}/settings/organization/context-import', { method: 'POST', body: JSON.stringify({ source: 'Claude', content: ${JSON.stringify(marker)} }) });
      if (!contextImport.ok) return { stage: 'context-import', ...contextImport };

      const inbox = await json('/api/orgs/${orgId}/settings/inbox');
      const agent = inbox.payload.data?.agents?.[0];
      if (!inbox.ok || !agent) return { ok: false, stage: 'inbox-agents', payload: inbox.payload };
      const domainName = 'phase13-' + Date.now() + '.example.com';
      const domain = await json('/api/orgs/${orgId}/settings/inbox/domains', { method: 'POST', body: JSON.stringify({ domain: domainName }) });
      if (!domain.ok) return { stage: 'domain', ...domain };
      const address = 'agent@' + domainName;
      const addressResult = await json('/api/orgs/${orgId}/settings/inbox/agent-addresses', { method: 'POST', body: JSON.stringify({ agentId: agent.id, address }) });
      if (!addressResult.ok) return { stage: 'agent-address', ...addressResult };

      const billing = await json('/api/orgs/${orgId}/billing/upgrade', { method: 'POST', body: JSON.stringify({ plan: 'pro', confirmed: true }) });
      if (!billing.ok || billing.payload.data?.account?.plan !== 'pro') return { ok: false, stage: 'billing', payload: billing.payload };

      const stripe = await json('/api/orgs/${orgId}/integrations/stripe/connect', { method: 'POST', body: JSON.stringify({ config: { testMode: 'configured', liveMode: 'needs_live_keys', webhookStatus: 'sandbox_ready' } }) });
      if (!stripe.ok) return { stage: 'stripe', ...stripe };

      const apifyConnect = await json('/api/orgs/${orgId}/integrations/apify/connect', { method: 'POST', body: JSON.stringify({ config: { tokenMode: 'sandbox' } }) });
      if (!apifyConnect.ok) return { stage: 'apify-connect', ...apifyConnect };
      const apifyCheck = await json('/api/orgs/${orgId}/integrations/apify/check', { method: 'POST' });
      if (!apifyCheck.ok) return { stage: 'apify-check', ...apifyCheck };
      const apifyDisconnect = await json('/api/orgs/${orgId}/integrations/apify/disconnect', { method: 'POST' });
      if (!apifyDisconnect.ok) return { stage: 'apify-disconnect', ...apifyDisconnect };

      const channelName = ${JSON.stringify(marker + " Channel")};
      const postiz = await json('/api/orgs/${orgId}/integrations/postiz/channels', { method: 'POST', body: JSON.stringify({ channelType: 'x', displayName: channelName }) });
      if (!postiz.ok) return { stage: 'postiz', ...postiz };

      const supabase = await json('/api/orgs/${orgId}/settings/advanced/import-supabase', { method: 'POST', body: JSON.stringify({ projectUrl: 'https://phase13.supabase.co', confirmation: 'IMPORT SUPABASE' }) });
      if (!supabase.ok) return { stage: 'supabase', ...supabase };
      const repo = await json('/api/orgs/${orgId}/settings/advanced/switch-repo', { method: 'POST', body: JSON.stringify({ repoUrl: 'https://github.com/example/phase13', confirmation: 'SWITCH REPO' }) });
      if (!repo.ok) return { stage: 'repo', ...repo };

      return { ok: true, orgId: '${orgId}', marker: ${JSON.stringify(marker)}, channelName, address };
    })()`, 45000);
    if (!apiResult?.ok) throw new Error(`Phase 13 API smoke failed: ${JSON.stringify(apiResult)}`);

    await navigate(`${baseUrl}/org/${orgId}/settings/preferences`);
    await waitFor(`document.body && Array.from(document.querySelectorAll('input, textarea')).some((item) => (item.value || '').includes(${JSON.stringify(marker)}))`, 25000);
    await navigate(`${baseUrl}/org/${orgId}/settings/billing`);
    await waitFor("document.body && document.body.innerText.includes('Plan and usage') && document.body.innerText.includes('pro')", 25000);
    await navigate(`${baseUrl}/org/${orgId}/integrations`);
    await waitFor("document.body && document.body.innerText.includes('Provider center') && document.body.innerText.includes('Postiz')", 25000);
    await navigate(`${baseUrl}/org/${orgId}/integrations/postiz`);
    await waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(apiResult.channelName)})`, 25000);

    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    const filteredErrors = consoleErrors.filter(Boolean).filter((entry) => !entry.includes("Download the React DevTools"));
    resultForExit = filteredErrors.length === 0 ? 0 : 1;
    console.log(JSON.stringify({ ok: filteredErrors.length === 0, orgId, marker, screenshotPath, consoleErrors: filteredErrors }, null, 2));
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
