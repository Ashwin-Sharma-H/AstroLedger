import { app, BrowserWindow, shell, Menu, dialog, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync, exec, ChildProcess } from 'child_process';
import * as http from 'http';

// Standardize application name and data directory across development and production
app.name = 'AstroLedger';
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'AstroLedger'));
} catch (e) {
  // ignore
}

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// =============================================================================
// Background Backend Manager (Zero-Config Client PC Support)
// =============================================================================

function ensureFirewallRule(): void {
  if (process.platform !== 'win32') return;
  try {
    exec('netsh advfirewall firewall add rule name="AstroLedger Server (Port 8000)" dir=in action=allow protocol=TCP localport=8000 profile=any', { windowsHide: true }, () => {});
  } catch {
    // Non-fatal; NSIS installer sets this automatically upon installation
  }
}

function checkBackendHealth(url = 'http://127.0.0.1:8000/api/health/'): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

interface BackendConfig {
  cmd: string;
  args: string[];
  cwd: string;
  isExecutable: boolean;
}

function resolveBackendServer(): BackendConfig | null {
  // 1. Packaged standalone binary (Zero-config client PC)
  const packagedExe = path.join(process.resourcesPath, 'backend-server', 'astroledger-server.exe');
  if (fs.existsSync(packagedExe)) {
    return { cmd: packagedExe, args: [], cwd: path.dirname(packagedExe), isExecutable: true };
  }

  // 2. Unpackaged compiled binary (Local build testing)
  const localDistExe = path.resolve(__dirname, '../../backend/dist/astroledger-server/astroledger-server.exe');
  if (fs.existsSync(localDistExe)) {
    return { cmd: localDistExe, args: [], cwd: path.dirname(localDistExe), isExecutable: true };
  }

  // 3. Development monorepo fallback
  const devBackend = path.resolve(__dirname, '../../backend');
  const devVenvPython = path.resolve(__dirname, '../../venv/Scripts/python.exe');

  if (fs.existsSync(devBackend)) {
    if (fs.existsSync(devVenvPython)) {
      return { cmd: devVenvPython, args: ['manage.py', 'runserver', '0.0.0.0:8000', '--noreload'], cwd: devBackend, isExecutable: false };
    }
    // Fallback to system python
    return { cmd: 'python', args: ['manage.py', 'runserver', '0.0.0.0:8000', '--noreload'], cwd: devBackend, isExecutable: false };
  }

  return null;
}

function getLogDir(): string {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

async function startBackendServer(): Promise<void> {
  ensureFirewallRule();

  const alreadyRunning = await checkBackendHealth();
  if (alreadyRunning) {
    console.log('[AstroLedger] Backend is already running and healthy.');
    return;
  }

  const serverConfig = resolveBackendServer();
  if (!serverConfig) {
    console.warn('[AstroLedger] Backend binary or directory not found; assuming remote/cloud server.');
    return;
  }

  const userDataDir = app.getPath('userData');
  console.log(`[AstroLedger] Spawning backend from ${serverConfig.cwd} using ${serverConfig.cmd}...`);
  console.log(`[AstroLedger] User data directory set to: ${userDataDir}`);

  // If using development Python script, ensure migrations run first
  if (!serverConfig.isExecutable) {
    try {
      const migrate = spawn(
        serverConfig.cmd,
        ['manage.py', 'migrate', '--run-syncdb'],
        {
          cwd: serverConfig.cwd,
          windowsHide: true,
          stdio: 'ignore',
          shell: true,
          env: { ...process.env, ASTROLEDGER_DATA_DIR: userDataDir },
        }
      );
      await new Promise<void>((resolve) => {
        migrate.on('close', () => resolve());
        migrate.on('error', () => resolve());
        setTimeout(() => resolve(), 30000);
      });
      console.log('[AstroLedger] Database migration check completed.');
    } catch (e) {
      console.warn('[AstroLedger] Migration step skipped:', e);
    }
  }

  try {
    const logPath = path.join(getLogDir(), 'backend.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n--- Backend started at ${new Date().toISOString()} ---\n`);

    backendProcess = spawn(
      serverConfig.cmd,
      serverConfig.args,
      {
        cwd: serverConfig.cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: false,
        env: {
          ...process.env,
          ASTROLEDGER_DATA_DIR: userDataDir,
          AUTOBAHN_USE_NVX: '0',
          ASTRO_HOST: '0.0.0.0',
          ASTRO_PORT: '8000',
        },
      }
    );

    backendProcess.stdout?.on('data', (data: Buffer) => {
      logStream.write(data);
    });
    backendProcess.stderr?.on('data', (data: Buffer) => {
      logStream.write(data);
    });

    backendProcess.on('error', (err) => {
      console.error('[AstroLedger] Failed to launch background server:', err);
      logStream.write(`SPAWN ERROR: ${err.message}\n`);
    });

    backendProcess.on('exit', (code) => {
      console.warn(`[AstroLedger] Backend process exited with code ${code}`);
      logStream.write(`PROCESS EXITED: code ${code}\n`);
    });

    // Wait up to 30 seconds for backend to report healthy
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      const healthy = await checkBackendHealth();
      if (healthy) {
        console.log('[AstroLedger] Background server booted successfully and is healthy!');
        return;
      }
    }
    console.warn('[AstroLedger] Background server launched but did not respond to health check in time.');
  } catch (err) {
    console.error('[AstroLedger] Error spawning backend process:', err);
  }
}

function killBackendProcess(): void {
  if (backendProcess && backendProcess.pid) {
    const pid = backendProcess.pid;
    console.log(`[AstroLedger] Synchronously terminating background server PID ${pid}...`);
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', pid.toString(), '/f', '/t'], { windowsHide: true });
      } else {
        backendProcess.kill('SIGKILL');
      }
    } catch (e) {
      console.error('[AstroLedger] Error killing backend:', e);
    }
    backendProcess = null;
  }
}

