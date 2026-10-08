const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, Notification, screen, session, systemPreferences, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// App properties
app.setName('Flick');
app.setAppUserModelId('com.faratech.flick');

// Deeplinking & File Associations setup
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let fileToOpenOnStartup = null;

// Register custom protocols 'flick://' and 'faraflick://'
const protocols = ['flick', 'faraflick'];
protocols.forEach(protocol => {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(protocol);
  }
});

// Handle macOS open-file event for associated files (.flick)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    handleFileOpen(filePath);
  } else {
    fileToOpenOnStartup = filePath;
  }
});

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // Handle Windows/Linux deeplink on second instance
    const deeplinkUrl = commandLine.find(arg => arg.startsWith('flick://') || arg.startsWith('faraflick://'));
    if (deeplinkUrl) {
      handleDeeplink(deeplinkUrl);
    }
    
    // Handle Windows file association on second instance
    const filePath = commandLine.find(arg => !arg.startsWith('flick://') && !arg.startsWith('faraflick://') && fs.existsSync(arg) && path.extname(arg).toLowerCase() === '.flick');
    if (filePath) {
      handleFileOpen(filePath);
    }
  });
}

function handleDeeplink(url) {
  if (!mainWindow) return;
  // Parse url e.g., flick://chat?senderId=xxx or flick://post or faraflick://group?groupId=yyy
  let cleanAction = url.replace(/^(flick|faraflick):\/\//, '');
  if (cleanAction.startsWith('/')) cleanAction = cleanAction.slice(1);
  mainWindow.webContents.send('deeplink-action', cleanAction);
}

function handleFileOpen(filePath) {
  if (!mainWindow) return;
  try {
    if (fs.existsSync(filePath)) {
      mainWindow.webContents.send('open-associated-file', {
        path: filePath,
        name: path.basename(filePath)
      });
    }
  } catch (err) {
    console.error('Failed to dispatch associated file opening event:', err);
  }
}

// Window state storage file path
const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

function getSavedWindowState() {
  let defaultState = {
    width: 1280,
    height: 800,
    x: undefined,
    y: undefined,
    isMaximized: false
  };
  
  try {
    if (fs.existsSync(stateFilePath)) {
      const saved = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      // Multiple Monitors check: Verify coordinates fall inside any active display bounds
      const displays = screen.getAllDisplays();
      let isVisible = false;
      
      if (saved.x !== undefined && saved.y !== undefined) {
        isVisible = displays.some(display => {
          return saved.x >= display.bounds.x &&
                 saved.x < display.bounds.x + display.bounds.width &&
                 saved.y >= display.bounds.y &&
                 saved.y < display.bounds.y + display.bounds.height;
        });
      }
      
      if (isVisible) {
        return { ...defaultState, ...saved };
      }
    }
  } catch (err) {
    console.error('Error reading window state:', err);
  }
  return defaultState;
}

function saveWindowState(win) {
  if (!win) return;
  try {
    const isMaximized = win.isMaximized();
    const bounds = win.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    };
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving window state:', err);
  }
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 500,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false
    }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function setupCrashRecovery(win) {
  // Unresponsive Window Alert
  win.on('unresponsive', () => {
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Flick is Unresponsive',
      message: 'Flick is not responding. Would you like to wait or reload?',
      buttons: ['Reload', 'Wait']
    }).then(({ response }) => {
      if (response === 0) {
        win.reload();
      }
    });
  });

  // Render process gone / crashed alert
  win.webContents.on('render-process-gone', (event, details) => {
    console.error(`Render process gone: ${details.reason} (${details.exitCode})`);
    dialog.showMessageBox({
      type: 'error',
      title: 'Flick Process Crashed',
      message: 'A sub-process of Flick has crashed.',
      detail: `Reason: ${details.reason}\nWould you like to reload the window?`,
      buttons: ['Reload', 'Close']
    }).then(({ response }) => {
      if (response === 0) {
        win.reload();
      } else {
        isQuitting = true;
        app.quit();
      }
    });
  });
}

