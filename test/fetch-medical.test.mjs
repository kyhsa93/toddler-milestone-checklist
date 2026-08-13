import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(import.meta.dirname, "../scripts/fetch-medical.mjs");

// 공공데이터포털 응답을 흉내내는 스텁. 실제 인증키 없이 페이지네이션·필터·
// 오류 처리를 태워보려는 것이라, 태그 이름은 실제 응답과 맞춰둔다.
function startStub(handler) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const operation = url.pathname.split("/").pop();
    const body = handler({
      operation,
      region: url.searchParams.get("Q0") ?? url.searchParams.get("STAGE1"),
      pageNo: Number(url.searchParams.get("pageNo") ?? 1),
      serviceKey: url.searchParams.get("serviceKey"),
    });
    res.writeHead(body.status ?? 200, { "Content-Type": "application/xml" });
    res.end(body.xml);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function itemsXml(items, totalCount) {
  const body = items
    .map(
      (fields) =>
        `<item>${Object.entries(fields)
          .map(([k, v]) => `<${k}>${v}</${k}>`)
          .join("")}</item>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>${body}</items><totalCount>${
    totalCount ?? items.length
  }</totalCount></body></response>`;
}

function pharmacy(name, hours = {}, extra = {}) {
  const times = {};
  for (const [day, [open, close]] of Object.entries(hours)) {
    times[`dutyTime${day}s`] = open;
    times[`dutyTime${day}c`] = close;
  }
  return {
    hpid: `H${name}`,
    dutyName: name,
    dutyAddr: "서울특별시 강남구 어딘가 1",
    dutyTel1: "02-000-0000",
    wgs84Lat: "37.5",
    wgs84Lon: "127.0",
    ...times,
    ...extra,
  };
}

async function run(pharmacyBase, emergencyBase, outDir) {
  return execFileAsync("node", [scriptPath], {
    env: {
      ...process.env,
      MEDICAL_OUT_DIR: outDir,
      PHARMACY_API_KEY: "TESTKEY",
      PHARMACY_API_ENDPOINT: pharmacyBase,
      EMERGENCY_API_KEY: "TESTKEY",
      EMERGENCY_API_ENDPOINT: emergencyBase,
    },
  });
}

async function readJson(dir, ...parts) {
  return JSON.parse(await readFile(path.join(dir, ...parts), "utf-8"));
}

async function tempDir() {
  return mkdtemp(path.join(tmpdir(), "medical-test-"));
}

/** 서울에만 데이터를 주고 나머지 시도는 빈 응답을 주는 스텁을 만든다. */
function seoulOnlyStub(seoulItems, emergencyItems = []) {
  return startStub(({ operation, region }) => {
    if (region !== "서울특별시") return { xml: itemsXml([]) };
    if (operation === "getParmacyListInfoInqire") return { xml: itemsXml(seoulItems) };
    return { xml: itemsXml(emergencyItems) };
  });
}

test("야간·휴일에 여는 약국만 남기고 낮에만 여는 곳은 버린다", async () => {
  const stub = await seoulOnlyStub([
    pharmacy("늦게까지약국", { 1: ["0900", "2300"] }),
    pharmacy("일요일약국", { 7: ["1000", "1700"] }),
    pharmacy("공휴일약국", { 8: ["1000", "1700"] }),
    pharmacy("토요일저녁약국", { 6: ["0900", "1900"] }),
    pharmacy("낮에만약국", { 1: ["0900", "1800"], 6: ["0900", "1300"] }),
  ]);
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const list = await readJson(outDir, "pharmacy", "seoul.json");
    const names = list.map((p) => p.name).sort();
    assert.deepEqual(names, ["공휴일약국", "늦게까지약국", "일요일약국", "토요일저녁약국"]);
  } finally {
    await stub.close();
  }
});

test("운영시간을 요일별 분 단위로 정규화한다", async () => {
  const stub = await seoulOnlyStub([pharmacy("테스트약국", { 1: ["0900", "2130"], 7: ["1000", "1700"] })]);
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const [item] = await readJson(outDir, "pharmacy", "seoul.json");
    assert.deepEqual(item.hours["1"], [540, 1290]); // 09:00~21:30
    assert.deepEqual(item.hours["7"], [600, 1020]);
    assert.equal(item.lat, 37.5);
    assert.equal(item.tel, "02-000-0000");
  } finally {
    await stub.close();
  }
});

