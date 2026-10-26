/* Static contract smoke test for the standalone review page. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("review-exchange.html", "utf8");
const ui = fs.readFileSync("review-exchange-ui.js", "utf8");
const core = fs.readFileSync("review-exchange-core.js", "utf8");
const css = fs.readFileSync("review-exchange.css", "utf8");

for (const file of ["review-exchange-validator.js", "review-exchange-core.js", "cloud.js", "review-exchange-ui.js"]) {
  assert.ok(html.includes('src="' + file + '"'), "page must load " + file);
  assert.ok(fs.existsSync(file), "script file must exist: " + file);
}
assert.ok(html.includes('href="review-exchange.css"'));
assert.ok(html.includes('id="artifactForm"'));
assert.ok(fs.readFileSync("index.html", "utf8").includes('href="review-exchange.html"'), "main workspace must link to the review page");
assert.ok(JSON.parse(fs.readFileSync("agent.json", "utf8")).routes.review_exchange === "/review-exchange.html", "agents must discover the review route");
assert.ok(html.includes('id="importJsonBtn"'));
assert.ok(html.includes('id="exportBundleBtn"'));
assert.ok(html.includes('id="compareRunBtn"'));
assert.ok(html.includes('id="benchmarkForm"'));
assert.ok(html.includes('id="workflowForm"'));
assert.ok(html.includes('id="confirmPublicPublish"'), "public publication must require explicit consent");
assert.ok(html.includes('id="publishSelectedPublicBtn"'), "public publication control must exist");
assert.ok(html.includes('id="loadPublicRecordsBtn"'), "public record search control must exist");
assert.ok(ui.includes('if (!qs("confirmPublicPublish").checked)'), "public publication must be gated by the consent checkbox");
assert.ok(ui.includes("AIWorkspaceCloud.publishPack(prepared.pack)"), "public records must use the existing public pack API");
assert.ok(ui.includes('importCloudPack(String(cloudId))'), "publish result must be confirmed by direct read-back");
assert.ok(core.includes("Public record payload is missing."), "the public pack decoder must fail closed on missing payload");

assert.ok(css.includes("@media (max-width: 640px)"), "responsive mobile styling is required");
assert.ok(ui.includes("source text is never saved") || ui.includes("Source text is never saved") || ui.includes("source text"), "page must communicate the local source boundary");
assert.equal(/\bfetch\s*\(/.test(ui), false, "the UI must not fetch arbitrary URLs");
assert.equal(/XMLHttpRequest/.test(ui), false, "the UI must not use arbitrary XHR");
assert.equal(/\.innerHTML\s*=/.test(ui), false, "untrusted text must not be rendered with innerHTML");
assert.equal(/\beval\s*\(/.test(ui), false, "the UI must not eval supplied content");
assert.ok(core.includes("no network fetch; no code execution"));
console.log("PASS: Review Exchange static UI contract");