function createWindow() {
  const windowState = getSavedWindowState();

  const defaultIconPath = fs.existsSync(path.join(__dirname, '../dist/icon.png'))
    ? path.join(__dirname, '../dist/icon.png')
    : path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    show: false, // Don't show until ready
    icon: defaultIconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      zoomFactor: 1.0, // Fixed default zoom factor
    },
    autoHideMenuBar: true,
    frame: true,
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Create & mount the tailored application menu
  createApplicationMenu();
  
  const distHtml = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distHtml)) {
    mainWindow.loadFile(distHtml);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.once('ready-to-show', () => {
    // Artificial delay for smooth splash screen viewing
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      
      // Check for updates
      autoUpdater.checkForUpdatesAndNotify();

      // Check if file was passed as argument or on macOS open-file event on startup
      const filePathOnStartup = process.argv.find(arg => !arg.startsWith('flick://') && fs.existsSync(arg) && path.extname(arg).toLowerCase() === '.flick') || fileToOpenOnStartup;
      if (filePathOnStartup) {
        handleFileOpen(filePathOnStartup);
      }
    }, 6000);
  });

  // Track window modifications for persistence
  mainWindow.on('resize', () => saveWindowState(mainWindow));
  mainWindow.on('move', () => saveWindowState(mainWindow));
  mainWindow.on('focus', () => {
    try {
      mainWindow.flashFrame(false);
    } catch (e) {}
  });

  // Lock down Zoom Limits when loading completes
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  });

  // Block DevTools from opening in packaged builds
  mainWindow.webContents.on('devtools-opened', () => {
    if (app.isPackaged) {
      mainWindow.webContents.closeDevTools();
    }
  });

  // Prevent browser-like navigation (Ctrl+R, F5, zoom, DevTools) via before-input-event in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!app.isPackaged) return; // Allow dev keys during development
    const key = input.key.toLowerCase();
    
    // Zoom combinations
    if (input.control || input.meta) {
      if (key === '=' || key === '+' || key === '-' || key === '0') {
        event.preventDefault();
      }
    }
    
    // DevTools combinations (F12, Ctrl+Shift+I, Cmd+Alt+I)
    if (key === 'f12' || 
        (input.control && input.shift && key === 'i') || 
        (input.meta && input.alt && key === 'i')) {
      event.preventDefault();
    }
    
    // Reload combinations (F5, Ctrl+R, Cmd+R)
    if (key === 'f5' || 
        (input.control && key === 'r') || 
        (input.meta && key === 'r')) {
      event.preventDefault();
    }
  });

  // Prevent unauthorized in-app navigation and open external links in system browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.includes('localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Enhanced window open handler: Permit in-app OAuth child popups for Google/Firebase Auth
  // while opening all regular external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isAuthPopup = 
      url.includes('/__/auth/handler') ||
      url.includes('accounts.google.com') ||
      url.includes('apis.google.com') ||
      url.includes('firebaseapp.com/__/auth') ||
      url.includes('gen-lang-client-0982710068.firebaseapp.com');

    if (isAuthPopup) {
      console.log('[Electron Auth] Allowing dedicated OAuth authentication window:', url.slice(0, 90));
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          modal: false,
          parent: mainWindow,
          autoHideMenuBar: true,
          backgroundColor: '#080a0f',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
          }
        }
      };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    saveWindowState(mainWindow);
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Set up Process-Level Crash and Unresponsive Handling
  setupCrashRecovery(mainWindow);
}

function createTray() {
  const iconPath = fs.existsSync(path.join(__dirname, '../dist/icon.png'))
    ? path.join(__dirname, '../dist/icon.png')
    : path.join(__dirname, '../public/icon.png');
  // Check if icon exists, otherwise fail gracefully
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon file missing, skipping tray instantiation.');
    return;
  }
  
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Flick', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Make a Post', click: () => { mainWindow.show(); mainWindow.webContents.send('deeplink-action', 'post'); } },
    { label: 'Add Story', click: () => { mainWindow.show(); mainWindow.webContents.send('deeplink-action', 'story'); } },
    { label: 'Send a Message', click: () => { mainWindow.show(); mainWindow.webContents.send('deeplink-action', 'message'); } },
    { type: 'separator' },
    { label: 'About Flick', click: showAboutDialog },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);
  
  tray.setToolTip('Flick by Faratech');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function setupWindowsTasks() {
  if (process.platform === 'win32') {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: 'flick://post',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'Make a Post',
        description: 'Create a new post in Flick'
      },
      {
        program: process.execPath,
        arguments: 'flick://story',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'Add Story',
        description: 'Add a new story'
      },
      {
        program: process.execPath,
        arguments: 'flick://message',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'Send a Message',
        description: 'Send a direct message'
      }
    ]);
  }
}

