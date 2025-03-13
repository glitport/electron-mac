const { app, BrowserWindow, session, ipcMain, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// Configure logging
log.transports.file.level = "info";
autoUpdater.logger = log;
log.info("App starting...");

let mainWindow;
const server = "https://update.electronjs.org";
const feedURL = `${server}/glitport/AuthoIPTV/${process.platform}-${
  process.arch
}/${app.getVersion()}`;

let currentHeaders = {}; // Store current headers

let updateAvailable = false;

autoUpdater.setFeedURL({
  provider: "github",
  repo: "AuthoIPTV",
  owner: "glitport",
  url: feedURL,
});
autoUpdater.autoDownload = false;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    minWidth: 1280,
    minHeight: 720,
    width: 1360,
    height: 768,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: !app.isPackaged,
    },
    icon: path.join(__dirname, "../icons/win/icon.ico"),
  });

  // Intercept requests and apply dynamic headers
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (details, callback) => {
      details.requestHeaders = { ...details.requestHeaders, ...currentHeaders };
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../index.html")).catch((err) => {
      log.error("Error loading file:", err);
    });
  } else {
    mainWindow.loadURL("http://localhost:3000");
  }

  // Detect fullscreen change and send status to renderer
  // mainWindow.on("enter-full-screen", () => {
  //   mainWindow.webContents.send("fullscreen-changed", true);
  // });

  // mainWindow.on("leave-full-screen", () => {
  //   mainWindow.webContents.send("fullscreen-changed", false);
  // });

  // Check for updates when app starts
  autoUpdater.checkForUpdates();
});

// Listen for updated headers from React
ipcMain.on("update-headers", (event, headers) => {
  currentHeaders = headers; // Update headers dynamically
});

// Handle full screen toggle via IPC
ipcMain.on("toggle-full-screen", () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.on("start-update", () => {
  if (updateAvailable) {
    autoUpdater.downloadUpdate();
  }
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

// Set default user agent
ipcMain.on("set-electron-user-agent", () => {
  const userAgent = mainWindow.webContents.getUserAgent();
  currentHeaders["User-Agent"] = modifyUserAgent(userAgent);
});

// Auto updater codes
autoUpdater.on("update-available", (info) => {
  log.info("Update available:", info);
  updateAvailable = true;
  mainWindow.webContents.send("update-available", info);
});

autoUpdater.on("download-progress", (progressObj) => {
  mainWindow.webContents.send("update-progress", progressObj);
});

autoUpdater.on("update-downloaded", () => {
  log.info("Update downloaded. Update will be installed after next restart.");
  mainWindow.webContents.send("update-downloaded");
});

autoUpdater.on("update-not-available", () => {
  log.info("No updates available.");
});

autoUpdater.on("error", (err) => {
  log.error("Error in auto-updater:", err);
  mainWindow.webContents.send("update-error", err.message);
});

// Function to modify User-Agent
const modifyUserAgent = (defaultUserAgent) => {
  // Replace "Mozilla/5.0" and "Chrome/version" with "IPTVApp"
  const customUserAgent = defaultUserAgent
    .replace(/Mozilla\/[^\s]+/, "AuthoIPTV") // Replace "Mozilla/version" with "IPTVApp"
    .replace(/Chrome\/[^\s]+/, "") // Remove Chrome/version
    .replace(/Safari\/[^\s]+/, "") // Remove Safari/version
    .trim() // Remove any extra spaces
    .replace(/\s+/g, " "); // Ensure only a single space between elements

  return customUserAgent;
};
