const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("kleverDesktop", {
  /** Electron 32+ — File.path was removed; use this for drops / file inputs. */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  },
  pickVault: () => ipcRenderer.invoke("klever:pick-vault"),
  pickLocalFile: (accept) => ipcRenderer.invoke("klever:pick-local-file", accept),
  setVaultRoot: (rootPath) => ipcRenderer.invoke("klever:set-vault-root", rootPath),
  writeVault: (rootPath, files, blobs) => ipcRenderer.invoke("klever:write-vault", { rootPath, files, blobs }),
  revealFile: (relativePath) => ipcRenderer.invoke("klever:reveal-file", relativePath),
  openFile: (relativePath) => ipcRenderer.invoke("klever:open-file", relativePath),
  revealAbsolute: (absPath) => ipcRenderer.invoke("klever:reveal-absolute", absPath),
  openAbsolute: (absPath) => ipcRenderer.invoke("klever:open-absolute", absPath),
  revealBytes: (name, dataBase64) => ipcRenderer.invoke("klever:reveal-bytes", { name, dataBase64 }),
  readAbsolute: (absPath) => ipcRenderer.invoke("klever:read-absolute", absPath),
  openBytes: (name, dataBase64) => ipcRenderer.invoke("klever:open-bytes", { name, dataBase64 }),
  touchAvailable: () => ipcRenderer.invoke("klever:touch-available"),
  touchEncrypt: (plaintext) => ipcRenderer.invoke("klever:touch-encrypt", plaintext),
  touchUnlock: (cipherB64, reason) => ipcRenderer.invoke("klever:touch-unlock", cipherB64, reason),
  startDictation: () => ipcRenderer.invoke("klever:start-dictation"),
  stopDictation: () => ipcRenderer.invoke("klever:stop-dictation"),
  askMicrophone: () => ipcRenderer.invoke("klever:ask-microphone"),
  fetchText: (url) => ipcRenderer.invoke("klever:fetch-text", url),
  aiStatus: () => ipcRenderer.invoke("klever:ai-status"),
  aiChat: (payload) => ipcRenderer.invoke("klever:ai-chat", payload),
  aiCancel: (requestId) => ipcRenderer.invoke("klever:ai-cancel", requestId),
  gitStatus: () => ipcRenderer.invoke("klever:git-status"),
  configureLocalApi: (opts) => ipcRenderer.invoke("klever:configure-local-api", opts),
  onEditCommand: (handler) => {
    const listener = (_event, action) => {
      if (action === "undo" || action === "redo") handler(action);
    };
    ipcRenderer.on("klever:edit", listener);
    return () => ipcRenderer.removeListener("klever:edit", listener);
  },
});