function showAboutDialog() {
  dialog.showMessageBox({
    title: 'About Flick',
    type: 'info',
    message: 'Flick',
    detail: 'Version: ' + app.getVersion() + '\nCompany: Faratech\n\nFlick is the secure, end-to-end encrypted communication and social platform.\n\nUpcoming Features:\n- Multi-device syncing\n- Voice/Video Rooms\n- Decentralized File Sharing',
    icon: fs.existsSync(path.join(__dirname, '../dist/icon.png'))
      ? path.join(__dirname, '../dist/icon.png')
      : path.join(__dirname, '../public/icon.png'),
    buttons: ['OK', 'Website']
  }).then(result => {
    if (result.response === 1) {
      shell.openExternal('https://faratech-flick.vercel.app');
    }
  });
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Post',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('deeplink-action', 'post');
            }
          }
        },
        {
          label: 'Add Story',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('deeplink-action', 'story');
            }
          }
        },
        {
          label: 'Send Message',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('deeplink-action', 'message');
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: 'Minimize to Tray', click: () => mainWindow.hide() }
      ]
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
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Refresh Feed',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('refresh-feed');
          }
        },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        {
          label: 'About Flick',
          click: () => {
            showAboutDialog();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for Desktop-to-Renderer communication
ipcMain.handle('get-start-on-login', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('toggle-start-on-login', (event, value) => {
  const current = app.getLoginItemSettings().openAtLogin;
  const target = typeof value === 'boolean' ? value : !current;
  app.setLoginItemSettings({
    openAtLogin: target,
    path: process.execPath
  });
  return target;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Pure Node.js PNG encoder helper for standalone badge fallback
function generateBadgePngBuffer(count) {
  const zlib = require('zlib');
  const width = 32;
  const height = 32;
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height, 0);

  const cx = 16, cy = 16, r = 13, rOuter = 15;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Neon green fill #00ff66
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 102;
        rawData[pxOffset + 3] = 255;
      } else if (dist <= rOuter) {
        // High contrast black border
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(4 + 4 + len + 4);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const toCrc = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    chunk.writeUInt32BE(crc32(toCrc), 8 + len);
    return chunk;
  }

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Dynamic badge overlay generator for Windows (.exe) Taskbar & System Tray
function createBadgeNativeImage(count, dataUrl) {
  if (!count || count <= 0) return null;

  // 1. If high-resolution rendered PNG dataUrl is provided from renderer canvas, use it directly
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png')) {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (img && !img.isEmpty()) return img;
    } catch (e) {
      console.warn('nativeImage.createFromDataURL failed:', e);
    }
  }

  // 2. Fallback to raster PNG buffer generated natively
  try {
    const pngBuffer = generateBadgePngBuffer(count);
    const img = nativeImage.createFromBuffer(pngBuffer);
    if (img && !img.isEmpty()) return img;
  } catch (e) {
    console.warn('generateBadgePngBuffer failed:', e);
  }

  return null;
}

// IPC handler for App Badge Count (Windows EXE Taskbar Counter, macOS Dock, Tray)
ipcMain.on('set-badge-count', (event, payload) => {
  const count = typeof payload === 'object' && payload !== null ? payload.count : payload;
  const dataUrl = typeof payload === 'object' && payload !== null ? payload.dataUrl : null;
  const numericCount = typeof count === 'number' && !isNaN(count) ? Math.max(0, count) : 0;
  
  // 1. macOS / Linux Unity Dock Badge
  if (app.setBadgeCount) {
    try {
      app.setBadgeCount(numericCount);
    } catch (e) {
      console.warn('app.setBadgeCount error:', e);
    }
  }

  // 2. Windows Taskbar Overlay Icon & Window Title (.exe counters)
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (numericCount > 0) {
        const badgeImg = createBadgeNativeImage(numericCount, dataUrl);
        if (badgeImg && mainWindow.setOverlayIcon) {
          mainWindow.setOverlayIcon(badgeImg, `${numericCount} unread message${numericCount > 1 ? 's' : ''}`);
        }
        mainWindow.setTitle(`(${numericCount}) Flick`);

        // Flash the taskbar icon to attract user attention if the window is in background
        if (!mainWindow.isFocused()) {
          mainWindow.flashFrame(true);
        }
      } else {
        if (mainWindow.setOverlayIcon) {
          mainWindow.setOverlayIcon(null, '');
        }
        mainWindow.setTitle('Flick');
        mainWindow.flashFrame(false);
      }
    } catch (e) {
      console.warn('mainWindow overlay icon error:', e);
    }
  }

  // 3. System Tray Tooltip & Title update
  if (tray && !tray.isDestroyed()) {
    try {
      if (numericCount > 0) {
        tray.setToolTip(`Flick - ${numericCount} unread message${numericCount > 1 ? 's' : ''}`);
        if (process.platform === 'darwin') {
          tray.setTitle(` ${numericCount}`);
        }
      } else {
        tray.setToolTip('Flick');
        if (process.platform === 'darwin') {
          tray.setTitle('');
        }
      }
    } catch (e) {
      console.warn('tray badge update error:', e);
    }
  }
});

