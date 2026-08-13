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
      RETRY_BACKOFF_MS: "10", // 실제 백오프를 다 기다리면 테스트가 분 단위로 길어진다
    },
  });
}

async function readJson(dir, ...parts) {
  return JSON.parse(await readFile(path.join(dir, ...parts), "utf-8"));
}

async function tempDir() {
  return mkdtemp(path.join(tmpdir(), "medical-test-"));
}

/**
 * 약국은 서울에만 데이터를 주고 나머지 시도는 빈 응답을 준다.
 * 응급의료기관은 실제 API처럼 지역 파라미터와 무관하게 전국 목록을 돌려준다.
 */
function seoulOnlyStub(seoulItems, emergencyItems = []) {
  return startStub(({ operation, region }) => {
    if (operation !== "getParmacyListInfoInqire") return { xml: itemsXml(emergencyItems) };
    if (region !== "서울특별시") return { xml: itemsXml([]) };
    return { xml: itemsXml(seoulItems) };
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
  const stub = await seoulOnlyStub(
    [],
    [
      {
        hpid: "E1",
        dutyName: "서울응급센터",
        dutyAddr: "서울특별시 종로구 1",
        dutyTel1: "02-111-1111",
        dutyTel3: "02-222-2222",
        wgs84Lat: "37.57",
        wgs84Lon: "126.97",
      },
    ]
  );
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

test("응급의료기관은 한 번만 받아 주소로 시도를 나눈다", async () => {
  // 실제 API는 STAGE1(시도)을 줘도 전국 목록을 그대로 돌려준다. 지역별로
  // 부르면 17개 시도 파일에 전국 목록이 똑같이 들어가는 사고가 난다.
  let emergencyCalls = 0;
  const stub = await startStub(({ operation }) => {
    if (operation === "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    emergencyCalls += 1;
    return {
      xml: itemsXml([
        { hpid: "E1", dutyName: "서울병원", dutyAddr: "서울특별시 종로구 1", dutyTel3: "02-1" },
        { hpid: "E2", dutyName: "부산병원", dutyAddr: "부산광역시 해운대구 2", dutyTel3: "051-1" },
        { hpid: "E3", dutyName: "강원병원", dutyAddr: "강원특별자치도 춘천시 3", dutyTel3: "033-1" },
        { hpid: "E4", dutyName: "옛강원병원", dutyAddr: "강원도 원주시 4", dutyTel3: "033-2" },
      ]),
    };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    assert.equal(emergencyCalls, 1, "응급의료기관은 한 번만 호출해야 한다");

    assert.deepEqual((await readJson(outDir, "emergency", "seoul.json")).map((e) => e.name), ["서울병원"]);
    assert.deepEqual((await readJson(outDir, "emergency", "busan.json")).map((e) => e.name), ["부산병원"]);
    // 신·구 표기가 섞여 있어도 같은 시도로 모여야 한다.
    assert.deepEqual(
      (await readJson(outDir, "emergency", "gangwon.json")).map((e) => e.name).sort(),
      ["강원병원", "옛강원병원"]
    );
    assert.deepEqual(await readJson(outDir, "emergency", "jeju.json"), []);
  } finally {
    await stub.close();
  }
});

test("전남광주통합특별시 주소를 옛 광주와 옛 전남으로 가른다", async () => {
  // 2026-07-01 전남·광주가 통합되면서 응급의료 데이터 주소가 통합 명칭으로
  // 바뀌었다. 그대로 두면 "전남"으로 시작하니 광주 병원이 전부 전남으로 가고
  // 광주 지역 사용자에게는 빈 목록이 나간다.
  const stub = await startStub(({ operation }) => {
    if (operation === "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    return {
      xml: itemsXml([
        { hpid: "1", dutyName: "광주기독병원", dutyAddr: "전남광주통합특별시 남구 양림로 37" },
        { hpid: "2", dutyName: "광주병원", dutyAddr: "전남광주통합특별시 북구 면앙로139번길 51" },
        { hpid: "3", dutyName: "광산병원", dutyAddr: "전남광주통합특별시 광산구 어딘가 1" },
        { hpid: "4", dutyName: "곡성사랑병원", dutyAddr: "전남광주통합특별시 곡성군 곡성읍 곡성로 761" },
        { hpid: "5", dutyName: "광양사랑병원", dutyAddr: "전남광주통합특별시 광양시 공영로 71" },
      ]),
    };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const names = async (code) =>
      (await readJson(outDir, "emergency", `${code}.json`)).map((e) => e.name).sort();

    assert.deepEqual(await names("gwangju"), ["광산병원", "광주기독병원", "광주병원"]);
    assert.deepEqual(await names("jeonnam"), ["곡성사랑병원", "광양사랑병원"]);
  } finally {
    await stub.close();
  }
});

test("남도와 북도를 섞지 않고, 축약 표기 주소도 제 시도로 보낸다", async () => {
  // 시도명 앞 두 글자로 자르면 "충청북도"와 "충청남도"가 똑같이 "충청"이 되어
  // 남도가 통째로 북도로 들어간다. 실제로 충남·전남·경남이 0건이 됐던 버그다.
  const stub = await startStub(({ operation }) => {
    if (operation === "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    return {
      xml: itemsXml([
        { hpid: "1", dutyName: "충북병원", dutyAddr: "충청북도 청주시 1" },
        { hpid: "2", dutyName: "충남병원", dutyAddr: "충청남도 천안시 2" },
        { hpid: "3", dutyName: "전남병원", dutyAddr: "전라남도 순천시 3" },
        { hpid: "4", dutyName: "경남병원", dutyAddr: "경상남도 창원시 4" },
        { hpid: "5", dutyName: "축약충남병원", dutyAddr: "충남 아산시 5" },
        { hpid: "6", dutyName: "광주병원", dutyAddr: "광주광역시 동구 6" },
        { hpid: "7", dutyName: "경기광주병원", dutyAddr: "경기도 광주시 7" },
      ]),
    };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const names = async (code) =>
      (await readJson(outDir, "emergency", `${code}.json`)).map((e) => e.name).sort();

    assert.deepEqual(await names("chungbuk"), ["충북병원"]);
    assert.deepEqual(await names("chungnam"), ["축약충남병원", "충남병원"]);
    assert.deepEqual(await names("jeonnam"), ["전남병원"]);
    assert.deepEqual(await names("gyeongnam"), ["경남병원"]);
    // 광주광역시와 경기도 광주시가 섞이면 안 된다.
    assert.deepEqual(await names("gwangju"), ["광주병원"]);
    assert.deepEqual(await names("gyeonggi"), ["경기광주병원"]);
  } finally {
    await stub.close();
  }
});

test("일시적인 연결 실패는 재시도로 넘긴다", async () => {
  // 러너에서 apis.data.go.kr 연결이 간헐적으로 타임아웃된다. 한 번 끊겼다고
  // 하루치 수집을 통째로 버리면 안 된다.
  let attempts = 0;
  const stub = await startStub(({ operation }) => {
    if (operation !== "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    attempts += 1;
    if (attempts === 1) return { status: 500, xml: "<html>gateway</html>" };
    return { xml: itemsXml([pharmacy("재시도약국", { 7: ["1000", "1700"] })]) };
  });
  const outDir = await tempDir();

  try {
    await run(stub.base, stub.base, outDir);
    const list = await readJson(outDir, "pharmacy", "seoul.json");
    assert.ok(attempts >= 2, "재시도가 일어나야 한다");
    assert.equal(list.length, 1);
  } finally {
    await stub.close();
  }
});

test("한 지역이 계속 실패해도 나머지는 갱신하고 그 지역은 기존 목록을 남긴다", async () => {
  // apis.data.go.kr은 러너에서 몇 분씩 연결이 안 되는 구간이 있다. 지역 하나
  // 때문에 하루치를 통째로 버리면 안 된다.
  const outDir = await tempDir();
  const okStub = await seoulOnlyStub([pharmacy("서울약국", { 7: ["1000", "1700"] })]);
  try {
    await run(okStub.base, okStub.base, outDir);
    assert.equal((await readJson(outDir, "pharmacy", "seoul.json")).length, 1);
  } finally {
    await okStub.close();
  }

  // 이제 서울만 계속 실패하고 부산은 새 데이터를 준다.
  const flakyStub = await startStub(({ operation, region }) => {
    if (operation !== "getParmacyListInfoInqire") return { xml: itemsXml([]) };
    if (region === "서울특별시") return { status: 500, xml: "<html>gateway</html>" };
    if (region === "부산광역시") return { xml: itemsXml([pharmacy("부산약국", { 7: ["1000", "1700"] })]) };
    return { xml: itemsXml([]) };
  });

  try {
    await run(flakyStub.base, flakyStub.base, outDir);
    // 실패한 서울은 기존 목록 유지
    assert.deepEqual((await readJson(outDir, "pharmacy", "seoul.json")).map((p) => p.name), ["서울약국"]);
    // 성공한 부산은 갱신
    assert.deepEqual((await readJson(outDir, "pharmacy", "busan.json")).map((p) => p.name), ["부산약국"]);

    const meta = await readJson(outDir, "medical-meta.json");
    assert.deepEqual(meta.staleRegions, ["seoul"]);
  } finally {
    await flakyStub.close();
  }
});

test("인증 오류는 재시도하지 않고 즉시 멈춘다", async () => {
  let calls = 0;
  const stub = await startStub(() => {
    calls += 1;
    return {
      status: 403,
      xml: `<?xml version="1.0"?><OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`,
    };
  });
  const outDir = await tempDir();

  try {
    await assert.rejects(() => run(stub.base, stub.base, outDir));
    assert.equal(calls, 1, "인증 오류는 다시 불러도 같은 답이라 한 번만 호출해야 한다");
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
