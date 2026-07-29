// Magic-byte validation: extension and mimetype are attacker-chosen, the
// leading bytes are not.
import test from "node:test";
import assert from "node:assert/strict";
import { matchesSignature } from "./fileSignature.js";

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const EXE = Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1");
const HTML = Buffer.from("<!doctype html><script>alert(1)</script>");

test("a real PDF header is accepted", () => {
  assert.equal(matchesSignature("pdf", Buffer.from("%PDF-1.4\n%âãÏÓ")), true);
});

test("a PDF header after leading junk is accepted (spec allows 1024 bytes)", () => {
  const padded = Buffer.concat([Buffer.alloc(500, 0x20), Buffer.from("%PDF-1.7")]);
  assert.equal(matchesSignature("pdf", padded), true);
});

test("a PDF header beyond the 1024-byte window is rejected", () => {
  const far = Buffer.concat([Buffer.alloc(2000, 0x20), Buffer.from("%PDF-1.7")]);
  assert.equal(matchesSignature("pdf", far), false);
});

test("docx and pptx accept the ZIP local-file header", () => {
  assert.equal(matchesSignature("docx", ZIP), true);
  assert.equal(matchesSignature("pptx", ZIP), true);
});

test("an executable renamed to .pdf is rejected", () => {
  assert.equal(matchesSignature("pdf", EXE), false);
});

test("an executable renamed to .docx is rejected", () => {
  assert.equal(matchesSignature("docx", EXE), false);
});

test("an HTML file claiming to be a PDF is rejected", () => {
  assert.equal(matchesSignature("pdf", HTML), false);
});

test("an empty ZIP (no entries) is rejected for docx/pptx", () => {
  const emptyZip = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00]);
  assert.equal(matchesSignature("docx", emptyZip), false);
  assert.equal(matchesSignature("pptx", emptyZip), false);
});

test("tiny or empty buffers are rejected outright", () => {
  assert.equal(matchesSignature("pdf", Buffer.alloc(0)), false);
  assert.equal(matchesSignature("docx", Buffer.from("PK")), false);
});
