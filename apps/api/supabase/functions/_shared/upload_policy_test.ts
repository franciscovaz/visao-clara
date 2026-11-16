import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  ALLOWED_TYPES,
  attachmentDisposition,
  checkFileSignature,
  checkStoredObject,
  MAX_FILE_SIZE_BYTES,
  validateUploadRequest,
} from "./upload_policy.ts";

const MB = 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ok = (fileName: string, mimeType: string, sizeBytes: number) =>
  validateUploadRequest({ fileName, mimeType, sizeBytes }).ok;

Deno.test("all approved types are accepted with a matching extension", () => {
  assertEquals(ok("a.pdf", "application/pdf", 10), true);
  assertEquals(ok("a.doc", "application/msword", 10), true);
  assertEquals(ok("a.docx", DOCX, 10), true);
  assertEquals(ok("a.xls", "application/vnd.ms-excel", 10), true);
  assertEquals(ok("a.xlsx", XLSX, 10), true);
  assertEquals(ok("a.jpg", "image/jpeg", 10), true);
  assertEquals(ok("A.JPEG", "image/jpeg", 10), true);
  assertEquals(ok("a.png", "image/png", 10), true);
  assertEquals(Object.keys(ALLOWED_TYPES).length, 7);
});

Deno.test("unsupported or malformed types are refused", () => {
  for (const mime of ["application/x-msdownload", "text/html", "image/svg+xml", "application/zip", "application/octet-stream", "", "application/pdf; charset=x", "APPLICATION/PDF", "application/vnd.ms-powerpoint"]) {
    assertEquals(ok("a.pdf", mime, 10), false, mime);
  }
});

Deno.test("extension must match the declared type", () => {
  assertEquals(ok("a.exe", "application/pdf", 10), false);
  assertEquals(ok("a.html", "image/png", 10), false);
  assertEquals(ok("a.pdf", "image/png", 10), false);
  assertEquals(ok("noextension", "application/pdf", 10), false);
  assertEquals(ok("a.docx", "application/msword", 10), false);
  assertEquals(ok(".pdf", "application/pdf", 10), false);
});

Deno.test("empty, negative, fractional and oversized sizes are refused; 1 byte and 20 MB pass", () => {
  assertEquals(ok("a.pdf", "application/pdf", 0), false);
  assertEquals(ok("a.pdf", "application/pdf", -1), false);
  assertEquals(ok("a.pdf", "application/pdf", 1.5), false);
  assertEquals(ok("a.pdf", "application/pdf", NaN), false);
  assertEquals(ok("a.pdf", "application/pdf", Infinity), false);
  assertEquals(ok("a.pdf", "application/pdf", 1), true);
  assertEquals(ok("a.pdf", "application/pdf", MAX_FILE_SIZE_BYTES), true);
  assertEquals(ok("a.pdf", "application/pdf", MAX_FILE_SIZE_BYTES + 1), false);
  assertEquals(MAX_FILE_SIZE_BYTES, 20 * MB);
});

const bytes = (...b: number[]) => new Uint8Array(b);
const sig = (mime: string, b: Uint8Array) => checkFileSignature(mime, b).ok;

function zipHeader(entryName: string): Uint8Array {
  const name = new TextEncoder().encode(entryName);
  const out = new Uint8Array(30 + name.length + 10);
  out.set([0x50, 0x4b, 0x03, 0x04]);
  out[26] = name.length & 0xff;
  out[27] = name.length >> 8;
  out.set(name, 30);
  return out;
}

Deno.test("file signatures: valid headers pass, mismatched content is refused", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\n");
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
  const jpg = bytes(0xff, 0xd8, 0xff, 0xe0);
  const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0);
  assertEquals(sig("application/pdf", pdf), true);
  assertEquals(sig("image/png", png), true);
  assertEquals(sig("image/jpeg", jpg), true);
  assertEquals(sig("application/msword", ole), true);
  assertEquals(sig("application/vnd.ms-excel", ole), true);
  assertEquals(sig(DOCX, zipHeader("[Content_Types].xml")), true);
  assertEquals(sig(XLSX, zipHeader("xl/workbook.xml")), true);
  assertEquals(sig(DOCX, zipHeader("_rels/.rels")), true);

  // declared as one type, content is another
  assertEquals(sig("application/pdf", png), false);
  assertEquals(sig("image/png", pdf), false);
  assertEquals(sig("image/jpeg", png), false);
  assertEquals(sig("application/msword", pdf), false);
  assertEquals(sig(DOCX, ole), false);
  assertEquals(sig("application/pdf", new TextEncoder().encode("<html><script>alert(1)</script>")), false);
  assertEquals(sig("application/pdf", bytes()), false);
  assertEquals(sig("image/png", bytes(0x89, 0x50)), false); // truncated
});

Deno.test("an arbitrary ZIP is not accepted as an Office document", () => {
  assertEquals(sig(DOCX, zipHeader("payload.exe")), false);
  assertEquals(sig(XLSX, zipHeader("../evil.sh")), false);
  assertEquals(sig(DOCX, zipHeader("")), false);
  assertEquals(sig(DOCX, bytes(0x50, 0x4b, 0x03, 0x04)), false); // header only
});

Deno.test("stored object must match the record", () => {
  const rec = { sizeBytes: 1000, mimeType: "application/pdf" };
  assertEquals(checkStoredObject({ contentLength: 1000, contentType: "application/pdf" }, rec), { ok: true });
  assertEquals(checkStoredObject({ contentLength: 1000, contentType: "Application/PDF; x=y" }, rec), { ok: true });
  assertEquals(checkStoredObject({ contentLength: 999, contentType: "application/pdf" }, rec), { ok: false, reason: "SIZE_MISMATCH" });
  assertEquals(checkStoredObject({ contentLength: 1000, contentType: "image/png" }, rec), { ok: false, reason: "TYPE_MISMATCH" });
  assertEquals(checkStoredObject({ contentLength: 1000, contentType: null }, rec), { ok: false, reason: "TYPE_MISMATCH" });
  assertEquals(checkStoredObject({ contentLength: 0, contentType: "application/pdf" }, rec), { ok: false, reason: "EMPTY" });
  assertEquals(checkStoredObject({ contentLength: null, contentType: "application/pdf" }, rec), { ok: false, reason: "SIZE_MISMATCH" });
  assertEquals(checkStoredObject({ contentLength: MAX_FILE_SIZE_BYTES + 1, contentType: "application/pdf" }, { sizeBytes: MAX_FILE_SIZE_BYTES + 1, mimeType: "application/pdf" }), { ok: false, reason: "TOO_LARGE" });
});

Deno.test("download disposition is always an attachment with a safe name", () => {
  const plain = attachmentDisposition("relatório final.pdf");
  assertEquals(plain.startsWith('attachment; filename="'), true);
  assertStringIncludes(plain, "filename*=UTF-8''relat%C3%B3rio%20final.pdf");
  assertStringIncludes(plain, 'filename="relatorio final.pdf"');
  for (const hostile of ['a"b.pdf', "a/b\\c.pdf", "x\r\nSet-Cookie: a=b.pdf", "..", "", "\u0000.pdf"]) {
    const value = attachmentDisposition(hostile);
    assertEquals(value.startsWith("attachment; filename="), true, hostile);
    assertEquals(/[\r\n\u0000]/.test(value), false, hostile);
    const ascii = value.match(/filename="([^"]*)"/)?.[1] ?? "";
    assertEquals(/["\\/]/.test(ascii), false, hostile);
  }
});