// IPC handler for Native Notification Dispatching
ipcMain.on('show-notification', (event, { title, body, icon }) => {
  try {
    const defaultIcon = path.join(__dirname, '../dist/icon.png');
    const finalIcon = (icon && fs.existsSync(icon)) ? icon : defaultIcon;

    if (Notification.isSupported()) {
      const notif = new Notification({
        title: title || 'Flick',
        body: body || '',
        icon: finalIcon,
        silent: false
      });
      notif.show();
      notif.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
  } catch (err) {
    console.error('Failed to show native Electron notification:', err);
  }
});

// IPC handler for High-Priority Native Incoming Call Alert
ipcMain.on('incoming-call', (event, { callerName, callType, callId }) => {
  console.log('[Electron Main] Incoming call notification received for:', callerName, callId);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.flashFrame(true);
  }

  const notif = new Notification({
    title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
    body: `${callerName || 'Someone'} is calling you on Flick. Click to answer!`,
    icon: path.join(__dirname, '../dist/icon.png'),
    urgency: 'critical',
    silent: false
  });
  notif.show();
  notif.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.flashFrame(false);
      mainWindow.webContents.send('deeplink-action', 'call');
    }
  });
});

// IPC handlers for Native Media / Microphone Permissions & Diagnostics
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform === 'darwin' && systemPreferences && systemPreferences.getMediaAccessStatus) {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return { status, platform: 'darwin' };
  }
  return { status: 'granted', platform: process.platform };
});

ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin' && systemPreferences && systemPreferences.askForMediaAccess) {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { granted, status: granted ? 'granted' : 'denied', platform: 'darwin' };
  }
  return { granted: true, status: 'granted', platform: process.platform };
});

app.whenReady().then(() => {
  // Explicitly configure session-level permission request and check handlers
  // This prevents Chromium in Electron from silently denying audio / media / microphone access
  if (session && session.defaultSession) {
    // Strip Electron from User-Agent string so Google OAuth doesn't reject embedded webview with "disallowed_useragent"
    const rawUserAgent = session.defaultSession.getUserAgent();
    const cleanUserAgent = rawUserAgent.replace(/Electron\/\S+\s*/i, '');
    session.defaultSession.setUserAgent(cleanUserAgent);

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'notifications', 'mediaKeySystem'];
      if (allowed.includes(permission)) {
        console.log(`[Electron Session] Auto-approving media permission: ${permission}`);
        return callback(true);
      }
      if (details && details.mediaTypes && (details.mediaTypes.includes('audio') || details.mediaTypes.includes('video'))) {
        console.log('[Electron Session] Auto-approving mediaTypes:', details.mediaTypes);
        return callback(true);
      }
      return callback(true); // Allow internal app requests
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'notifications', 'mediaKeySystem'];
      if (allowed.includes(permission)) {
        return true;
      }
      if (details && details.mediaTypes && (details.mediaTypes.includes('audio') || details.mediaTypes.includes('video'))) {
        return true;
      }
      return true;
    });
  }

  // Ensure any newly created popup window also has clean User-Agent
  app.on('browser-window-created', (event, createdWin) => {
    if (createdWin && createdWin.webContents) {
      const raw = createdWin.webContents.userAgent;
      if (raw && raw.includes('Electron')) {
        createdWin.webContents.setUserAgent(raw.replace(/Electron\/\S+\s*/i, ''));
      }
    }
  });

  createSplash();
  createWindow();
  createTray();
  setupWindowsTasks();
  
  // Handle macOS deeplink
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.show();
    }
    handleDeeplink(url);
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Auto Updater Events
autoUpdater.on('update-available', () => {
  console.log('Update available.');
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version of Flick has been downloaded. Restart the application to apply the updates.',
    buttons: ['Restart', 'Later']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });
});

// Handle initial deeplink for Windows
if (process.platform === 'win32') {
  const deeplinkUrl = process.argv.find(arg => arg.startsWith('flick://'));
  if (deeplinkUrl) {
    setTimeout(() => {
      handleDeeplink(deeplinkUrl);
    }, 3000); // Wait for main window to be ready
  }
}
