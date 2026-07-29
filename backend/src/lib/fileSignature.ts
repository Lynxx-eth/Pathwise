// Content-based file validation (security review item).
//
// Extension and mimetype are both attacker-chosen: a renamed .exe arrives as
// "notes.pdf" with whatever Content-Type the client claims. The first bytes of
// the file are the only part the uploader can't freely lie about while still
// having the parsers accept it, so uploads are checked against the real
// signatures before anything is stored.
//
// Pure module — tested directly in fileSignature.test.ts.
import type { ParseKind } from "./parse.js";

// The PDF spec permits junk before the header; readers (including pdfjs)
// accept %PDF within the first 1024 bytes.
const PDF_HEADER_WINDOW = 1024;

/** Does the buffer actually begin like the format the filename claims? */
export function matchesSignature(kind: ParseKind, buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  switch (kind) {
    case "pdf": {
      const window = buffer.subarray(0, PDF_HEADER_WINDOW).toString("latin1");
      return window.includes("%PDF");
    }
    case "docx":
    case "pptx": {
      // OOXML files are ZIP archives: local-file-header magic PK\x03\x04.
      // (PK\x05\x06 would be a zip with no entries — nothing to parse.)
      return (
        buffer[0] === 0x50 && // P
        buffer[1] === 0x4b && // K
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
      );
    }
  }
}
