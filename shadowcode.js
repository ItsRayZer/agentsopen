// ShadowCode sc:1 — reference encoder/decoder. No dependencies.
// Opaque-at-a-glance agent language: any agent with this public table
// decodes it in one linear pass. NOT encryption: a human who fetches
// this table can decode it too. No keys, no secrets, no login.
// Spec: research/SHADOWCODE-SPEC-2026-10-26.md
'use strict';

// ---- Frozen tables, sc:1. Changes = sc:2, never silent edits. ----
// Field byte: low 7 bits = field id. High bit set => the value is a
// single common-value byte that follows. High bit clear => an item
// sequence follows (see encodeValue/decodeValue).
const FIELDS = {
  agent: 0x01, task: 0x02, status: 0x03, ctx: 0x04, in: 0x05,
  out: 0x06, verdict: 0x07, conflict: 0x08, next: 0x09, done: 0x0a,
  blocked: 0x0b, verify: 0x0c, note: 0x0d, msg: 0x0e, text: 0x0f,
  from: 0x10, to: 0x11, id: 0x12, proof: 0x13, public: 0x14,
  verified: 0x15, priority: 0x16, thread: 0x17, author: 0x18,
  title: 0x19, kind: 0x1a, ref: 0x1b,
};
const FIELD_CUSTOM = 0x1d; // custom field: varint-len + name bytes, then value
const FIELD_BY_ID = Object.fromEntries(
  Object.entries(FIELDS).map(([k, v]) => [v, k]));

const COMMON = {
  todo: 0x01, doing: 0x02, verify: 0x03, done: 0x04, blocked: 0x05,
  handoff: 0x06, mia: 0x07, 'ai-workspace': 0x08, swarm: 0x09,
  builder: 0x0a, verdict: 0x0b, pass: 0x0c, fail: 0x0d, code: 0x0e,
  live: 0x0f, test: 0x10, none: 0x11, true: 0x12, false: 0x13,
  ok: 0x14, error: 0x15, review: 0x16, build: 0x17, fix: 0x18,
  deploy: 0x19, public: 0x1a, private: 0x1b, request: 0x1c,
  reply: 0x1d, start: 0x1e, help: 0x1f, pending: 0x20,
  question: 0x21, answer: 0x22, urgent: 0x23,
};
const COMMON_BY_ID = Object.fromEntries(
  Object.entries(COMMON).map(([k, v]) => [v, k]));

// Word tokens inside free-text values (item byte 0x80 + id).
// General English + workspace words; case-sensitive, exact match.
const WORDS = ['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for',
  'with', 'after', 'only', 'login', 'fallback', 'sign-in', 'reload',
  'removed', 'kept', 'link', 'apply', 'local', 'serve', 'result', 'pass',
  'check', 'static', 'site', 'server', 'page', 'find', 'why', 'loop',
  'role', 'verdict', 'removal', 'redirects', 'reloads', 'hello', 'this',
  'is', 'generic', 'text', 'message', 'about', 'anything', 'at', 'all',
  'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'agents',
  'from', 'new', 'file', 'code', 'test', 'The', 'agent', 'task'];
const WORD_BY_ID = new Map(WORDS.map((w, i) => [w, i]));

const ITEM_END = 0x00;      // ends an item sequence
const ITEM_LITERAL = 0x01;  // varint length + raw bytes follow
const ITEM_WORD_BASE = 0x80; // + word id (0..63)
const PUNCT = new Set(['.', ',', ':', ';', '!', '?']);

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function b64encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64[b2 & 63];
  }
  return out;
}
function b64decode(s) {
  const rev = new Map([...B64].map((c, i) => [c, i]));
  const bytes = [];
  let acc = 0, nbits = 0;
  for (const ch of s) {
    if (!rev.has(ch)) throw new Error('bad base64url character');
    acc = (acc << 6) | rev.get(ch); nbits += 6;
    if (nbits >= 8) { nbits -= 8; bytes.push((acc >> nbits) & 0xff); }
  }
  return bytes;
}
function fail(msg) { throw new Error('shadowcode rejected: ' + msg); }
function varint(n, out) {
  do { let b = n & 0x7f; n >>= 7; if (n) b |= 0x80; out.push(b); } while (n);
}
// Returns [value, nextPos]; rejects overlong (non-minimal) varints.
function readVarint(bytes, pos) {
  let value = 0, shift = 0, count = 0;
  for (;;) {
    if (pos >= bytes.length) fail('truncated varint');
    const b = bytes[pos++];
    value += (b & 0x7f) * (2 ** shift); shift += 7; count++;
    if (count > 4) fail('varint too long');
    if (!(b & 0x80)) break;
  }
  if (count > 1 && value < (2 ** (7 * (count - 1)))) fail('non-minimal varint');
  return [value, pos];
}
function isPunctChunk(s) { return s !== '' && [...s].every((c) => PUNCT.has(c)); }

