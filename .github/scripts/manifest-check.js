/* Verifies the public static-site inventory and reports every mismatch for repair. */
"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");

const issues = [];
function issue(message) { issues.push(message); }
function sameSet(a, b) { return a.size === b.size && Array.from(a).every(v => b.has(v)); }
function fileMeta(p) {
  try {
    const bytes = fs.readFileSync(p);
    return { bytes:bytes.length, sha256:crypto.createHash("sha256").update(bytes).digest("hex") };
  } catch (e) {
    issue("missing/unreadable file: " + p);
    return null;
  }
}
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
if (!Array.isArray(manifest.files)) throw new Error("manifest.files must be an array");
if (manifest.counts.files !== manifest.files.length) issue("manifest.counts.files=" + manifest.counts.files + " but manifest.files has " + manifest.files.length + " entries");

const byPath = new Map();
for (const entry of manifest.files) {
  if (!entry || typeof entry.path !== "string") { issue("invalid manifest entry"); continue; }
  if (byPath.has(entry.path)) { issue("duplicate manifest path: " + entry.path); continue; }
  byPath.set(entry.path, entry);
  const actual = fileMeta(entry.path);
  if (!actual) continue;
  if (actual.bytes !== entry.bytes) issue(entry.path + ": byte count expected " + entry.bytes + ", actual " + actual.bytes);
  if (actual.sha256 !== entry.sha256) issue(entry.path + ": SHA-256 expected " + entry.sha256 + ", actual " + actual.sha256);
}
for (const excluded of manifest.excluded_from_manifest || []) {
  if (byPath.has(excluded)) issue("excluded file unexpectedly listed in manifest: " + excluded);
}

const fileLines = fs.readFileSync("files.txt", "utf8").trim().split(/\r?\n/);
const inventory = new Map();
for (const line of fileLines) {
  const match = line.match(/^file: https:\/\/ai-ws\.vercel\.app\/([^ |]+) \| bytes=(\d+) \| sha256=([a-f0-9]{64})$/);
  if (!match) { issue("unparseable files.txt row: " + line); continue; }
  if (inventory.has(match[1])) { issue("duplicate files.txt path: " + match[1]); continue; }
  inventory.set(match[1], { bytes:Number(match[2]), sha256:match[3] });
}
const expectedInventory = new Set([...byPath.keys(), "manifest.json", "sitemap.xml"]);
if (!sameSet(new Set(inventory.keys()), expectedInventory)) issue("files.txt paths differ from manifest plus manifest.json and sitemap.xml");
for (const [p, entry] of byPath) {
  const row = inventory.get(p);
  if (!row) { issue("files.txt missing path: " + p); continue; }
  if (row.bytes !== entry.bytes) issue("files.txt byte count differs from manifest: " + p);
  if (row.sha256 !== entry.sha256) issue("files.txt hash differs from manifest: " + p);
}
for (const p of ["manifest.json", "sitemap.xml"]) {
  const actual = fileMeta(p);
  const row = inventory.get(p);
  if (!row || !actual) continue;
  if (row.bytes !== actual.bytes) issue("files.txt byte count mismatch for " + p + ": row " + row.bytes + ", actual " + actual.bytes);
  if (row.sha256 !== actual.sha256) issue("files.txt hash mismatch for " + p + ": row " + row.sha256 + ", actual " + actual.sha256);
}

const sitemap = fs.readFileSync("sitemap.xml", "utf8");
const urlPaths = Array.from(sitemap.matchAll(/<loc>https:\/\/ai-ws\.vercel\.app\/([^<]+)<\/loc>/g), m => m[1]);
if (new Set(urlPaths).size !== urlPaths.length) issue("sitemap contains duplicate URLs");
if (!sameSet(new Set(urlPaths), expectedInventory)) issue("sitemap paths differ from manifest plus manifest.json and sitemap.xml");
if (issues.length) {
  console.error("FAIL: public inventory integrity; " + issues.length + " issue(s)");
  issues.forEach(item => console.error(" - " + item));
  process.exitCode = 1;
} else {
  console.log("PASS: public manifest, files.txt and sitemap integrity (" + manifest.files.length + " public files)");
}
