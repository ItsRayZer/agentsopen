/* AI Workspace Review Exchange core 0.1.0.
 * Deterministic, local-only metadata/source-text checks. It never fetches URLs or executes artifacts.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AIWSReviewCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "review-exchange-core-0.1.0";
  var MAX_SOURCE_BYTES = 80 * 1024;
  var MAX_FINDINGS = 100;
  var SECRET_RULES = [
    { id:"private-key", severity:"critical", category:"secret-exposure", re:/-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { id:"openai-like-key", severity:"critical", category:"secret-exposure", re:/\bsk-[A-Za-z0-9]{12,}/ },
    { id:"stripe-key", severity:"critical", category:"secret-exposure", re:/\bsk_(?:live|test)_[A-Za-z0-9]{8,}/ },
    { id:"github-token", severity:"critical", category:"secret-exposure", re:/\bgh[pous]_[A-Za-z0-9]{20,}/ },
    { id:"aws-access-key-id", severity:"high", category:"secret-exposure", re:/\bAKIA[0-9A-Z]{16}\b/ },
    { id:"slack-token", severity:"high", category:"secret-exposure", re:/\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
    { id:"jwt-like-token", severity:"high", category:"secret-exposure", re:/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
    { id:"credential-assignment", severity:"high", category:"secret-exposure", re:/\b(api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*\S+/i },
    { id:"bearer-token", severity:"high", category:"secret-exposure", re:/\bBearer\s+[A-Za-z0-9._-]{12,}/ }
  ];
  var RISK_RULES = [
    { id:"prompt-injection-language", severity:"medium", category:"instruction-risk", re:/\b(ignore|override|disregard)\s+(all\s+)?(previous|system|developer|safety)\s+instructions\b/i, remediation:"Review the text as untrusted data; do not let it override reviewer or runtime policy." },
    { id:"secret-exfiltration-language", severity:"high", category:"data-exfiltration-risk", re:/\b(exfiltrat\w*|leak|reveal|print|send|upload)\b.{0,80}\b(secrets?|credentials?|api keys?|tokens?|cookies?)\b/i, remediation:"Remove unexplained secret-access or exfiltration behavior and verify with an isolated test." },
    { id:"shell-pipe-install", severity:"high", category:"install-risk", re:/\b(curl|wget)\b[^\n]{0,180}\|\s*(sh|bash)\b/i, remediation:"Avoid piping remote content directly to a shell; pin and inspect the downloaded artifact." },
    { id:"dynamic-code-evaluation", severity:"medium", category:"execution-risk", re:/\beval\s*\(|new\s+Function\s*\(/, remediation:"Review the origin and bounds of dynamically evaluated input." },
    { id:"destructive-shell-command", severity:"high", category:"destructive-operation-risk", re:/\brm\s+-rf\b|\bformat\s+[A-Z]:|\bRemove-Item\b[^\n]{0,80}-Recurse/i, remediation:"Replace broad destructive operations with explicit scoped paths and a dry-run." }
  ];
  function isObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function uniqueStrings(items) {
    var seen = Object.create(null);
    return (Array.isArray(items) ? items : []).map(function (v) { return String(v).trim(); }).filter(function (v) {
      if (!v || seen[v]) return false;
      seen[v] = true;
      return true;
    });
  }
  function splitList(value) {
    return uniqueStrings(String(value || "").split(/[\n,]/));
  }
  function slugify(value) {
    return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "artifact";
  }
  function newId(prefix) {
    var value = "";
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") value = crypto.randomUUID().replace(/-/g, "");
    } catch (e) {}
    if (!value) value = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    return String(prefix || "id") + "-" + value.slice(0, 28).toLowerCase();
  }
  async function sha256Text(text) {
    var input = String(text);
    if (typeof TextEncoder !== "undefined" && typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      var buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
      return "sha256:" + Array.prototype.map.call(new Uint8Array(buffer), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    if (typeof require === "function") {
      try { return "sha256:" + require("node:crypto").createHash("sha256").update(input, "utf8").digest("hex"); } catch (e) {}
    }
    return null;
  }
  function lineMatches(source, rules, cap) {
    var lines = String(source || "").split(/\r?\n/);
    var out = [];
    lines.forEach(function (line, index) {
      rules.forEach(function (rule) {
        if (out.length >= cap) return;
        if (rule.re.test(line)) {
          out.push({
            findingId: rule.id + "-line-" + (index + 1),
            severity: rule.severity,
            category: rule.category,
            claim: "Rule " + rule.id + " matched source text at line " + (index + 1) + ". The matched text is intentionally not stored in the review record.",
            evidenceRefs: ["source-line:" + (index + 1)],
            remediation: rule.remediation || "Remove the exposed credential, rotate it if it was real, and keep secret values out of review bundles.",
            confidence: 0.8
          });
        }
      });
    });
    return out;
  }
  function scanSource(source) {
    var text = String(source || "");
    var byteLength = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : text.length;
    if (byteLength > MAX_SOURCE_BYTES) {
      return { ok:false, tooLarge:true, byteLength:byteLength, maxBytes:MAX_SOURCE_BYTES, secretFindings:[], riskFindings:[], findings:[] };
    }
    var secrets = lineMatches(text, SECRET_RULES, MAX_FINDINGS);
    var risks = lineMatches(text, RISK_RULES, Math.max(0, MAX_FINDINGS - secrets.length));
    return { ok:true, tooLarge:false, byteLength:byteLength, maxBytes:MAX_SOURCE_BYTES, secretFindings:secrets, riskFindings:risks, findings:secrets.concat(risks).slice(0, MAX_FINDINGS) };
  }
  function checkRecord(validated, kind) {
    if (!validated || typeof validated.validateRecord !== "function") return { ok:false, errors:[{code:"validator-missing",message:"The review record validator did not load."}] };
    var result = validated.validateRecord(kind);
    return result && typeof result === "object" ? result : { ok:false, errors:[{code:"validator-invalid-result",message:"Validator returned an invalid result."}] };
  }
  async function reviewArtifact(input, sourceText, validator) {
    var artifact = Object.assign({}, input || {});
    var text = String(sourceText || "");
    var scan = scanSource(text);
    if (!scan.ok) return { ok:false, errors:[{path:"source",code:"source-too-large",message:"Source text exceeds the 80 KiB local scanning limit. Split it into smaller files and scan separately."}], scan:scan };
    if (text.length) {
      var digest = await sha256Text(text);
      if (digest) artifact.contentHash = digest;
    }
    var artifactValidation = checkRecord(validator, artifact);
    if (!artifactValidation.ok) return { ok:false, errors:artifactValidation.errors, scan:scan, artifact:artifact };
    var findings = scan.findings.slice();
    var checks = [];
    checks.push({ checkId:"artifact-record-schema", status:"passed", evidenceRefs:["schema:review-exchange-0.1.0"] });
    if (artifact.sourceRevision || artifact.contentHash) checks.push({ checkId:"source-pinning", status:"passed", evidenceRefs:[artifact.sourceRevision ? "source-revision:" + artifact.sourceRevision : "content-hash:" + artifact.contentHash] });
    else {
      checks.push({ checkId:"source-pinning", status:"skipped", evidenceRefs:[] });
      findings.push({ findingId:"source-pin-missing",severity:"medium",category:"provenance",claim:"No source revision or content hash was available, so this review cannot bind findings to an immutable source version.",evidenceRefs:[],remediation:"Supply a commit/release revision or scan a bounded source file so a content hash can be recorded.",confidence:1 });
    }
    if (text.length) {
      checks.push({ checkId:"secret-pattern-scan", status:scan.secretFindings.length ? "failed" : "passed", evidenceRefs:scan.secretFindings.map(function (f) { return f.evidenceRefs[0]; }) });
      checks.push({ checkId:"instruction-and-command-heuristics", status:scan.riskFindings.length ? "failed" : "passed", evidenceRefs:scan.riskFindings.map(function (f) { return f.evidenceRefs[0]; }) });
    } else {
      checks.push({ checkId:"secret-pattern-scan", status:"not-run", evidenceRefs:[] });
      checks.push({ checkId:"instruction-and-command-heuristics", status:"not-run", evidenceRefs:[] });
      findings.push({ findingId:"source-not-provided",severity:"info",category:"evidence-gap",claim:"No source text was supplied; source-level static checks were not run.",evidenceRefs:[],remediation:"Provide a small public-safe source excerpt or run the checks locally against the artifact files.",confidence:1 });
    }
    checks.push({ checkId:"permission-declaration", status:Array.isArray(artifact.permissions) ? "passed" : "skipped", evidenceRefs:["artifact:permissions"] });
    if (artifact.networkAccess && artifact.networkAccess !== "unknown") checks.push({ checkId:"network-declaration",status:"passed",evidenceRefs:["artifact:networkAccess"] });
    else {
      checks.push({ checkId:"network-declaration",status:"skipped",evidenceRefs:[]});
      findings.push({ findingId:"network-access-unknown",severity:"medium",category:"permissions",claim:"Network access is unknown or was not explicitly declared.",evidenceRefs:[],remediation:"Declare whether the artifact needs no network, declared destinations, or general network access.",confidence:1});
    }
    checks.push({ checkId:"runtime-execution",status:"not-run",evidenceRefs:[]});
    checks.push({ checkId:"capability-probe",status:"not-run",evidenceRefs:[]});
    findings.push({ findingId:"runtime-tests-not-run",severity:"info",category:"evidence-gap",claim:"The artifact was not executed. This page does not run uploaded code or fetch source URLs.",evidenceRefs:[],remediation:"Use a separate isolated local or CI runner for runtime and capability tests.",confidence:1});
    var high = findings.some(function (f) { return f.severity === "critical" || f.severity === "high"; });
    var review = {
      schemaVersion:"review-exchange-0.1.0",
      recordType:"review",
      reviewId:newId("review"),
      artifactId:artifact.artifactId,
      artifactVersion:artifact.version,
      artifactHash:artifact.contentHash,
      reviewerType:"deterministic-check",
      reviewerId:"aiws-review-exchange-local-static-checks",
      reviewerVersion:VERSION,
      checklistVersion:"static-checks-0.1.0",
      environment:"browser-local; no network fetch; no code execution",
      createdAt:new Date().toISOString(),
      checks:checks,
      findings:findings.slice(0, MAX_FINDINGS),
      compatibility:[],
      limitations:[
        "Heuristic text scan only; not a security certification.",
        "No uploaded code was executed and no source URL was fetched.",
        "Secret-pattern scanning can miss secrets and can produce false positives.",
        "The content hash covers the supplied source text only, not an entire remote repository or package unless that exact content was supplied."
      ],
      conflictsOfInterest:[],
      reviewBasis:"Deterministic local checks of record metadata and optional bounded source text. Runtime behavior and external connectivity were not tested.",
      reproduction:"Open this static page, import the same artifact record and same source text, then run the local review. Compare artifact hash, checklistVersion, checks, and finding IDs.",
      disposition:high ? "needs-fixes" : "insufficient-evidence",
      signatureStatus:"unsigned"
    };
    var reviewValidation = checkRecord(validator, review);
    if (!reviewValidation.ok) return { ok:false, errors:reviewValidation.errors, scan:scan, artifact:artifact, review:review };
    return { ok:true, artifact:artifact, review:review, scan:scan, warnings:reviewValidation.warnings || [] };
  }
  function buildPassport(artifact, reviews) {
    var related = (Array.isArray(reviews) ? reviews : []).filter(function (r) {
      return r && r.recordType === "review" && r.artifactId === artifact.artifactId && r.artifactVersion === artifact.version;
    });
    return {
      schemaVersion:"aiws-agent-passport-0.1.0",
      recordType:"agent-passport",
      artifactId:artifact.artifactId,
      artifactVersion:artifact.version,
      artifactType:artifact.artifactType,
      name:artifact.name,
      sourceUrl:artifact.sourceUrl || null,
      sourceRevision:artifact.sourceRevision || null,
      contentHash:artifact.contentHash || null,
      claimedCapabilities:Array.isArray(artifact.capabilities) ? artifact.capabilities : [],
      declaredPermissions:Array.isArray(artifact.permissions) ? artifact.permissions : [],
      declaredDependencies:Array.isArray(artifact.dependencies) ? artifact.dependencies : [],
      supportedRuntimes:Array.isArray(artifact.supportedRuntimes) ? artifact.supportedRuntimes : [],
      evidenceStatus:related.length ? "reviews-available-not-a-safety-certification" : "no-reviews-available",
      reviewRefs:related.map(function (r) { return { reviewId:r.reviewId,createdAt:r.createdAt,reviewerType:r.reviewerType,disposition:r.disposition,artifactHash:r.artifactHash || null }; }),
      identityAssurance:"unknown",
      signatureStatus:"unsigned",
      limitations:["Capabilities are declarations unless a linked review demonstrates a specific tested capability.","Passport generation does not execute code or prove the publisher's identity."]
    };
  }
  function compareMetadata(a, b) {
    function vals(o,k) { return uniqueStrings(o && o[k]); }
    var aR=vals(a,"supportedRuntimes"), bR=vals(b,"supportedRuntimes");
    var commonR=aR.filter(function(v){return bR.indexOf(v)>=0;});
    var aC=vals(a,"capabilities"), bC=vals(b,"capabilities");
    var commonC=aC.filter(function(v){return bC.indexOf(v)>=0;});
    var aP=vals(a,"permissions"), bP=vals(b,"permissions");
    return {
      artifactA:{id:a.artifactId,version:a.version,name:a.name},
      artifactB:{id:b.artifactId,version:b.version,name:b.name},
      sameType:a.artifactType===b.artifactType,
      sharedDeclaredRuntimes:commonR,
      runtimeCompatibility:commonR.length ? "potentially-compatible-by-declaration-not-tested" : (aR.length && bR.length ? "no-shared-runtime-declared" : "unknown-runtime-compatibility"),
      sharedDeclaredCapabilities:commonC,
      permissionsOnlyA:aP.filter(function(v){return bP.indexOf(v)<0;}),
      permissionsOnlyB:bP.filter(function(v){return aP.indexOf(v)<0;}),
      versionedEvidenceComparison:"not-automatically-established",
      limitations:["This is a metadata diff, not a runtime interoperability test.","Permission declarations are not permission grants.","Shared capabilities or runtimes do not prove compatibility."]
    };
  }
  function makeBenchmarkPlan(input) {
    var tasks = String(input && input.tasks || "").split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean).slice(0,100);
    return {
      schemaVersion:"aiws-benchmark-plan-0.1.0",
      recordType:"benchmark-plan",
      benchmarkId:newId("benchmark"),
      name:String(input && input.name || "Untitled benchmark").slice(0,160),
      category:String(input && input.category || "general").slice(0,80),
      tasks:tasks.map(function(task,i){return {taskId:"task-"+String(i+1).padStart(3,"0"),description:task,expectedOutcome:"define-before-run",evaluator:"not-configured",status:"not-run"};}),
      createdAt:new Date().toISOString(),
      executionStatus:"not-run",
      limitations:["This is a benchmark plan only; no agent was executed or scored."]
    };
  }
  return {
    version:VERSION,
    maxSourceBytes:MAX_SOURCE_BYTES,
    splitList:splitList,
    slugify:slugify,
    newId:newId,
    sha256Text:sha256Text,
    scanSource:scanSource,
    reviewArtifact:reviewArtifact,
    buildPassport:buildPassport,
    compareMetadata:compareMetadata,
    makeBenchmarkPlan:makeBenchmarkPlan
  };
});
