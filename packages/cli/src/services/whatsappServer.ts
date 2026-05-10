/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WhatsApp configuration web server.
 * Runs an Express server on port 8789 that serves a UI for:
 * - Displaying QR code for WhatsApp Web pairing
 * - Showing connection status when paired
 * - Providing a logout button to disconnect
 */

import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import * as QRCodeLib from 'qrcode';
import {
  createDebugLogger,
  Storage,
  GeminiClient,
  SendMessageType,
  GeminiEventType,
} from '@vibe-bti/vibe-code-core';
import { loadSettings } from '../config/settings.js';
import { loadCliConfig } from '../config/config.js';

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');

const debugLogger = createDebugLogger('WHATSAPP_SERVER');

const WHATSAPP_SERVER_PORT = 8789;
const WHATSAPP_SERVER_URL = `http://localhost:${WHATSAPP_SERVER_PORT}`;

// Server state
let httpServer: Server | null = null;
let waClient: InstanceType<typeof Client> | null = null;

export type WhatsAppStatus =
  | 'disconnected'
  | 'waiting_qr'
  | 'connected'
  | 'loading_screen'
  | 'authenticated'
  | 'loading';

interface WhatsAppServerState {
  status: WhatsAppStatus;
  qrCode: string | null; // Base64 PNG data URL
  phoneNumber: string | null;
  errorMessage: string | null;
  logs: string[];
}

const state: WhatsAppServerState = {
  status: 'disconnected',
  qrCode: null,
  phoneNumber: null,
  errorMessage: null,
  logs: [],
};

function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  state.logs.unshift(`[${timestamp}] ${message}`);
  if (state.logs.length > 50) state.logs.pop();
  debugLogger.debug(message);
}

async function getAuthorizedNumbers(): Promise<string[]> {
  try {
    const settings = loadSettings();
    const whatsappAllowed = (settings.merged as any).whatsapp_allowed;
    return Array.isArray(whatsappAllowed) ? whatsappAllowed : [];
  } catch (err) {
    debugLogger.error('Failed to load settings for WhatsApp auth:', err);
    return [];
  }
}

