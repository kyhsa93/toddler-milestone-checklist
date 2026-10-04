import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

test("분석 스크립트를 싣는 페이지가 개인정보처리방침으로 이어진다", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const footer = html.match(/<footer>[\s\S]*?<\/footer>/)?.[0] ?? "";
  assert.ok(
    footer.includes('href="https://kyhsa93.github.io/privacy-policy"'),
    "footer에 개인정보처리방침 링크가 없습니다"
  );
});

test("WHO 성장표(CC BY-NC-SA)를 싣는 페이지라 광고를 싣지 않는다", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  assert.equal(html.match(/adsbygoogle|google-adsense-account|ca-pub-/g), null, "광고 코드가 남아 있습니다");
  assert.ok(html.includes("googletagmanager.com/gtag/js?id=G-Z1LH7S1ZE5"), "GA가 빠졌습니다");
});
