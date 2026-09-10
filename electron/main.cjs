const { app, BrowserWindow, Menu, shell, session, ipcMain, dialog, safeStorage, systemPreferences, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");

const isDev = !app.isPackaged;
const DEV_URL = process.env.KLEVER_DEV_URL || "http://127.0.0.1:5173/";
let vaultRoot = null;
let localApiServer = null;
let localApiConfig = { enabled: false, port: 7431, token: "" };

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
    if (name.startsWith(".") && name !== ".originals" && name !== ".klever-folder.md") continue;
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
      properties: ["openFile", "multiSelections"],
      filters: filters.length ? filters : [{ name: "All files", extensions: ["*"] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths.map((localPath) => ({
      localPath,
      name: path.basename(localPath),
      mime: mimeFromName(localPath),
    }));
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

  ipcMain.handle("klever:touch-available", () => {
    try {
      return (
        process.platform === "darwin" &&
        typeof systemPreferences.canPromptTouchID === "function" &&
        systemPreferences.canPromptTouchID() &&
        typeof safeStorage.isEncryptionAvailable === "function" &&
        safeStorage.isEncryptionAvailable()
      );
    } catch {
      return false;
    }
  });

  ipcMain.handle("klever:touch-encrypt", (_, plaintext) => {
    if (typeof plaintext !== "string" || !plaintext) throw new Error("Nothing to store");
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Keychain is not available");
    return safeStorage.encryptString(plaintext).toString("base64");
  });

  ipcMain.handle("klever:touch-unlock", async (_, cipherB64, reason) => {
    if (process.platform !== "darwin") throw new Error("Touch ID is only available on Mac");
    if (typeof systemPreferences.promptTouchID !== "function") {
      throw new Error("Touch ID is not available");
    }
    await systemPreferences.promptTouchID(reason || "Unlock Klever");
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Keychain is not available");
    if (typeof cipherB64 !== "string" || !cipherB64) throw new Error("No stored key");
    return safeStorage.decryptString(Buffer.from(cipherB64, "base64"));
  });

  ipcMain.handle("klever:start-dictation", () => startSystemDictation());
  ipcMain.handle("klever:stop-dictation", () => stopSystemDictation());

  ipcMain.handle("klever:fetch-text", async (_, url) => {
    if (typeof url !== "string" || !url.trim()) {
      return { ok: false, text: "", error: "Missing URL" };
    }
    let parsed;
    try {
      parsed = new URL(url.trim());
    } catch {
      return { ok: false, text: "", error: "That calendar URL is not valid." };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, text: "", error: "Calendar feeds must be http or https." };
    }
    try {
      const res = await net.fetch(parsed.toString(), { redirect: "follow" });
      const text = await res.text();
      if (text.length > 8 * 1024 * 1024) {
        return { ok: false, text: "", status: res.status, error: "That calendar feed is too large." };
      }
      if (!res.ok) {
        return { ok: false, text: "", status: res.status, error: `ICS feed returned ${res.status}` };
      }
      return { ok: true, text, status: res.status };
    } catch (err) {
      return { ok: false, text: "", error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("klever:git-status", () => gitStatusForVault());

  ipcMain.handle("klever:configure-local-api", (_, opts) => {
    localApiConfig = {
      enabled: Boolean(opts?.enabled),
      port: Number(opts?.port) > 0 ? Number(opts.port) : 7431,
      token: typeof opts?.token === "string" ? opts.token : "",
    };
    stopLocalApiServer();
    if (localApiConfig.enabled) startLocalApiServer();
    return { ok: true, ...localApiConfig };
  });
}

function titleFromMarkdown(rel, raw) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (fm) {
    const m = /^title:\s*(.+)$/m.exec(fm[1]);
    if (m) {
      let t = m[1].trim();
      if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        t = t.slice(1, -1);
      }
      if (t) return t;
    }
  }
  const heading = /^#\s+(.+)$/m.exec(raw);
  if (heading) return heading[1].trim();
  return path.basename(rel, path.extname(rel));
}

function listNotesFromVault() {
  if (!vaultRoot) return [];
  const walked = walkVaultDir(vaultRoot);
  return Object.entries(walked.files).map(([rel, raw]) => ({
    path: rel,
    title: titleFromMarkdown(rel, raw),
  }));
}

function noteByPath(relPath) {
  if (!vaultRoot || !relPath) return null;
  const full = path.join(vaultRoot, relPath);
  if (!full.startsWith(vaultRoot) || !fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, "utf8");
  return { path: relPath, title: titleFromMarkdown(relPath, raw), body: raw };
}

function gitStatusForVault() {
  if (!vaultRoot) {
    return Promise.resolve({ ok: false, files: [], error: "No vault folder linked." });
  }
  return new Promise((resolve) => {
    execFile("git", ["status", "--porcelain", "-b"], { cwd: vaultRoot, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        resolve({
          ok: false,
          files: [],
          error: err.message || "git status failed",
        });
        return;
      }
      const lines = String(stdout || "")
        .split("\n")
        .map((l) => l.trimEnd())
        .filter(Boolean);
      let branch;
      const files = [];
      const codeLabel = {
        M: "modified",
        A: "added",
        D: "deleted",
        R: "renamed",
        C: "copied",
        "?": "untracked",
        "!": "ignored",
        U: "unmerged",
      };
      for (const line of lines) {
        if (line.startsWith("##")) {
          branch = line.replace(/^##\s*/, "").split("...")[0]?.trim();
          continue;
        }
        const code = line.slice(0, 2);
        const filePath = line.slice(3).trim();
        if (!filePath) continue;
        const c = code.trim().slice(-1) || code.trim()[0] || "?";
        files.push({
          path: filePath,
          code: code.trim() || "?",
          label: codeLabel[c] ?? code.trim() || "changed",
        });
      }
      resolve({ ok: true, branch, files });
    });
  });
}

function stopLocalApiServer() {
  if (!localApiServer) return;
  try {
    localApiServer.close();
  } catch {
    /* already closed */
  }
  localApiServer = null;
}

function startLocalApiServer() {
  stopLocalApiServer();
  const port = localApiConfig.port;
  const token = localApiConfig.token;
  const server = http.createServer((req, res) => {
    const send = (status, body) => {
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      });
      res.end(payload);
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
      });
      res.end();
      return;
    }

    const auth = req.headers.authorization || "";
    const expected = `Bearer ${token}`;
    if (!token || auth !== expected) {
      send(401, { error: "unauthorized" });
      return;
    }

    let url;
    try {
      url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    } catch {
      send(400, { error: "bad-request" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      send(200, { ok: true, vault: Boolean(vaultRoot) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/notes") {
      const notePath = url.searchParams.get("path");
      if (notePath) {
        const note = noteByPath(notePath);
        if (!note) {
          send(404, { error: "not-found" });
          return;
        }
        send(200, note);
        return;
      }
      send(200, { notes: listNotesFromVault() });
      return;
    }

    send(404, { error: "not-found" });
  });

  server.on("error", (err) => {
    console.error("Klever local API failed", err);
    localApiServer = null;
  });

  server.listen(port, "127.0.0.1", () => {
    localApiServer = server;
  });
}

function focusAppForDictation() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return;
  win.focus();
  win.webContents.focus();
}

function startSystemDictation() {
  if (process.platform !== "darwin") return { ok: false, error: "mac-only" };
  focusAppForDictation();
  setTimeout(() => {
    Menu.sendActionToFirstResponder("startDictation:");
  }, 40);
  return { ok: true };
}

function stopSystemDictation() {
  if (process.platform !== "darwin") return { ok: false, error: "mac-only" };
  Menu.sendActionToFirstResponder("stopDictation:");
  return { ok: true };
}

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": ["same-origin"],
  "Cross-Origin-Embedder-Policy": ["require-corp"],
  "Cross-Origin-Resource-Policy": ["same-origin"],
};

function isKleverFirstParty(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") return true;
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.hostname === "127.0.0.1" || u.hostname === "localhost";
  } catch {
    return false;
  }
}

function patchHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Only stamp COOP/COEP/CORP on Klever itself. Rewriting third-party
    // responses (Cal.com iframes) as CORP: same-origin blanks the embed.
    if (!isKleverFirstParty(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
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
      ...(process.platform === "darwin"
        ? [
            { type: "separator" },
            {
              label: "Start Dictation…",
              click: () => startSystemDictation(),
            },
            {
              label: "Stop Dictation",
              click: () => stopSystemDictation(),
            },
          ]
        : []),
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