// Split a literal value into items. Single-space-separated text with no
// leading/trailing/double spaces and no tabs/newlines is word-tokenised;
// anything else becomes one literal chunk, preserving bytes exactly.
function encodeItems(value, out, enc) {
  const irregular = value !== value.trim() || value.includes('  ')
    || /[\t\r\n]/.test(value);
  if (value === '') { out.push(ITEM_END); return; }
  // A word that is only punctuation would re-attach on decode, so any
  // such word forces the whole value into one literal chunk (exact).
  const words0 = value.split(' ');
  const hasPunctWord = words0.some((w) => /^[.,:;!?]+$/.test(w));
  if (irregular || hasPunctWord) {
    const b = enc.encode(value);
    out.push(ITEM_LITERAL); varint(b.length, out); out.push(...b);
    out.push(ITEM_END); return;
  }
  const words = value.split(' ');
  let chunk = '';
  const flush = () => {
    if (chunk === '') return;
    const b = enc.encode(chunk);
    out.push(ITEM_LITERAL); varint(b.length, out); out.push(...b);
    chunk = '';
  };
  for (const word of words) {
    let stem = word, punct = '';
    while (stem !== '' && PUNCT.has(stem[stem.length - 1])) {
      punct = stem[stem.length - 1] + punct; stem = stem.slice(0, -1);
    }
    if (stem !== '' && WORD_BY_ID.has(stem)) {
      flush();
      out.push(ITEM_WORD_BASE + WORD_BY_ID.get(stem));
      if (punct !== '') {
        const b = enc.encode(punct);
        out.push(ITEM_LITERAL); varint(b.length, out); out.push(...b);
      }
    } else {
      chunk = chunk === '' ? word : chunk + ' ' + word;
    }
  }
  flush();
  out.push(ITEM_END);
}
function decodeItems(bytes, pos, dec) {
  const parts = [];
  for (;;) {
    if (pos >= bytes.length) fail('unterminated item sequence');
    const t = bytes[pos++];
    if (t === ITEM_END) break;
    if (t === ITEM_LITERAL) {
      const [n, p2] = readVarint(bytes, pos); pos = p2;
      if (pos + n > bytes.length) fail('truncated literal chunk');
      let s;
      try { s = dec.decode(new Uint8Array(bytes.slice(pos, pos + n))); }
      catch { fail('literal chunk is not valid UTF-8'); }
      pos += n;
      if (parts.length > 0 && isPunctChunk(s)) parts[parts.length - 1] += s;
      else parts.push(s);
    } else if (t >= ITEM_WORD_BASE && t < ITEM_WORD_BASE + WORDS.length) {
      parts.push(WORDS[t - ITEM_WORD_BASE]);
    } else {
      fail('unknown item byte 0x' + t.toString(16));
    }
  }
  return [parts.join(' '), pos];
}

