import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

test("광고·분석 스크립트를 싣는 페이지가 개인정보처리방침으로 이어진다", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const footer = html.match(/<footer>[\s\S]*?<\/footer>/)?.[0] ?? "";
  assert.ok(
    footer.includes('href="https://kyhsa93.github.io/privacy-policy"'),
    "footer에 개인정보처리방침 링크가 없습니다"
  );
});
