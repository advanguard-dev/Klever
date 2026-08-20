const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kleverDesktop", {
  pickVault: () => ipcRenderer.invoke("klever:pick-vault"),
  pickLocalFile: (accept) => ipcRenderer.invoke("klever:pick-local-file", accept),
  setVaultRoot: (rootPath) => ipcRenderer.invoke("klever:set-vault-root", rootPath),
  writeVault: (rootPath, files, blobs) => ipcRenderer.invoke("klever:write-vault", { rootPath, files, blobs }),
  revealFile: (relativePath) => ipcRenderer.invoke("klever:reveal-file", relativePath),
  openFile: (relativePath) => ipcRenderer.invoke("klever:open-file", relativePath),
  revealAbsolute: (absPath) => ipcRenderer.invoke("klever:reveal-absolute", absPath),
  openAbsolute: (absPath) => ipcRenderer.invoke("klever:open-absolute", absPath),
  revealBytes: (name, dataBase64) => ipcRenderer.invoke("klever:reveal-bytes", { name, dataBase64 }),
  openBytes: (name, dataBase64) => ipcRenderer.invoke("klever:open-bytes", { name, dataBase64 }),
});
