const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// App properties
app.setName('Flick');
app.setAppUserModelId('com.faratech.flick');

// Deeplinking setup
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

// Register custom protocol 'flick://'
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('flick', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('flick');
}

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
  });
}

function handleDeeplink(url) {
  if (!mainWindow) return;
  // Parse url, e.g., flick://post, flick://story, flick://message
  const action = url.replace('flick://', '').replace('/', '');
  mainWindow.webContents.send('deeplink-action', action);
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../dist/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });

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
    }, 6000);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../dist/icon.png');
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
