const { app, BrowserWindow, Menu, shell, session, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const isDev = !app.isPackaged;
const DEV_URL = process.env.KLEVER_DEV_URL || "http://127.0.0.1:5173/";
let vaultRoot = null;

function mimeFromName(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    txt: "text/plain",
    md: "text/markdown",
  };
  return map[ext] || "application/octet-stream";
}

function filtersForAccept(accept) {
  if (!accept || accept === "*/*") return [{ name: "All files", extensions: ["*"] }];
  if (accept === "image/*") {
    return [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"] }];
  }
  if (accept === "audio/*") {
    return [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"] }];
  }
  if (accept === "video/*") {
    return [{ name: "Video", extensions: ["mp4", "mov", "webm", "mkv"] }];
  }
  return [{ name: "All files", extensions: ["*"] }];
}

function walkVaultDir(dir, prefix = "") {
  const files = {};
  const blobs = {};
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".") && name !== ".originals") continue;
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const nested = walkVaultDir(full, rel);
      Object.assign(files, nested.files);
      Object.assign(blobs, nested.blobs);
    } else if (name.endsWith(".md")) {
      files[rel] = fs.readFileSync(full, "utf8");
    } else {
      const buf = fs.readFileSync(full);
      blobs[rel] = {
        mime: mimeFromName(name),
        dataBase64: buf.toString("base64"),
      };
    }
  }
  return { files, blobs };
}

async function writeVaultPath(root, relPath, data) {
  const parts = relPath.split("/");
  const filename = parts.pop();
  if (!filename) return;
  const dir = parts.length ? path.join(root, ...parts) : root;
  fs.mkdirSync(dir, { recursive: true });
  const payload = typeof data === "string" ? data : Buffer.from(data, "base64");
  fs.writeFileSync(path.join(dir, filename), payload);
}

function registerIpc() {
  ipcMain.handle("klever:set-vault-root", (_, rootPath) => {
    vaultRoot = rootPath || null;
    return true;
  });

  ipcMain.handle("klever:pick-vault", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    vaultRoot = result.filePaths[0];
    const walked = walkVaultDir(vaultRoot);
    return {
      path: vaultRoot,
      name: path.basename(vaultRoot),
      files: walked.files,
      blobs: walked.blobs,
    };
  });

  ipcMain.handle("klever:write-vault", async (_, payload) => {
    const root = payload?.rootPath || vaultRoot;
    if (!root) return { ok: false, error: "no-root" };
    vaultRoot = root;
    const files = payload?.files ?? {};
    const blobs = payload?.blobs ?? {};
    for (const [rel, content] of Object.entries(files)) {
      await writeVaultPath(root, rel, content);
    }
    for (const [rel, rec] of Object.entries(blobs)) {
      if (!rec || rec.external || rec.localPath) continue;
      if (rec.dataBase64) await writeVaultPath(root, rel, rec.dataBase64);
    }
    return { ok: true };
  });

  ipcMain.handle("klever:reveal-file", (_, relPath) => {
    if (!vaultRoot || !relPath) return { ok: false, error: "no-root" };
    const full = path.join(vaultRoot, relPath);
    if (!fs.existsSync(full)) return { ok: false, error: "missing" };
    shell.showItemInFolder(full);
    return { ok: true };
  });

  ipcMain.handle("klever:open-file", (_, relPath) => {
    if (!vaultRoot || !relPath) return { ok: false, error: "no-root" };
    const full = path.join(vaultRoot, relPath);
    if (!fs.existsSync(full)) return { ok: false, error: "missing" };
    void shell.openPath(full);
    return { ok: true };
  });

  ipcMain.handle("klever:open-absolute", (_, absPath) => {
    if (!absPath || !fs.existsSync(absPath)) return { ok: false, error: "missing" };
    void shell.openPath(absPath);
    return { ok: true };
  });

  ipcMain.handle("klever:reveal-absolute", (_, absPath) => {
    if (!absPath || !fs.existsSync(absPath)) return { ok: false, error: "missing" };
    shell.showItemInFolder(absPath);
    return { ok: true };
  });

  ipcMain.handle("klever:pick-local-file", async (_, accept) => {
    const filters = filtersForAccept(accept);
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: filters.length ? filters : [{ name: "All files", extensions: ["*"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const localPath = result.filePaths[0];
    return {
      localPath,
      name: path.basename(localPath),
      mime: mimeFromName(localPath),
    };
  });

  ipcMain.handle("klever:reveal-bytes", (_, payload) => {
    const name = payload?.name || "file";
    const dataBase64 = payload?.dataBase64;
    if (!dataBase64) return { ok: false, error: "empty" };
    const dir = path.join(app.getPath("userData"), "klever-open");
    fs.mkdirSync(dir, { recursive: true });
    const safe = path.basename(name).replace(/[<>:"/\\|?*]/g, "-") || "file";
    const full = path.join(dir, safe);
    fs.writeFileSync(full, Buffer.from(dataBase64, "base64"));
    shell.showItemInFolder(full);
    return { ok: true, path: full };
  });

  ipcMain.handle("klever:open-bytes", (_, payload) => {
    const name = payload?.name || "file";
    const dataBase64 = payload?.dataBase64;
    if (!dataBase64) return { ok: false, error: "empty" };
    const dir = path.join(app.getPath("userData"), "klever-open");
    fs.mkdirSync(dir, { recursive: true });
    const safe = path.basename(name).replace(/[<>:"/\\|?*]/g, "-") || "file";
    const full = path.join(dir, safe);
    fs.writeFileSync(full, Buffer.from(dataBase64, "base64"));
    void shell.openPath(full);
    return { ok: true, path: full };
  });
}
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": ["same-origin"],
  "Cross-Origin-Embedder-Policy": ["require-corp"],
  "Cross-Origin-Resource-Policy": ["same-origin"],
};

function patchHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders ?? {}) };
    for (const [key, value] of Object.entries(isolationHeaders)) {
      responseHeaders[key] = value;
    }
    callback({ responseHeaders });
  });
}

function buildMenu() {
  const edit = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  };

  const view = {
    label: "View",
    submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "togglefullscreen" }],
  };

  const windowMenu = {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
  };

  const template =
    process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          edit,
          view,
          windowMenu,
        ]
      : [{ role: "fileMenu" }, edit, view, windowMenu, { role: "help" }];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 920,
    minHeight: 640,
    show: false,
    title: "Klever",
    backgroundColor: "#f3f1eb",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.once("ready-to-show", () => win.show());

  win.on("close", (e) => {
    if (win.isDestroyed() || win.__kleverClosing) return;
    e.preventDefault();
    win.__kleverClosing = true;
    const done = () => {
      if (!win.isDestroyed()) win.destroy();
    };
    win.webContents
      .executeJavaScript("window.__kleverFlush?.()", true)
      .catch(() => {})
      .finally(done);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  if (isDev) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    patchHeaders();
    registerIpc();
    buildMenu();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
