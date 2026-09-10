#!/usr/bin/env node
/**
 * Klever CLI — local vault read/query (no cloud).
 * Usage:
 *   klever list <vault>
 *   klever get <vault> <path-or-title>
 *   klever search <vault> <query>
 *   klever db <vault> <database-title>
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [cmd, vaultArg, ...rest] = process.argv.slice(2);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
  console.log(`Klever CLI (local-first)

  klever list <vault>                 List markdown notes
  klever get <vault> <path|title>     Print one note
  klever search <vault> <query>       Substring search
  klever db <vault> <database-title>  List rows of a database

Vault is a folder of .md / .database.md files.`);
  process.exit(0);
}

if (!vaultArg) die("Missing vault path. Try: klever help");

const vault = path.resolve(vaultArg);
if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
  die(`Not a directory: ${vault}`);
}

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, base, out);
    else if (/\.(md|database\.md)$/i.test(name) || name.endsWith(".md")) {
      out.push(path.relative(base, abs).replace(/\\/g, "/"));
    }
  }
  return out;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { data: {}, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const data = {};
  for (const line of fm.split("\n")) {
    const m = /^(\w[\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    data[m[1]] = v;
  }
  return { data, body };
}

function loadNotes() {
  return walk(vault).map((rel) => {
    const raw = fs.readFileSync(path.join(vault, rel), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const title = data.title || path.basename(rel, path.extname(rel));
    return { path: rel, title, type: data.type || (rel.includes(".database") ? "database" : "page"), parent: data.parent, body, raw };
  });
}

if (cmd === "list") {
  for (const n of loadNotes()) {
    console.log(`${n.type.padEnd(8)} ${n.path}\t${n.title}`);
  }
  process.exit(0);
}

if (cmd === "get") {
  const q = rest.join(" ").trim();
  if (!q) die("Usage: klever get <vault> <path-or-title>");
  const notes = loadNotes();
  const hit =
    notes.find((n) => n.path === q) ||
    notes.find((n) => n.title.toLowerCase() === q.toLowerCase()) ||
    notes.find((n) => n.path.toLowerCase().includes(q.toLowerCase()));
  if (!hit) die(`Not found: ${q}`);
  console.log(hit.raw);
  process.exit(0);
}

if (cmd === "search") {
  const q = rest.join(" ").trim().toLowerCase();
  if (!q) die("Usage: klever search <vault> <query>");
  for (const n of loadNotes()) {
    if (`${n.title}\n${n.body}`.toLowerCase().includes(q)) {
      console.log(`${n.path}\t${n.title}`);
    }
  }
  process.exit(0);
}

if (cmd === "db") {
  const q = rest.join(" ").trim();
  if (!q) die("Usage: klever db <vault> <database-title>");
  const notes = loadNotes();
  const db =
    notes.find((n) => n.type === "database" && n.title.toLowerCase() === q.toLowerCase()) ||
    notes.find((n) => n.path.toLowerCase().includes(q.toLowerCase()) && n.type === "database");
  if (!db) die(`Database not found: ${q}`);
  const rows = notes.filter((n) => n.parent === db.path || n.parent === db.title || String(n.parent) === String(db.data?.id));
  // parent is usually note id in app; on disk frontmatter may use id — list children by folder heuristic
  const byFolder = notes.filter(
    (n) => n.path !== db.path && (n.path.startsWith(path.dirname(db.path) + "/") || n.parent),
  );
  console.log(`# ${db.title} (${db.path})`);
  const listed = rows.length ? rows : byFolder.filter((n) => n.type === "page");
  for (const r of listed) console.log(`- ${r.title}\t${r.path}`);
  process.exit(0);
}

die(`Unknown command: ${cmd}. Try: klever help`);

// keep import for ESM tooling
void pathToFileURL;
