import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const INDEX_PATH = path.join(root, "index.html");

const OPEN = "<!--noscript:milestones-->";
const CLOSE = "<!--/noscript:milestones-->";

function literalAfter(html, declaration) {
  const start = html.indexOf(declaration);
  if (start === -1) throw new Error(`${declaration}를 찾지 못했습니다`);

  const from = start + declaration.length;
  const open = html[from];
  const close = open === "[" ? "]" : "}";

  let depth = 0;
  for (let i = from; i < html.length; i += 1) {
    if (html[i] === open) depth += 1;
    else if (html[i] === close) {
      depth -= 1;
      if (depth === 0) return vm.runInThisContext(`(${html.slice(from, i + 1)})`);
    }
  }
  throw new Error(`${declaration}의 끝을 찾지 못했습니다`);
}

const escapeHtml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const DOMAIN_ORDER = ["social", "language", "cognitive", "physical"];

export function buildNoscript(html) {
  const labels = literalAfter(html, "const DOMAIN_LABELS = ").ko;
  const data = literalAfter(html, "const DATA = ");

  let out = "";
  for (const band of data) {
    out += `<h2>${escapeHtml(band.label.ko)}</h2>`;
    for (const domain of DOMAIN_ORDER) {
      const items = band.items.filter((item) => item.domain === domain);
      if (!items.length) continue;
      out += `<h3>${escapeHtml(labels[domain])}</h3><ul>`;
      for (const item of items) out += `<li>${escapeHtml(item.ko)}</li>`;
      out += `</ul>`;
    }
  }

  return (
    `<noscript><article lang="ko">` +
    `<h1>0~36개월 발달 이정표 관찰 항목</h1>` +
    `<p>미국 질병통제예방센터(CDC)가 이 연령대에 대해 공개한 열 개 연령 구간의 발달 이정표를, ` +
    `사회성·정서, 언어·의사소통, 인지, 신체·운동 네 영역으로 나눠 정리한 것입니다. ` +
    `진단 도구가 아니라 관찰 목록이며, 걱정되는 항목이 있으면 소아과 검진에서 확인하세요.</p>` +
    out +
    `</article></noscript>`
  );
}

export function applyNoscript(html) {
  const start = html.indexOf(OPEN);
  const end = html.indexOf(CLOSE);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${OPEN} 자리표시 주석을 찾지 못했습니다`);
  }
  return `${html.slice(0, start + OPEN.length)}${buildNoscript(html)}${html.slice(end)}`;
}

async function main() {
  const html = await readFile(INDEX_PATH, "utf8");
  const next = applyNoscript(html);
  if (next === html) {
    console.log("  index.html 변경 없음");
    return;
  }
  await writeFile(INDEX_PATH, next);
  console.log(`  index.html 갱신 — noscript 본문 ${buildNoscript(html).length}자`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((err) => {
    console.error(`noscript 본문 생성 실패: ${err.message}`);
    process.exit(1);
  });
}
