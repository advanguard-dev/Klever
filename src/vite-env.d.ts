/// <reference types="vite/client" />

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  resolve?: (possibleDescendant: FileSystemHandle) => Promise<string[] | null>;
}

interface KleverDesktopApi {
  pickVault: () => Promise<{
    path: string;
    name: string;
    files: Record<string, string>;
    blobs: Record<string, { mime: string; dataBase64?: string; external?: boolean; localPath?: string }>;
  } | null>;
  pickLocalFile: (accept: string) => Promise<{ localPath: string; name: string; mime: string } | null>;
  setVaultRoot: (rootPath: string) => Promise<boolean>;
  writeVault: (
    rootPath: string,
    files: Record<string, string>,
    blobs: Record<string, { mime: string; dataBase64?: string; external?: boolean; localPath?: string }>,
  ) => Promise<{ ok: boolean; error?: string }>;
  revealFile: (relativePath: string) => Promise<{ ok: boolean; error?: string }>;
  openFile: (relativePath: string) => Promise<{ ok: boolean; error?: string }>;
  revealAbsolute: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
  openAbsolute: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
  revealBytes: (name: string, dataBase64: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  openBytes: (name: string, dataBase64: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
}

interface Window {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  kleverDesktop?: KleverDesktopApi;
}

interface NavigatorUAData {
  platform?: string;
}

interface Navigator {
  userAgentData?: NavigatorUAData;
}