// =============================================================================
// Application Menu
// =============================================================================

function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Consultation',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-action', 'new-consultation');
            }
          },
        },
        {
          label: 'Client Registry',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-action', 'nav-clients');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Reload View',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Vedic Astrology Reference',
          click: async () => {
            await shell.openExternal('https://en.wikipedia.org/wiki/Hindu_astrology');
          },
        },
        { type: 'separator' },
        {
          label: 'About AstroLedger',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About AstroLedger',
              message: 'AstroLedger Desktop v1.0.0',
              detail:
                'Vedic Astrology Client & Practice Management System.\n' +
                'Built with React, TypeScript, Electron, Django Channels & PostgreSQL.\n\n' +
                'Copyright © 2026 AstroLedger Jyotish Technologies. All rights reserved.',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// =============================================================================
// Window Creation & Lifecycle
// =============================================================================

// =============================================================================
// CORS Bypass at Electron's Network Layer
// =============================================================================
// CORS Bypass at Electron's Network Layer
// =============================================================================
// Note: Chromium match patterns strictly forbid port numbers (e.g. :8000).
// We match http/https schemes globally and filter by port/host inside the listener.

function setupCORSBypass(): void {
  try {
    const filter = {
      urls: ['http://*/*', 'https://*/*'],
    };

    session.defaultSession.webRequest.onBeforeSendHeaders(
      filter,
      (details, callback) => {
        try {
          const url = details.url || '';
          if (url.includes(':8000') || url.includes('127.0.0.1') || url.includes('localhost')) {
            details.requestHeaders['Origin'] = 'http://localhost';
          }
        } catch {
          // ignore
        }
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    session.defaultSession.webRequest.onHeadersReceived(
      filter,
      (details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        try {
          const url = details.url || '';
          if (url.includes(':8000') || url.includes('127.0.0.1') || url.includes('localhost')) {
            responseHeaders['Access-Control-Allow-Origin'] = ['*'];
            responseHeaders['Access-Control-Allow-Headers'] = ['*'];
            responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
            responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
          }
        } catch {
          // ignore
        }
        callback({ responseHeaders });
      }
    );
  } catch (err) {
    console.error('[AstroLedger] Failed to setup CORS bypass:', err);
  }
}

// =============================================================================
// Window Creation & Lifecycle
// =============================================================================

function createWindow(): void {
  try {
    const iconPath = fs.existsSync(path.join(__dirname, '../assets/icon.ico'))
      ? path.join(__dirname, '../assets/icon.ico')
      : path.join(__dirname, '../assets/icon.png');

    mainWindow = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      backgroundColor: '#07090e',
      title: 'AstroLedger — Vedic Astrology Client & Consultation Management',
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      show: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });

    try {
      buildApplicationMenu();
    } catch (e) {
      console.warn('[AstroLedger] Menu creation error:', e);
    }

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      loadAppUI();
    }

    mainWindow.once('ready-to-show', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    mainWindow.webContents.setWindowOpenHandler((details: { url: string }) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    mainWindow.on('close', () => {
      killBackendProcess();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('[AstroLedger] Error in createWindow:', err);
  }
}

function loadAppUI(): void {
  if (!mainWindow) return;

  // Search candidate paths in order
  const candidatePaths = [
    path.join(app.getAppPath(), 'renderer', 'index.html'),
    path.join(__dirname, '../renderer/index.html'),
    path.join(__dirname, '../../frontend/dist/index.html'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      mainWindow.loadFile(candidate);
      return;
    }
  }

  // Fallback diagnostic screen if frontend build is missing
  mainWindow.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent(
        '<body style="background:#07090e;color:#f3f4f6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">' +
          '<div style="text-align:center;">' +
          '<h1 style="color:#f59e0b;">AstroLedger Desktop</h1>' +
          '<p>Frontend production build not found.</p>' +
          '<p style="color:#9ca3af;font-size:14px;">Run <code>npm run build:desktop</code> in the project root.</p>' +
          '</div>' +
          '</body>'
      )
  );
}

// =============================================================================
// Process Error Handlers & App Lifecycle
// =============================================================================

process.on('uncaughtException', (err) => {
  console.error('[AstroLedger] Uncaught Exception:', err);
  try {
    const logPath = path.join(getLogDir(), 'error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err.message}\n`);
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[AstroLedger] Unhandled Rejection:', reason);
  try {
    const logPath = path.join(getLogDir(), 'error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`);
  } catch {}
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

app.whenReady().then(() => {
  try {
    // 1. Create native window FIRST so the app opens instantly
    createWindow();
  } catch (err) {
    console.error('[AstroLedger] Failed to create window:', err);
  }

  try {
    // 2. Set up CORS bypass safely
    setupCORSBypass();
  } catch (err) {
    console.error('[AstroLedger] Failed to setup CORS bypass:', err);
  }

  try {
    // 3. Boot background backend server concurrently
    startBackendServer();
  } catch (err) {
    console.error('[AstroLedger] Failed to start backend server:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killBackendProcess();
});

app.on('will-quit', () => {
  killBackendProcess();
});