// Encode canonical AgentLang text ("al:1" + "code: value" lines) to sc:1.
// Canonicalisation (documented): "code:value" is accepted and normalised
// to "code: value"; anything else about the input is preserved exactly.
function encode(alText) {
  const text = String(alText).replace(/\r\n/g, '\n').replace(/\n$/, '');
  const lines = text.split('\n');
  if (lines[0] !== 'al:1') fail('first line must be al:1');
  if (lines.length < 2) fail('message needs at least one statement');
  const enc = new TextEncoder();
  const out = [0x73, 0x63, 0x01]; // 's' 'c' version 1
  for (const line of lines.slice(1)) {
    const m = line.match(/^([a-z]+):(?: (.*))?$/);
    if (!m) fail('line is not code: value -> ' + JSON.stringify(line));
    const [, code, value = ''] = m;
    const field = FIELDS[code];
    if (COMMON[value] !== undefined && value !== '') {
      // Common value: field byte with high bit set + 1 common id byte.
      if (field !== undefined) out.push(field | 0x80, COMMON[value]);
      else {
        const nb = enc.encode(code);
        out.push(FIELD_CUSTOM | 0x80); varint(nb.length, out); out.push(...nb);
        out.push(COMMON[value]);
      }
    } else if (field !== undefined) {
      out.push(field);
      encodeItems(value, out, enc);
    } else {
      // Generic extension slot: any code works, no table change needed.
      const nb = enc.encode(code);
      out.push(FIELD_CUSTOM); varint(nb.length, out); out.push(...nb);
      encodeItems(value, out, enc);
    }
  }
  let sum = 0;
  for (const b of out) sum = (sum + b) & 0xffff;
  out.push((sum >> 8) & 0xff, sum & 0xff);
  return 'sc:1.' + b64encode(out);
}

// Decode an sc:1 string back to canonical AgentLang text. One linear
// pass, O(n) in the decoded bytes. Any structural problem rejects the
// whole message; nothing is silently accepted, guessed, or partial.
function decode(scText) {
  const s = String(scText).trim();
  if (!s.startsWith('sc:1.')) fail('must start with sc:1.');
  const bytes = b64decode(s.slice(5));
  if (bytes.length < 3 + 2) fail('message too short');
  if (bytes[0] !== 0x73 || bytes[1] !== 0x63) fail('bad magic');
  if (bytes[2] !== 0x01) fail('unsupported version');
  const body = bytes.slice(0, -2);
  const want = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
  let sum = 0;
  for (const b of body) sum = (sum + b) & 0xffff;
  if (sum !== want) fail('checksum mismatch');
  const dec = new TextDecoder('utf-8', { fatal: true });
  const lines = ['al:1'];
  let i = 3;
  while (i < body.length) {
    const fb = body[i++];
    const isCommon = (fb & 0x80) !== 0;
    const fid = fb & 0x7f;
    let code;
    if (fid === FIELD_CUSTOM) {
      const [n, p2] = readVarint(body, i); i = p2;
      if (i + n > body.length) fail('truncated custom field name');
      try { code = dec.decode(new Uint8Array(body.slice(i, i + n))); }
      catch { fail('custom field name is not valid UTF-8'); }
      i += n;
      if (!/^[a-z]+$/.test(code)) fail('custom field name must be lowercase letters');
    } else {
      code = FIELD_BY_ID[fid];
      if (code === undefined) fail('unknown field token 0x' + fid.toString(16));
    }
    let value;
    if (isCommon) {
      if (i >= body.length) fail('truncated common value');
      value = COMMON_BY_ID[body[i++]];
      if (value === undefined) fail('unknown common value token');
    } else {
      [value, i] = decodeItems(body, i, dec);
    }
    lines.push(value === '' ? code + ':' : code + ': ' + value);
  }
  if (lines.length < 2) fail('message needs at least one statement');
  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { encode, decode, FIELDS, COMMON, WORDS, FIELD_CUSTOM };
}

// Tiny CLI: node shadowcode.js encode <file|-> | decode <sc:1 string|file>
if (typeof require !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const [cmd, arg] = process.argv.slice(2);
  const read = (a) => (a === '-' || a === undefined)
    ? fs.readFileSync(0, 'utf8') : fs.readFileSync(a, 'utf8');
  try {
    if (cmd === 'encode') process.stdout.write(encode(read(arg)) + '\n');
    else if (cmd === 'decode') process.stdout.write(decode(read(arg).trim()) + '\n');
    else { process.stderr.write('usage: shadowcode.js encode|decode <file|->\n'); process.exit(2); }
  } catch (e) { process.stderr.write(e.message + '\n'); process.exit(1); }
}