test("여러 페이지에 걸친 목록을 totalCount만큼 이어서 가져온다", async () => {
  let pages = 0;
  const stub = await startStub(({ operation, region, pageNo }) => {
    if (region !== "서울특별시" || operation !== "getParmacyListInfoInqire") {
      return { xml: itemsXml([]) };
    }
    pages += 1;
    return { xml: itemsXml([pharmacy(`약국${pageNo}`, { 7: ["1000", "1700"] })], 3) };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const list = await readJson(outDir, "pharmacy", "seoul.json");
    assert.equal(pages, 3);
    assert.equal(list.length, 3);
  } finally {
    await stub.close();
  }
});

test("시도 표기가 바뀐 지역은 대체 표기로 다시 조회한다", async () => {
  // 강원특별자치도로는 0건이고 강원도로는 나오는 상황
  const tried = [];
  const stub = await startStub(({ operation, region }) => {
    tried.push(region);
    if (operation !== "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    if (region === "강원도") return { xml: itemsXml([pharmacy("강원약국", { 7: ["1000", "1700"] })]) };
    return { xml: itemsXml([]) };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const list = await readJson(outDir, "pharmacy", "gangwon.json");
    assert.equal(list.length, 1);
    assert.ok(tried.includes("강원특별자치도") && tried.includes("강원도"));
  } finally {
    await stub.close();
  }
});

test("응급의료기관은 운영시간 필터 없이 전부 담고 응급실 직통번호를 쓴다", async () => {
  const stub = await startStub(({ operation, region }) => {
    if (region !== "서울특별시") return { xml: itemsXml([]) };
    if (operation === "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    return {
      xml: itemsXml([
        {
          hpid: "E1",
          dutyName: "서울응급센터",
          dutyAddr: "서울특별시 종로구 1",
          dutyTel1: "02-111-1111",
          dutyTel3: "02-222-2222",
          wgs84Lat: "37.57",
          wgs84Lon: "126.97",
        },
      ]),
    };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const [item] = await readJson(outDir, "emergency", "seoul.json");
    assert.equal(item.name, "서울응급센터");
    assert.equal(item.tel, "02-222-2222", "응급실 직통(dutyTel3)을 우선해야 한다");
  } finally {
    await stub.close();
  }
});

test("인증 오류 응답을 빈 목록으로 착각하지 않는다", async () => {
  const stub = await startStub(() => ({
    status: 403,
    xml: `<?xml version="1.0" encoding="UTF-8"?><OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`,
  }));
  const outDir = await tempDir();

  try {
    await assert.rejects(() => run(stub.base, stub.base, outDir));
  } finally {
    await stub.close();
  }
});

test("CDATA와 이스케이프된 문자를 풀어서 저장한다", async () => {
  const stub = await seoulOnlyStub([
    pharmacy("CDATA약국", { 7: ["1000", "1700"] }, {
      dutyName: "<![CDATA[미소&amp;약국]]>",
      dutyAddr: "서울특별시 강남구 A&amp;B빌딩",
    }),
  ]);
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const [item] = await readJson(outDir, "pharmacy", "seoul.json");
    assert.equal(item.name, "미소&약국");
    assert.equal(item.addr, "서울특별시 강남구 A&B빌딩");
  } finally {
    await stub.close();
  }
});

test("시도별 건수를 담은 메타 파일을 남긴다", async () => {
  const stub = await seoulOnlyStub([pharmacy("메타약국", { 7: ["1000", "1700"] })]);
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const meta = await readJson(outDir, "medical-meta.json");
    assert.equal(meta.regions.length, 17);
    const seoul = meta.regions.find((r) => r.code === "seoul");
    assert.equal(seoul.pharmacy, 1);
    assert.ok(meta.updatedAt);
  } finally {
    await stub.close();
  }
});

test("엔드포인트가 URL 형식이 아니면 무엇이 잘못됐는지 알려주고 멈춘다", async () => {
  // 시크릿에 오타가 나면 fetch는 "fetch failed" 한 줄만 남기고 끝나서
  // 로그만 보고는 원인을 알 수 없다.
  const outDir = await tempDir();
  await assert.rejects(
    () => run("apis.data.go.kr/B552657/ErmctInsttInfoInqireService", "https://example.com", outDir),
    (err) => {
      assert.match(err.stderr ?? "", /PHARMACY_API_ENDPOINT/);
      return true;
    }
  );
});

test("환경변수가 없으면 즉시 실패한다", async () => {
  await assert.rejects(() =>
    execFileAsync("node", [scriptPath], {
      env: { ...process.env, MEDICAL_OUT_DIR: "/tmp", PHARMACY_API_KEY: "", PHARMACY_API_ENDPOINT: "" },
    })
  );
});