function getAppContent(): string {
  const statusBadge = (() => {
    switch (state.status) {
      case 'authenticated':
        return `<span class="badge authenticated">⏳ Terautentikasi</span>`;
      case 'connected':
        return `<span class="badge connected">✅ Terhubung</span>`;
      case 'waiting_qr':
        return `<span class="badge waiting">🔄 Menunggu Scan QR</span>`;
      case 'loading':
        return `<span class="badge loading">⏳ Memuat...</span>`;
      default:
        return `<span class="badge disconnected">❌ Tidak Terhubung</span>`;
    }
  })();

  const bodyContent = (() => {
    if (state.status === 'connected') {
      return `
        <div class="card connected-card">
          <div class="phone-icon">📱</div>
          <h2>WhatsApp Terhubung</h2>
          ${state.phoneNumber ? `<p class="phone">Nomor: <strong>${state.phoneNumber}</strong></p>` : ''}
          <p class="desc">Vibe Code terhubung ke WhatsApp Anda dan siap menerima pesan.</p>
          <form id="logout-form" method="POST" action="/logout">
            <button type="submit" id="stop" class="btn btn-logout">🔌 Putuskan Koneksi (Logout)</button>
          </form>
        </div>
        <script>
          document.getElementById('logout-form').addEventListener('submit', function() {
            const btn = document.getElementById('stop');
            btn.disabled = true;
            btn.innerText = '⏳ Memutuskan...';
          });
        </script>`;
    }

    if (state.status === 'waiting_qr' && state.qrCode) {
      return `
        <div class="card qr-card">
          <h2>Scan QR Code</h2>
          <p class="desc">Buka WhatsApp di ponsel Anda &rarr; Perangkat Tertaut &rarr; Tautkan Perangkat, lalu scan kode ini.</p>
          <div class="qr-container">
            <img src="${state.qrCode}" alt="WhatsApp QR Code" class="qr-img" />
          </div>
          <p class="hint">QR code akan diperbarui otomatis setiap 20 detik.</p>
          <p class="refresh-note">Halaman ini diperbarui otomatis tanpa refresh.</p>
        </div>`;
    }

    if (state.status === 'loading') {
      return `
        <div class="card loading-card">
          <div class="spinner"></div>
          <h2>Memulai WhatsApp...</h2>
          <p class="desc">Mohon tunggu, sedang menginisialisasi koneksi WhatsApp.</p>
        </div>`;
    }

    if (state.status === 'loading_screen') {
      return `
        <div class="card loading-card">
          <div class="spinner"></div>
          <h2>Sinkronisasi WhatsApp...</h2>
          <p class="desc">Mohon tunggu, sedang menyinkronkan pesan dan data sesi Anda.</p>
        </div>`;
    }

    if (state.status === 'authenticated') {
      return `<div class="card loading-card"><h2>Mengautentikasi WhatsApp...</h2>
      <p class="desc">Mohon tunggu, sedang mengautentikasi WhatsApp.</p>
      <div class="spinner"></div>
      <form id="logout-form" method="POST" action="/logout">
            <button type="submit" id="stop" class="btn btn-logout">🔌 Putuskan Koneksi (Logout)</button>
      </form>
      <script>
        document.getElementById('logout-form').addEventListener('submit', function() {
          const btn = document.getElementById('stop');
          btn.disabled = true;
          btn.innerText = '⏳ Memutuskan...';
        });
      </script>`;
    }

    const errorSection = state.errorMessage
      ? `<div class="error-card" style="margin-bottom: 1rem; padding: 1rem; background: rgba(248,81,73,0.1); border: 1px solid var(--danger); border-radius: 8px; color: var(--danger);">
           <strong>Error:</strong> ${state.errorMessage}
         </div>`
      : '';

    return `
      <div class="card disconnected-card">
        ${errorSection}
        <div class="icon">📵</div>
        <h2>WhatsApp Belum Terhubung</h2>
        <p class="desc">Klik tombol di bawah untuk memulai proses penghubungan WhatsApp.</p>
        <form id="connect-form" method="POST" action="/connect">
          <button type="submit" id="start" class="btn btn-connect">🚀 Hubungkan WhatsApp</button>
        </form>
      </div>
      <script>
        document.getElementById('connect-form').addEventListener('submit', function() {
          const btn = document.getElementById('start');
          btn.disabled = true;
          btn.innerText = '⏳ Memproses...';
          btn.style.opacity = '0.7';
        });
      </script>`;
  })();

  const logsHtml =
    state.logs.length > 0
      ? `<div class="card logs-card" style="margin-top: 1rem; text-align: left;">
         <h3>System Logs</h3>
         <div class="logs-list" style="font-family: monospace; font-size: 0.75rem; background: #000; padding: 0.5rem; border-radius: 4px; color: #0f0; max-height: 200px; overflow-y: auto;">
           ${state.logs.map((log) => `<div>${log}</div>`).join('')}
         </div>
       </div>`
      : '';

  return `
    <header>
      <h1>📲 WhatsApp Channel</h1>
      <p>Konfigurasi integrasi WhatsApp untuk Vibe Code</p>
      ${statusBadge}
    </header>
    ${bodyContent}
    ${logsHtml}
  `;
}

