import { app, BrowserWindow, shell, Menu, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// =============================================================================
// Background Backend Manager (Zero-Config Client PC Support)
// =============================================================================

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

function resolvePythonBinary(): { cmd: string; cwd: string } | null {
  // 1. Packaged bundled location
  const packagedBackend = path.join(process.resourcesPath, 'backend');
  const packagedPython = path.join(process.resourcesPath, 'venv/Scripts/python.exe');
  if (fs.existsSync(packagedPython) && fs.existsSync(packagedBackend)) {
    return { cmd: packagedPython, cwd: packagedBackend };
  }

  // 2. Development monorepo location
  const devBackend = path.resolve(__dirname, '../../backend');
  const devVenvPython = path.resolve(__dirname, '../../venv/Scripts/python.exe');

  if (fs.existsSync(devBackend)) {
    if (fs.existsSync(devVenvPython)) {
      return { cmd: devVenvPython, cwd: devBackend };
    }
    // Fallback to system python
    return { cmd: 'python', cwd: devBackend };
  }

  return null;
}

async function startBackendServer(): Promise<void> {
  const alreadyRunning = await checkBackendHealth();
  if (alreadyRunning) {
    console.log('[AstroLedger] Backend is already running and healthy.');
    return;
  }

  const pyConfig = resolvePythonBinary();
  if (!pyConfig) {
    console.warn('[AstroLedger] Backend directory not found; assuming remote/cloud server.');
    return;
  }

  console.log(`[AstroLedger] Auto-spawning backend from ${pyConfig.cwd} using ${pyConfig.cmd}...`);

  try {
    backendProcess = spawn(
      pyConfig.cmd,
      ['manage.py', 'runserver', '0.0.0.0:8000'],
      {
        cwd: pyConfig.cwd,
        windowsHide: true, // Completely invisible on client PC (no black CMD popup)
        stdio: 'ignore',
        detached: false,
      }
    );

    backendProcess.on('error', (err) => {
      console.error('[AstroLedger] Failed to launch background server:', err);
    });

    // Wait up to 15 seconds for backend to report healthy
    for (let attempt = 0; attempt < 30; attempt++) {
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
    console.log(`[AstroLedger] Terminating background server PID ${backendProcess.pid}...`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
      } else {
        backendProcess.kill();
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

function createWindow(): void {
  const iconPath = path.join(__dirname, '../assets/icon.svg');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#07090e',
    title: 'AstroLedger — Vedic Astrology Client & Consultation Management',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  buildApplicationMenu();

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 1. Packaged location (inside asar: renderer/index.html)
    const packagedPath = path.join(__dirname, '../renderer/index.html');
    // 2. Unpackaged monorepo fallback: ../../frontend/dist/index.html
    const monorepoPath = path.join(__dirname, '../../frontend/dist/index.html');

    if (fs.existsSync(packagedPath)) {
      mainWindow.loadFile(packagedPath);
    } else if (fs.existsSync(monorepoPath)) {
      mainWindow.loadFile(monorepoPath);
    } else {
      mainWindow.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            '<body style="background:#07090e;color:#f3f4f6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">' +
              '<div style="text-align:center;">' +
              '<h1 style="color:#f59e0b;">AstroLedger Desktop</h1>' +
              '<p>Frontend production build not found.</p>' +
              '<p style="color:#9ca3af;font-size:14px;">Run <code>npm run build:all</code> in the desktop directory.</p>' +
              '</div>' +
              '</body>'
          )
      );
    }
  }

  mainWindow.webContents.setWindowOpenHandler((details: { url: string }) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // 1. Boot background server if not already running
  await startBackendServer();

  // 2. Create the native GUI window
  createWindow();

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

app.on('will-quit', () => {
  killBackendProcess();
});
