import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyNoscript, buildNoscript } from "../scripts/build-noscript.mjs";

const root = path.resolve(import.meta.dirname, "..");
const readIndex = () => readFile(path.join(root, "index.html"), "utf8");

test("커밋된 noscript 본문이 지금 DATA로 만든 것과 같다", async () => {
  const html = await readIndex();
  assert.equal(
    html,
    applyNoscript(html),
    "index.html의 noscript 본문이 DATA와 어긋납니다. node scripts/build-noscript.mjs를 실행하세요."
  );
});

test("체크리스트 항목이 하나도 빠지지 않는다", async () => {
  // 이 검사가 지키는 것은 "사람에게 보이는 것과 다른 것을 크롤러에게 주지 않는다"이다.
  // 항목을 골라 담기 시작하면 그 규칙이 조용히 깨진다.
  const html = await readIndex();
  const block = buildNoscript(html);
  const items = [...html.matchAll(/\{ domain: "\w+", ko: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);

  assert.ok(items.length >= 100, `체크리스트 항목을 ${items.length}개만 찾았습니다`);
  for (const item of items) {
    const text = item.replace(/\\"/g, '"');
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    assert.ok(block.includes(`<li>${escaped}</li>`), `noscript에 빠진 항목: ${text}`);
  }
});

test("크롤러가 받는 본문이 빈 페이지가 아니다", async () => {
  // 이 파일이 있는 이유 자체다. 화면을 전부 자바스크립트가 그리는 동안 크롤러가 받는
  // 본문은 스물두 자("🌐 0 / 0 –")뿐이었고, 이 앱은 광고를 싣는다.
  const html = await readIndex();
  const block = buildNoscript(html);
  const text = block
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  assert.ok(text.length > 2000, `noscript 본문이 ${text.length}자뿐입니다`);
});

test("noscript는 body 안에 한 번만 있다", async () => {
  const html = await readIndex();
  assert.equal((html.match(/<noscript>/g) ?? []).length, 1);
  assert.ok(html.indexOf("<noscript>") < html.indexOf("</body>"));
});
