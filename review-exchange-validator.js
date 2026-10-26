/* AI Workspace Review Exchange validator 0.1.0.
 * Deterministic metadata validation only. No network, no code execution, no trust verdict.
 * This is a semantic guard for local drafts; use a full JSON Schema validator where available.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AIWSReviewValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "review-exchange-0.1.0";
  var ARTIFACT_TYPES = ["agent", "skill", "tool", "mcp-server", "workflow", "prompt-pack", "model-adapter", "protocol-schema", "benchmark-suite"];
  var ARTIFACT_STATUSES = ["draft", "published", "withdrawn", "superseded", "moderated"];
  var REVIEWER_TYPES = ["deterministic-check", "sandbox-test", "model-agent", "human", "maintainer", "community"];
  var CHECK_STATUSES = ["passed", "failed", "blocked", "skipped", "not-run"];
  var DISPOSITIONS = ["promising", "usable-with-caveats", "needs-fixes", "unsafe-to-use", "insufficient-evidence"];
  var SEVERITIES = ["critical", "high", "medium", "low", "info", "unknown"];
  var HASH_RE = /^sha256:[a-f0-9]{64}$/;
  var ID_RE = /^[a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?$/;

  function isObject(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function add(errors, path, code, message) { errors.push({ path: path, code: code, message: message }); }
  function checkString(o, key, required, max, errors, path) {
    var v = o[key];
    if (v === undefined) {
      if (required) add(errors, path + "." + key, "required", "Required string is missing.");
      return;
    }
    if (v === null || typeof v !== "string" || (required && !v.trim())) add(errors, path + "." + key, "type", "Expected a non-empty string.");
    else if (max && v.length > max) add(errors, path + "." + key, "max-length", "String exceeds " + max + " characters.");
  }
  function checkEnum(o, key, values, required, errors, path) {
    var v = o[key];
    if (v === undefined) {
      if (required) add(errors, path + "." + key, "required", "Required value is missing.");
    } else if (values.indexOf(v) < 0) add(errors, path + "." + key, "enum", "Unsupported value.");
  }
  function checkArray(o, key, required, max, errors, path) {
    var v = o[key];
    if (v === undefined) {
      if (required) add(errors, path + "." + key, "required", "Required array is missing.");
      return null;
    }
    if (!Array.isArray(v)) { add(errors, path + "." + key, "type", "Expected an array."); return null; }
    if (max && v.length > max) add(errors, path + "." + key, "max-items", "Array exceeds " + max + " items.");
    return v;
  }
  function checkDate(o, key, required, errors, path) {
    checkString(o, key, required, 64, errors, path);
    if (typeof o[key] === "string" && !/^\d{4}-\d{2}-\d{2}T/.test(o[key])) add(errors, path + "." + key, "date-time", "Expected an ISO-style date-time.");
    else if (typeof o[key] === "string" && isNaN(Date.parse(o[key]))) add(errors, path + "." + key, "date-time", "Date-time could not be parsed.");
  }
  function checkStringArray(o, key, maxItems, maxLen, errors, path) {
    var arr = checkArray(o, key, false, maxItems, errors, path);
    if (!arr) return;
    arr.forEach(function (v, i) {
      if (typeof v !== "string" || !v.trim()) add(errors, path + "." + key + "[" + i + "]", "type", "Expected a non-empty string.");
      else if (v.length > maxLen) add(errors, path + "." + key + "[" + i + "]", "max-length", "Item exceeds " + maxLen + " characters.");
    });
  }
  function checkKeys(o, allowed, errors, path) {
    Object.keys(o).forEach(function (key) {
      if (allowed.indexOf(key) < 0) add(errors, path + "." + key, "unknown-field", "Unknown fields are rejected to avoid silently ignored claims.");
    });
  }
  function validateArtifact(o, errors) {
    var path = "artifact";
    checkKeys(o, ["schemaVersion","recordType","artifactId","artifactType","name","summary","version","sourceUrl","sourceRevision","contentHash","license","tags","capabilities","permissions","dependencies","supportedRuntimes","dataHandling","networkAccess","sideEffects","requiredSecrets","installInstructions","status","visibility","createdAt","submitter"], errors, path);
    checkString(o, "schemaVersion", true, 80, errors, path);
    if (o.schemaVersion !== VERSION) add(errors, path + ".schemaVersion", "version", "Unsupported schema version.");
    if (o.recordType !== "artifact") add(errors, path + ".recordType", "record-type", "Expected recordType=artifact.");
    checkString(o, "artifactId", true, 120, errors, path);
    if (typeof o.artifactId === "string" && !ID_RE.test(o.artifactId)) add(errors, path + ".artifactId", "id-format", "Use lowercase letters, digits, dot, underscore, or hyphen.");
    checkEnum(o, "artifactType", ARTIFACT_TYPES, true, errors, path);
    checkString(o, "name", true, 160, errors, path);
    checkString(o, "summary", false, 2000, errors, path);
    checkString(o, "version", true, 120, errors, path);
    checkString(o, "sourceUrl", false, 2048, errors, path);
    if (o.sourceUrl !== undefined && (typeof o.sourceUrl !== "string" || !/^https?:\/\/[^/\s?#]+(?:[/?#][^\s]*)?$/i.test(o.sourceUrl))) add(errors, path + ".sourceUrl", "url-format", "Source URL must be a valid HTTP or HTTPS URI without whitespace.");
    checkString(o, "sourceRevision", false, 256, errors, path);
    checkString(o, "contentHash", false, 80, errors, path);
    if (o.contentHash !== undefined && !HASH_RE.test(o.contentHash)) add(errors, path + ".contentHash", "hash-format", "Expected sha256 followed by 64 lowercase hexadecimal characters.");
    checkString(o, "license", false, 120, errors, path);
    ["tags","capabilities","permissions","dependencies","supportedRuntimes","sideEffects","requiredSecrets"].forEach(function (k) {
      var limits = { tags:[30,48], capabilities:[100,120], permissions:[100,120], dependencies:[100,256], supportedRuntimes:[50,120], sideEffects:[50,160], requiredSecrets:[50,120] }[k];
      checkStringArray(o, k, limits[0], limits[1], errors, path);
    });
    if (Array.isArray(o.tags) && new Set(o.tags).size !== o.tags.length) add(errors, path + ".tags", "unique-items", "Tags must be unique.");
    checkString(o, "dataHandling", false, 4000, errors, path);
    checkEnum(o, "networkAccess", ["none","declared","required","unknown"], false, errors, path);
    checkString(o, "installInstructions", false, 5000, errors, path);
    checkEnum(o, "status", ARTIFACT_STATUSES, true, errors, path);
    checkEnum(o, "visibility", ["local","public"], false, errors, path);
    if (o.createdAt !== undefined) checkDate(o, "createdAt", false, errors, path);
    if (o.submitter !== undefined && !isObject(o.submitter)) add(errors, path + ".submitter", "type", "Expected an object.");
    if (isObject(o.submitter)) {
      checkKeys(o.submitter, ["id","assurance"], errors, path + ".submitter");
      checkString(o.submitter, "id", false, 160, errors, path + ".submitter");
      checkEnum(o.submitter, "assurance", ["unknown","self-asserted"], false, errors, path + ".submitter");
    }
    if (o.status === "published" && o.visibility !== "public") add(errors, path + ".visibility", "publish-visibility", "Published artifacts must explicitly declare public visibility.");
  }
  function validateReview(o, errors) {
    var path = "review";
    checkKeys(o, ["schemaVersion","recordType","reviewId","artifactId","artifactVersion","artifactHash","reviewerType","reviewerId","reviewerVersion","checklistVersion","environment","createdAt","checks","findings","compatibility","limitations","conflictsOfInterest","reviewBasis","reproduction","disposition","signatureStatus"], errors, path);
    if (o.schemaVersion !== VERSION) add(errors, path + ".schemaVersion", "version", "Unsupported schema version.");
    if (o.recordType !== "review") add(errors, path + ".recordType", "record-type", "Expected recordType=review.");
    ["reviewId","artifactId","artifactVersion"].forEach(function (k) { checkString(o, k, true, 120, errors, path); });
    checkString(o, "artifactHash", false, 80, errors, path);
    if (o.artifactHash !== undefined && !HASH_RE.test(o.artifactHash)) add(errors, path + ".artifactHash", "hash-format", "Expected sha256 followed by 64 lowercase hexadecimal characters.");
    checkEnum(o, "reviewerType", REVIEWER_TYPES, true, errors, path);
    ["reviewerId","reviewerVersion","checklistVersion"].forEach(function (k) { checkString(o, k, false, 160, errors, path); });
    checkString(o, "environment", false, 500, errors, path);
    checkDate(o, "createdAt", true, errors, path);
    var checks = checkArray(o, "checks", true, 300, errors, path) || [];
    checks.forEach(function (c, i) {
      var p = path + ".checks[" + i + "]";
      if (!isObject(c)) { add(errors, p, "type", "Expected an object."); return; }
      checkKeys(c, ["checkId","status","outputDigest","durationMs","evidenceRefs"], errors, p);
      checkString(c, "checkId", true, 120, errors, p);
      checkEnum(c, "status", CHECK_STATUSES, true, errors, p);
      if (c.outputDigest !== undefined && !HASH_RE.test(c.outputDigest)) add(errors, p + ".outputDigest", "hash-format", "Expected a SHA-256 digest.");
      if (c.durationMs !== undefined && (!Number.isInteger(c.durationMs) || c.durationMs < 0)) add(errors, p + ".durationMs", "range", "Expected a non-negative integer.");
      if (c.evidenceRefs !== undefined) checkStringArray({ refs:c.evidenceRefs }, "refs", 100, 500, errors, p);
    });
    var findings = checkArray(o, "findings", true, 300, errors, path) || [];
    findings.forEach(function (f, i) {
      var p = path + ".findings[" + i + "]";
      if (!isObject(f)) { add(errors, p, "type", "Expected an object."); return; }
      checkKeys(f, ["findingId","severity","category","claim","evidenceRefs","remediation","confidence"], errors, p);
      checkString(f, "findingId", true, 120, errors, p);
      checkEnum(f, "severity", SEVERITIES, true, errors, p);
      checkString(f, "category", true, 120, errors, p);
      checkString(f, "claim", true, 3000, errors, p);
      checkString(f, "remediation", false, 3000, errors, p);
      if (f.confidence !== undefined && (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 1)) add(errors, p + ".confidence", "range", "Expected a number from 0 to 1.");
      if (f.evidenceRefs !== undefined) checkStringArray({ refs:f.evidenceRefs }, "refs", 100, 500, errors, p);
    });
    var compatibility = checkArray(o, "compatibility", false, 100, errors, path);
    if (Array.isArray(compatibility)) compatibility.forEach(function (c, i) {
      var p = path + ".compatibility[" + i + "]";
      if (!isObject(c)) { add(errors, p, "type", "Expected an object."); return; }
      checkKeys(c, ["target","status","evidenceRefs"], errors, p);
      checkString(c, "target", true, 200, errors, p);
      checkEnum(c, "status", ["passed","failed","blocked","not-run","unknown"], true, errors, p);
      if (c.evidenceRefs !== undefined) checkStringArray({ refs:c.evidenceRefs }, "refs", 100, 500, errors, p);
    });
    ["limitations","conflictsOfInterest"].forEach(function (k) { if (o[k] !== undefined) checkStringArray(o, k, k === "limitations" ? 100 : 50, k === "limitations" ? 1000 : 500, errors, path); });
    checkString(o, "reviewBasis", false, 3000, errors, path);
    checkString(o, "reproduction", false, 5000, errors, path);
    checkEnum(o, "disposition", DISPOSITIONS, true, errors, path);
    checkEnum(o, "signatureStatus", ["unsigned","invalid","unavailable"], false, errors, path);

    if (o.disposition === "promising" && !checks.some(function (c) { return isObject(c) && c.status === "passed"; }) && !(typeof o.reviewBasis === "string" && o.reviewBasis.trim())) add(errors, path + ".disposition", "evidence-mismatch", "A promising disposition needs a passed check or a documented reviewBasis.");
  }
  function validateRecord(record) {
    var errors = [];
    if (!isObject(record)) return { ok:false, schemaVersion:VERSION, errors:[{path:"$",code:"type",message:"Record must be a JSON object."}], warnings:[] };
    if (record.recordType === "artifact") validateArtifact(record, errors);
    else if (record.recordType === "review") validateReview(record, errors);
    else add(errors, "recordType", "record-type", "recordType must be artifact or review.");
    var warnings = [];
    if (record.recordType === "artifact" && record.status === "published") warnings.push({code:"public-record",message:"Published records are public. Do not include secrets, private code, or personal data."});
    if (record.recordType === "review" && record.reviewerType === "model-agent") warnings.push({code:"model-opinion",message:"A model review is analysis, not proof of safety or a security certification."});
    if (record.recordType === "review" && record.reviewerType === "model-agent" && !record.reviewerVersion) warnings.push({code:"reviewer-version-unavailable",message:"Model version was not supplied; reproducibility may be limited."});
    if (record.recordType === "review" && Array.isArray(record.checks) && record.checks.some(function (c) { return isObject(c) && (c.status === "skipped" || c.status === "not-run" || c.status === "blocked"); })) warnings.push({code:"incomplete-evidence",message:"Some checks did not pass. Do not describe this review as fully verified."});
    return { ok:errors.length === 0, schemaVersion:VERSION, errors:errors, warnings:warnings };
  }
  return { schemaVersion:VERSION, validateRecord:validateRecord };
});
