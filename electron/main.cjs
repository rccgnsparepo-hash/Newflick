const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, Notification, screen } = require('electron');
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

// Register custom protocol 'flick://'
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('flick', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('flick');
}

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
    // Handle Windows deeplink on second instance
    const deeplinkUrl = commandLine.find(arg => arg.startsWith('flick://'));
    if (deeplinkUrl) {
      handleDeeplink(deeplinkUrl);
    }
    
    // Handle Windows file association on second instance
    const filePath = commandLine.find(arg => !arg.startsWith('flick://') && fs.existsSync(arg) && path.extname(arg).toLowerCase() === '.flick');
    if (filePath) {
      handleFileOpen(filePath);
    }
  });
}

function handleDeeplink(url) {
  if (!mainWindow) return;
  // Parse url, e.g., flick://post, flick://story, flick://message
  const action = url.replace('flick://', '').replace('/', '');
  mainWindow.webContents.send('deeplink-action', action);
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

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../dist/icon.png'),
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
  
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
  const iconPath = path.join(__dirname, '../dist/icon.png');
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
    icon: path.join(__dirname, '../dist/icon.png'),
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

// IPC handler for Native Notification Dispatching
ipcMain.on('show-notification', (event, { title, body, icon }) => {
  const notif = new Notification({
    title: title || 'Flick',
    body: body,
    icon: icon || path.join(__dirname, '../dist/icon.png'),
    silent: false
  });
  notif.show();
  notif.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.whenReady().then(() => {
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
