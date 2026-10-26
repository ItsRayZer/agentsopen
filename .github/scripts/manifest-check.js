/* Verifies the public static-site inventory. Hidden .github scripts are intentionally not in the public manifest. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
assert.ok(Array.isArray(manifest.files), "manifest.files must be an array");
assert.equal(manifest.counts.files, manifest.files.length, "manifest file count must match the public inventory");

const byPath = new Map();
for (const entry of manifest.files) {
  assert.ok(entry && typeof entry.path === "string", "manifest entry must have a path");
  assert.ok(!byPath.has(entry.path), "duplicate manifest path: " + entry.path);
  const bytes = fs.readFileSync(entry.path);
  assert.equal(bytes.length, entry.bytes, "byte count mismatch: " + entry.path);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, entry.sha256, "SHA-256 mismatch: " + entry.path);
  byPath.set(entry.path, entry);
}
for (const excluded of manifest.excluded_from_manifest || []) {
  assert.equal(byPath.has(excluded), false, "excluded file unexpectedly listed in manifest: " + excluded);
}

const fileLines = fs.readFileSync("files.txt", "utf8").trim().split(/\r?\n/);
const inventory = new Map();
for (const line of fileLines) {
  const match = line.match(/^file: https:\/\/ai-ws\.vercel\.app\/([^ |]+) \| bytes=(\d+) \| sha256=([a-f0-9]{64})$/);
  assert.ok(match, "unparseable inventory row: " + line);
  assert.equal(inventory.has(match[1]), false, "duplicate files.txt path: " + match[1]);
  inventory.set(match[1], { bytes:Number(match[2]), sha256:match[3] });
}
const expectedInventory = new Set([...byPath.keys(), "manifest.json", "sitemap.xml"]);
assert.deepEqual(new Set(inventory.keys()), expectedInventory, "files.txt path set must match manifest plus manifest.json and sitemap.xml");
for (const [p,meta] of byPath) {
  const row = inventory.get(p);
  assert.equal(row.bytes, meta.bytes, "files.txt byte count mismatch: " + p);
  assert.equal(row.sha256, meta.sha256, "files.txt hash mismatch: " + p);
}
for (const p of ["manifest.json", "sitemap.xml"]) {
  const bytes = fs.readFileSync(p);
  const row = inventory.get(p);
  assert.equal(row.bytes, bytes.length, "files.txt byte count mismatch: " + p);
  assert.equal(row.sha256, crypto.createHash("sha256").update(bytes).digest("hex"), "files.txt hash mismatch: " + p);
}

const sitemap = fs.readFileSync("sitemap.xml", "utf8");
const urlPaths = Array.from(sitemap.matchAll(/<loc>https:\/\/ai-ws\.vercel\.app\/([^<]+)<\/loc>/g), m => m[1]);
assert.equal(new Set(urlPaths).size, urlPaths.length, "sitemap must not contain duplicate URLs");
assert.deepEqual(new Set(urlPaths), expectedInventory, "sitemap path set must match manifest plus manifest.json and sitemap.xml");
console.log("PASS: public manifest, files.txt and sitemap integrity (" + manifest.files.length + " public files)");