function getHtmlPage(): string {
  const content = getAppContent();

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Konfigurasi WhatsApp — Vibe Code</title> 
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --accent: #25D366;
      --accent2: #128C7E;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --danger: #f85149;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }
    header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2.5rem;
      flex-direction: column;
      text-align: center;
    }
    header h1 {
      font-size: 1.8rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    header p { color: var(--text-muted); font-size: 0.95rem; }
    .badge {
      display: inline-block;
      padding: 0.35rem 1rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .badge.connected { background: rgba(37,211,102,0.15); color: #25D366; border: 1px solid rgba(37,211,102,0.4); }
    .badge.waiting { background: rgba(250,176,5,0.15); color: #fab005; border: 1px solid rgba(250,176,5,0.4); }
    .badge.loading { background: rgba(88,166,255,0.15); color: #58a6ff; border: 1px solid rgba(88,166,255,0.4); }
    .badge.disconnected { background: rgba(248,81,73,0.15); color: var(--danger); border: 1px solid rgba(248,81,73,0.4); }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .card h2 { font-size: 1.4rem; margin-bottom: 0.75rem; }
    .card .desc { color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .phone-icon, .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    .phone { margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-muted); }
    .qr-container {
      background: #fff;
      border-radius: 12px;
      padding: 1rem;
      display: inline-block;
      margin-bottom: 1.25rem;
    }
    .qr-img { display: block; width: 220px; height: 220px; }
    .hint { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; }
    .refresh-note { font-size: 0.75rem; color: var(--text-muted); opacity: 0.6; }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn-connect { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; }
    .btn-logout { background: rgba(248,81,73,0.15); color: var(--danger); border: 1px solid rgba(248,81,73,0.4); }
    .btn-logout:hover { background: rgba(248,81,73,0.25); }
    footer {
      margin-top: 3rem;
      font-size: 0.78rem;
      color: var(--text-muted);
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div id="app-root">
    ${content}
  </div>
  <footer>Vibe Code &mdash; WhatsApp Configuration &bull; Port ${WHATSAPP_SERVER_PORT}</footer>

  <script>
    let lastState = { status: '', hasQr: false, phoneNumber: '' };

    async function checkStatus() {
      try {
        const response = await fetch('/status');
        const data = await response.json();
        
        if (data.status !== lastState.status || 
            data.hasQr !== lastState.hasQr || 
            data.phoneNumber !== lastState.phoneNumber) {
          
          lastState = data;
          
          // Fetch new content fragment
          const contentResponse = await fetch('/content');
          const html = await contentResponse.text();
          document.getElementById('app-root').innerHTML = html;
          
          // Re-execute scripts in the injected HTML
          const scripts = document.getElementById('app-root').querySelectorAll('script');
          scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
          });
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    }

    // Poll every 4 seconds
    setInterval(checkStatus, 4000);
    // Initial check
    checkStatus();
  </script>
</body>
</html>`;
}

async function initWhatsAppClient(): Promise<void> {
  if (waClient) {
    return;
  }

  state.status = 'loading';
  state.qrCode = null;
  state.phoneNumber = null;
  state.errorMessage = null;

  const authPath = join(Storage.getGlobalVibeDir(), 'wawebjs.auth');

  waClient = new Client({
    authStrategy: new LocalAuth({
      clientId: 'vibe-whatsapp',
      dataPath: authPath,
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  // Handle auto-authentication check
  waClient.on('authenticated', () => {
    addLog('WhatsApp authenticated');
    state.status = 'authenticated';
    state.qrCode = null;
  });

  waClient.on('loading_screen', (percent: number, message: string) => {
    state.status = 'loading_screen';
    addLog(`WhatsApp Loading: ${percent}% - ${message}`);
  });

  waClient.on('qr', async (qr: string) => {
    addLog('WhatsApp QR code received');
    state.status = 'waiting_qr';
    try {
      const qrDataUrl = await QRCodeLib!.toDataURL(qr, {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      state.qrCode = qrDataUrl;
    } catch (err) {
      addLog(`Failed to generate QR code: ${err}`);
    }
  });

  waClient.on('auth_failure', async (msg: string) => {
    addLog(`WhatsApp auth failure, clearing session: ${msg}`);
    state.status = 'disconnected';
    state.errorMessage = msg;
    state.qrCode = null;
    await destroyWhatsAppClient();
  });

  waClient.on('ready', async () => {
    addLog('WhatsApp client ready');
    state.status = 'connected';
    state.qrCode = null;
    try {
      const info = waClient!.info;
      state.phoneNumber = info?.wid?.user ?? null;
      const version = await waClient!.getWWebVersion();
      addLog(`WhatsApp Web Version: ${version}`);
    } catch (e) {
      addLog(`Error fetching WhatsApp info: ${e}`);
      state.phoneNumber = null;
    }
  });

  waClient.on('message', async (msg: any) => {
    addLog(`Message received from ${msg.from}`);

    const authorizedNumbers = await getAuthorizedNumbers();
    const sender = msg.from.replace('@c.us', '');

    if (!authorizedNumbers.includes(sender)) {
      addLog(`Unauthorized access attempt from ${sender}`);
      return;
    }

    try {
      const settings = loadSettings();
      const config = await loadCliConfig(
        settings.merged,
        {} as any,
        process.cwd(),
        undefined,
        {
          userHooks: settings.getUserHooks(),
          projectHooks: settings.getProjectHooks(),
        },
      );
      await config.initialize();

      const geminiClient = new GeminiClient(config);
      await geminiClient.initialize();

      const stream = geminiClient.sendMessageStream(
        msg.body,
        new AbortController().signal,
        String(Date.now()),
        { type: SendMessageType.UserQuery },
      );
      let responseText = '';
      for await (const event of stream) {
        if (event.type === GeminiEventType.Content) {
          responseText += event.value;
        }
      }

      if (responseText) {
        await msg.reply(responseText);
      }
    } catch (err) {
      addLog(`Error processing WhatsApp message: ${err}`);
      await msg.reply(
        'Maaf, terjadi kesalahan saat memproses permintaan Anda.',
      );
    }
  });

  waClient.on('disconnected', (reason: string) => {
    addLog(`WhatsApp disconnected: ${reason}`);
    state.status = 'disconnected';
    state.errorMessage = reason;
    state.qrCode = null;
    state.phoneNumber = null;
    waClient = null;
  });

  // Tambahkan event logging lainnya
  waClient.on('change_state', (newState: any) => {
    addLog(`WhatsApp state changed: ${newState}`);
  });

  try {
    state.status = 'loading';
    addLog('Initializing WhatsApp client...');
    await waClient.initialize();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    addLog(`WhatsApp initialize error: ${errorMsg}`);

    if (errorMsg.includes('session') || errorMsg.includes('auth')) {
      addLog(
        'Note: Sesi mungkin korup atau gagal dimuat dari path penyimpanan.',
      );
    } else if (errorMsg.includes('EPERM') || errorMsg.includes('EACCES')) {
      addLog('Note: Masalah izin akses file di direktori sesi.');
    }

    state.status = 'disconnected';
    state.errorMessage = errorMsg;
    waClient = null;
  }
}

async function destroyWhatsAppClient(): Promise<void> {
  if (waClient) {
    try {
      await waClient.logout();
    } catch {
      // ignore
    }
    try {
      await waClient.destroy();
    } catch {
      // ignore
    }
    waClient = null;
  }
  state.status = 'disconnected';
  state.qrCode = null;
  state.phoneNumber = null;
}

function createExpressApp() {
  // We use raw node http + manual routing to avoid adding express as a heavy
  // required dependency that breaks the ESM bundle. This is a tiny server.
  return async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Handle POST /connect
    if (method === 'POST' && url === '/connect') {
      initWhatsAppClient().catch((err: unknown) => {
        debugLogger.error('Failed to init WhatsApp client:', err);
      });
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    // Handle POST /logout
    if (method === 'POST' && url === '/logout') {
      destroyWhatsAppClient().catch((err: unknown) => {
        debugLogger.error('Failed to destroy WhatsApp client:', err);
      });
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    // Handle GET /status (JSON API for polling)
    if (method === 'GET' && url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: state.status,
          hasQr: !!state.qrCode,
          phoneNumber: state.phoneNumber,
          errorMessage: state.errorMessage,
          logs: state.logs,
        }),
      );
      return;
    }

    // Handle GET /content (HTML fragment for AJAX)
    if (method === 'GET' && url === '/content') {
      const html = getAppContent();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Default: serve HTML
    const html = getHtmlPage();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  };
}

/**
 * Start the WhatsApp configuration server.
 * Safe to call multiple times — only starts once.
 * Returns the server URL.
 */
export async function startWhatsAppServer(): Promise<string> {
  if (httpServer) {
    return WHATSAPP_SERVER_URL;
  }

  const handler = await createExpressApp();

  return new Promise((resolve, reject) => {
    httpServer = createServer(handler);
    httpServer.listen(WHATSAPP_SERVER_PORT, '127.0.0.1', () => {
      debugLogger.debug(`WhatsApp server started at ${WHATSAPP_SERVER_URL}`);
      initWhatsAppClient().catch((err: unknown) => {
        debugLogger.error('Failed to auto-init WhatsApp client:', err);
      });
      resolve(WHATSAPP_SERVER_URL);
    });
    httpServer.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        // Port already in use — another instance is running, that's fine
        httpServer = null;
        resolve(WHATSAPP_SERVER_URL);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Stop the WhatsApp configuration server and disconnect the client.
 */
export async function stopWhatsAppServer(): Promise<void> {
  await destroyWhatsAppClient();
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => resolve());
    });
    httpServer = null;
  }
}

export { WHATSAPP_SERVER_URL };
