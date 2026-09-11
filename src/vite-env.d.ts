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

type KleverGitStatus = import("@/lib/git-status").GitStatus;

interface KleverDesktopApi {
  /** Resolve absolute path for a dropped/picked File (Electron webUtils). */
  getPathForFile: (file: File) => string;
  pickVault: () => Promise<{
    path: string;
    name: string;
    files: Record<string, string>;
    blobs: Record<string, { mime: string; dataBase64?: string; external?: boolean; localPath?: string }>;
  } | null>;
  pickLocalFile: (accept: string) => Promise<
    | { localPath: string; name: string; mime: string }
    | { localPath: string; name: string; mime: string }[]
    | null
  >;
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
  /** Read a disk file for in-app preview (blob URL). Does not copy into the vault. */
  readAbsolute: (
    absPath: string,
  ) => Promise<{ ok: boolean; mime?: string; dataBase64?: string; error?: string }>;
  revealBytes: (name: string, dataBase64: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  openBytes: (name: string, dataBase64: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  touchAvailable: () => Promise<boolean>;
  touchEncrypt: (plaintext: string) => Promise<string>;
  touchUnlock: (cipherB64: string, reason: string) => Promise<string>;
  startDictation: () => Promise<{ ok: boolean; error?: string }>;
  stopDictation: () => Promise<{ ok: boolean; error?: string }>;
  askMicrophone: () => Promise<boolean>;
  fetchText: (url: string) => Promise<{ ok: boolean; text: string; status?: number; error?: string }>;
  /** Whether DEEPSEEK_API_KEY is present in the desktop process (never returns the key). */
  aiStatus: () => Promise<{ configured: boolean; endpoint: string; defaultModel: string }>;
  aiChat: (payload: {
    system?: string;
    user: string;
    model?: string;
    temperature?: number;
    requestId?: string;
  }) => Promise<{
    ok: boolean;
    content?: string;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    endpoint?: string;
    status?: number;
    aborted?: boolean;
    error?: string;
  }>;
  aiCancel: (requestId: string) => Promise<{ ok: boolean }>;
  gitStatus: () => Promise<KleverGitStatus>;
  configureLocalApi: (opts: {
    enabled: boolean;
    port: number;
    token: string;
  }) => Promise<{ ok: boolean; enabled: boolean; port: number; token: string }>;
  onEditCommand?: (handler: (action: "undo" | "redo") => void) => () => void;
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

declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";
  export function gfm(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}
