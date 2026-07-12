const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  dialog,
  shell,
  Notification,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");

app.setName("Flick");
if (process.platform === "win32") {
  app.setAppUserModelId("faratech.flick");
}
Menu.setApplicationMenu(null);

// ── Constants ──────────────────────────────────────────────────────────────
const GITHUB_OWNER = "rccgnsparepo-hash";
const GITHUB_REPO = "Newflick";
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ── Icon helpers ───────────────────────────────────────────────────────────
function getResourcePath(...parts) {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "build");
  return path.join(base, ...parts);
}

function getTrayIcon() {
  const p = getResourcePath("icon-tray.png");
  return nativeImage.createFromPath(fs.existsSync(p) ? p : getResourcePath("icon.png"));
}

function getAppIcon() {
  const ico = getResourcePath("icon.ico");
  const png = getResourcePath("icon.png");
  return nativeImage.createFromPath(fs.existsSync(ico) ? ico : png);
}

// ── React dist path ────────────────────────────────────────────────────────
// Lives OUTSIDE the asar so we can hot-swap it on updates without
// the user downloading the full 190 MB installer again.
function getReactDistPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "react-dist")
    : path.join(__dirname, "react-dist");
}

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Flick",
    icon: getAppIcon(),
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
    backgroundColor: "#0f0f0f",
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  const indexHtml = path.join(getReactDistPath(), "index.html");
  mainWindow.loadFile(indexHtml);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "Flick is still running",
          body: "Click the tray icon to reopen Flick.",
          silent: true,
        }).show();
      }
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function dispatchFlickAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents
      .executeJavaScript(
        `window.dispatchEvent(new CustomEvent('flick-action',{detail:{action:'${action}'}}))`
      )
      .catch(() => {});
  }
}

// ── Tray ───────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip("Flick — Encrypted Chat");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "💬  New Message", click: () => { showWindow(); dispatchFlickAction("new-message"); } },
      { label: "✓  Mark all as read", click: () => { dispatchFlickAction("mark-all-read"); if (mainWindow) mainWindow.setOverlayIcon(null, ""); } },
      { type: "separator" },
      { label: "Open Flick", click: () => showWindow() },
      { type: "separator" },
      { label: "Quit Flick", click: () => { isQuitting = true; app.quit(); } },
    ])
  );
  tray.on("click", () => showWindow());
  tray.on("double-click", () => showWindow());
}

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.on("show-notification", (_e, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body });
    n.on("click", () => showWindow());
    n.show();
  }
});

ipcMain.on("set-badge", (_e, count) => {
  if (process.platform === "win32" && mainWindow) {
    mainWindow.setOverlayIcon(count > 0 ? getTrayIcon() : null, count > 0 ? `${count}` : "");
  }
});

// ── Lightweight updater ────────────────────────────────────────────────────
// Instead of re-downloading the full 190 MB installer every update,
// this fetches only the react-dist.zip (~3-5 MB) from the latest GitHub
// release, extracts it, and restarts. The Electron binary itself never
// needs to change unless you explicitly update it.
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Flick-Updater" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) =>
      https.get(u, { headers: { "User-Agent": "Flick-Updater" } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301)
          return follow(res.headers.location);
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on("finish", () => stream.close(resolve));
        stream.on("error", reject);
      }).on("error", reject);
    follow(url);
  });
}

function getCurrentVersion() {
  try {
    return require(path.join(getReactDistPath(), "flick-version.json")).version;
  } catch {
    return "0.0.0";
  }
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function checkAndApplyUpdate() {
  try {
    const release = await fetchJson(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
    );

    const latestTag = release.tag_name || "";
    const currentVersion = getCurrentVersion();

    if (compareVersions(latestTag, currentVersion) <= 0) return; // already up to date

    const asset = (release.assets || []).find((a) => a.name === "react-dist.zip");
    if (!asset) return; // no lightweight update package in this release

    // Notify the React app that an update is available
    if (mainWindow) mainWindow.webContents.send("update-available", { version: latestTag });

    // Download in the background
    const tmpZip = path.join(os.tmpdir(), "flick-react-dist.zip");
    await downloadFile(asset.browser_download_url, tmpZip);

    // Extract with adm-zip — replaces react-dist in resources/
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(tmpZip);
    const destDir = getReactDistPath();

    // Swap: extract to a temp folder first then rename atomically
    const tmpDest = destDir + "_new";
    if (fs.existsSync(tmpDest)) fs.rmSync(tmpDest, { recursive: true });
    zip.extractAllTo(tmpDest, true);
    fs.rmSync(destDir, { recursive: true });
    fs.renameSync(tmpDest, destDir);
    fs.unlinkSync(tmpZip);

    // Tell renderer — it can show a "Restart to apply update" banner
    if (mainWindow) mainWindow.webContents.send("update-ready", { version: latestTag });

    // Show native dialog
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Flick Update Ready",
      message: `Version ${latestTag} is ready.\nRestart Flick now to apply it?`,
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    });

    if (response === 0) {
      isQuitting = true;
      app.relaunch();
      app.quit();
    }
  } catch (err) {
    console.error("Flick updater:", err.message);
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  createWindow();

  if (app.isPackaged) {
    // First check after 10 s (don't block startup), then every 30 min
    setTimeout(() => checkAndApplyUpdate(), 10_000);
    setInterval(() => checkAndApplyUpdate(), UPDATE_CHECK_INTERVAL);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => { isQuitting = true; });
app.on("window-all-closed", () => {
  if (isQuitting && process.platform !== "darwin") app.quit();
});
