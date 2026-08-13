// 전국 약국·응급의료기관 정보를 받아 data/ 아래 시도별 JSON으로 떨군다.
//
// 왜 미리 받아두는가: 두 API 모두 개발계정 트래픽이 하루 1,000건뿐이라
// 브라우저에서 직접 부르면 인증키가 노출되는 데다 하루 만에 한도가 날아간다.
// 그래서 하루 한 번 여기서 받아 정적 JSON으로 저장하고, 화면은 그 파일만 읽는다.
//
// 의존성을 쓰지 않는다: 이 저장소는 빌드도 node_modules도 없는 정적 사이트라
// 그 성격을 유지한다. 응답이 XML이라 아래에 작은 파서를 직접 두었다.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const dataDir = process.env.MEDICAL_OUT_DIR
  ? path.resolve(process.env.MEDICAL_OUT_DIR)
  : path.join(rootDir, "data");

const PHARMACY_KEY = process.env.PHARMACY_API_KEY;
const EMERGENCY_KEY = process.env.EMERGENCY_API_KEY;
// main()에서 형식을 검증하고 뒤쪽 슬래시를 떼면서 다시 대입한다.
let PHARMACY_BASE = process.env.PHARMACY_API_ENDPOINT;
let EMERGENCY_BASE = process.env.EMERGENCY_API_ENDPOINT;

// 시크릿에는 서비스 URL까지만 넣고 오퍼레이션은 코드가 붙인다. 오퍼레이션까지
// 시크릿에 박아두면 같은 서비스의 다른 기능(약국 위치정보, 응급실 실시간
// 가용병상 등)을 쓸 때 시크릿을 다시 손대야 한다.
const PHARMACY_OPERATION = "getParmacyListInfoInqire";
const EMERGENCY_OPERATION = "getEgytListInfoInqire";

const NUM_OF_ROWS = 1000;
// 한 시도에서 이 페이지 수를 넘기지 않는다. total_count를 그대로 믿고 돌다가
// 응답이 이상하면 하루치 호출 한도를 다 태울 수 있다.
const MAX_PAGES = 12;

// 약국 API의 Q0, 응급의료기관 API의 STAGE1에 그대로 들어가는 시도명.
// 강원·전북은 특별자치도로 바뀐 뒤 표기가 갈리는 곳이라, 조회 결과가 0건이면
// 아래 ALT 표기로 한 번 더 시도한다.
const REGIONS = [
  { code: "seoul", name: "서울특별시" },
  { code: "busan", name: "부산광역시" },
  { code: "daegu", name: "대구광역시" },
  { code: "incheon", name: "인천광역시" },
  { code: "gwangju", name: "광주광역시" },
  { code: "daejeon", name: "대전광역시" },
  { code: "ulsan", name: "울산광역시" },
  { code: "sejong", name: "세종특별자치시", alt: ["세종시"] },
  { code: "gyeonggi", name: "경기도" },
  { code: "gangwon", name: "강원특별자치도", alt: ["강원도"] },
  { code: "chungbuk", name: "충청북도" },
  { code: "chungnam", name: "충청남도" },
  { code: "jeonbuk", name: "전북특별자치도", alt: ["전라북도"] },
  { code: "jeonnam", name: "전라남도" },
  { code: "gyeongbuk", name: "경상북도" },
  { code: "gyeongnam", name: "경상남도" },
  { code: "jeju", name: "제주특별자치도", alt: ["제주도"] },
];

// ---- 아주 작은 XML 리더 ---------------------------------------------------
// 이 두 API의 응답은 <item> 안에 한 겹짜리 태그만 들어 있어서 이 정도로 충분하다.
// 중첩 구조가 필요해지면 그때 제대로 된 파서를 붙일 것.

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseItems(xml) {
  const items = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = {};
    for (const [, tag, value] of body.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) {
      item[tag] = decodeEntities(value);
    }
    items.push(item);
  }
  return items;
}

function readTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]) : null;
}

// ---- 호출 -----------------------------------------------------------------

/**
 * 시크릿에 담긴 서비스 URL을 검증한다. 오타나 프로토콜 누락이면 fetch가
 * "fetch failed" 한 줄만 던지고 끝나서 원인을 알 수 없기 때문에, 먼저 걸러낸다.
 */
function normalizeBase(name, value) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${name}이 URL 형식이 아닙니다: ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name}의 프로토콜이 http(s)가 아닙니다: ${url.protocol}`);
  }
  return trimmed;
}

async function fetchPage(base, key, operation, params) {
  // serviceKey는 URLSearchParams에 넣으면 안 된다. 공공데이터포털이 주는 키에는
  // 이미 %2B 같은 인코딩이 들어 있어서 한 번 더 인코딩되면 서명이 깨진다.
  // 나머지 파라미터만 URLSearchParams로 만들고 키는 raw로 붙인다.
  const query = new URLSearchParams({ numOfRows: String(NUM_OF_ROWS), ...params });
  const url = `${base}/${operation}?serviceKey=${key}&${query.toString()}`;

  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "toddler-milestone-checklist/1.0" } });
  } catch (err) {
    // undici는 DNS 실패든 TLS 오류든 "fetch failed" 한 줄만 던진다. 실제 원인은
    // cause에 들어 있어서 그것까지 붙여줘야 진단이 한 번에 끝난다.
    // 인증키가 섞이지 않도록 URL은 호스트+경로까지만 남긴다.
    const cause = err.cause?.message ?? err.cause?.code ?? "원인 불명";
    throw new Error(`${base}/${operation} 요청 실패: ${err.message} (${cause})`);
  }
  const text = await res.text();

  // 인증 오류는 HTTP 403 + OpenAPI_ServiceResponse 형태로 오고, 정상 응답과
  // 껍데기가 아예 다르다. 빈 목록으로 착각하지 않도록 여기서 걸러낸다.
  const authError = readTag(text, "returnAuthMsg") ?? readTag(text, "errMsg");
  if (authError) throw new Error(`인증/요청 오류: ${authError}`);
  if (!res.ok) throw new Error(`http ${res.status}`);

  const resultCode = readTag(text, "resultCode");
  if (resultCode && resultCode !== "00") {
    throw new Error(`API 오류 ${resultCode}: ${readTag(text, "resultMsg") ?? ""}`.trim());
  }

  return { items: parseItems(text), totalCount: Number(readTag(text, "totalCount") ?? 0) };
}

async function fetchAllPages(base, key, operation, params) {
  const collected = [];
  let pageNo = 1;
  let totalCount = null;

  while (pageNo <= MAX_PAGES) {
    const { items, totalCount: total } = await fetchPage(base, key, operation, {
      ...params,
      pageNo: String(pageNo),
    });
    totalCount ??= total;
    collected.push(...items);

    if (collected.length >= totalCount || items.length === 0) break;
    pageNo += 1;
  }

  if (totalCount && collected.length < totalCount) {
    console.warn(
      `[fetch-medical] ${params.Q0 ?? params.STAGE1}: ${totalCount}건 중 ${collected.length}건만 수집(MAX_PAGES 제한)`
    );
  }
  return collected;
}

/** 시도명 표기가 갈리는 지역(강원·전북 등)을 위해 대체 표기로 한 번 더 시도한다. */
async function fetchRegion(base, key, operation, regionKey, region) {
  for (const name of [region.name, ...(region.alt ?? [])]) {
    const items = await fetchAllPages(base, key, operation, { [regionKey]: name });
    if (items.length > 0) return items;
    console.warn(`[fetch-medical] ${region.code}: "${name}" 조회 결과 0건`);
  }
  return [];
}

// ---- 운영시간 -------------------------------------------------------------
// dutyTime{N}s / dutyTime{N}c = N요일의 시작/종료 시각(HHMM 문자열).
// N은 1=월 … 5=금, 6=토, 7=일, 8=공휴일.

function parseTime(value) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  // 새벽까지 여는 곳은 종료 시각이 2400을 넘겨(2530 등) 오기도 한다.
  return hour * 60 + minute;
}

function readHours(item) {
  const hours = {};
  for (let day = 1; day <= 8; day += 1) {
    const open = parseTime(item[`dutyTime${day}s`]);
    const close = parseTime(item[`dutyTime${day}c`]);
    if (open === null || close === null) continue;
    hours[day] = [open, close];
  }
  return hours;
}

/**
 * 밤이나 주말에 갈 수 있는 곳만 남긴다. 낮에 문 연 약국은 어디에나 있어서
 * 전량을 담으면 파일만 커지고(전국 2만 4천 곳) 정작 필요한 정보가 묻힌다.
 */
function isAfterHours(hours) {
  for (let day = 1; day <= 5; day += 1) {
    const close = hours[day]?.[1];
    if (close !== undefined && close >= 21 * 60) return true; // 평일 21시 이후까지
  }
  const saturdayClose = hours[6]?.[1];
  if (saturdayClose !== undefined && saturdayClose >= 18 * 60) return true; // 토요일 저녁까지
  if (hours[7]) return true; // 일요일 운영
  if (hours[8]) return true; // 공휴일 운영
  return false;
}

// ---- 정규화 ---------------------------------------------------------------

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePharmacy(item) {
  const hours = readHours(item);
  return {
    id: item.hpid ?? null,
    name: item.dutyName ?? null,
    addr: item.dutyAddr ?? null,
    tel: item.dutyTel1 ?? null,
    lat: toNumberOrNull(item.wgs84Lat),
    lon: toNumberOrNull(item.wgs84Lon),
    hours,
  };
}

function normalizeEmergency(item) {
  return {
    id: item.hpid ?? null,
    name: item.dutyName ?? null,
    addr: item.dutyAddr ?? null,
    // dutyTel3가 응급실 직통이다. 대표번호(dutyTel1)만 있으면 그걸 쓴다.
    tel: item.dutyTel3 ?? item.dutyTel1 ?? null,
    lat: toNumberOrNull(item.wgs84Lat),
    lon: toNumberOrNull(item.wgs84Lon),
  };
}

// ---- 수집 -----------------------------------------------------------------

async function collectPharmacies() {
  const byRegion = {};
  let total = 0;
  let kept = 0;

  for (const region of REGIONS) {
    const items = await fetchRegion(PHARMACY_BASE, PHARMACY_KEY, PHARMACY_OPERATION, "Q0", region);
    total += items.length;

    const list = items
      .map(normalizePharmacy)
      .filter((p) => p.name && isAfterHours(p.hours))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ko"));

    kept += list.length;
    byRegion[region.code] = list;
    console.log(`[fetch-medical] 약국 ${region.code}: 전체 ${items.length} → 야간·휴일 ${list.length}`);
  }

  console.log(`[fetch-medical] 약국 합계: 전체 ${total} → 저장 ${kept}`);
  return byRegion;
}

/**
 * 주소 첫 낱말로 시도를 알아낸다. 옛 표기(강원도)와 새 표기(강원특별자치도)가
 * 섞여 있어서 접두어로 맞춘다.
 */
const REGION_BY_ADDRESS_PREFIX = REGIONS.flatMap((region) =>
  [region.name, ...(region.alt ?? [])].map((name) => [name.slice(0, 2), region.code])
);

function regionFromAddress(addr) {
  if (!addr) return null;
  const head = addr.trim().slice(0, 2);
  for (const [prefix, code] of REGION_BY_ADDRESS_PREFIX) {
    if (head === prefix) return code;
  }
  return null;
}

/**
 * 응급의료기관은 STAGE1(시도)을 넣어도 전국 목록이 그대로 돌아온다. 실제로
 * 17개 시도 모두 같은 533건이 나왔다. 그래서 지역별로 부르지 않고 한 번만
 * 받아서 주소로 나눈다 - 호출도 17회에서 1회로 줄고 결과도 정확해진다.
 */
async function collectEmergencyRooms() {
  const byRegion = Object.fromEntries(REGIONS.map((r) => [r.code, []]));

  const items = await fetchAllPages(EMERGENCY_BASE, EMERGENCY_KEY, EMERGENCY_OPERATION, {});
  let unmatched = 0;

  for (const item of items) {
    const normalized = normalizeEmergency(item);
    if (!normalized.name) continue;
    const code = regionFromAddress(normalized.addr);
    if (!code) {
      unmatched += 1;
      continue;
    }
    byRegion[code].push(normalized);
  }

  for (const list of Object.values(byRegion)) {
    list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ko"));
  }

  const total = Object.values(byRegion).reduce((a, l) => a + l.length, 0);
  console.log(
    `[fetch-medical] 응급실: 전체 ${items.length} → 시도 분류 ${total}` +
      (unmatched ? ` (주소로 시도를 못 찾음 ${unmatched}건)` : "")
  );
  for (const region of REGIONS) {
    console.log(`[fetch-medical]   응급실 ${region.code}: ${byRegion[region.code].length}`);
  }
  return byRegion;
}

// ---- 저장 -----------------------------------------------------------------

async function writeRegionFiles(kind, byRegion) {
  const dir = path.join(dataDir, kind);
  await mkdir(dir, { recursive: true });
  for (const [code, list] of Object.entries(byRegion)) {
    // 들여쓰기 없이 쓴다. 시도별로 나눠도 수천 건이라 들여쓰기만으로 두 배가 된다.
    await writeFile(path.join(dir, `${code}.json`), JSON.stringify(list));
  }
}

async function main() {
  const missing = [
    ["PHARMACY_API_KEY", PHARMACY_KEY],
    ["PHARMACY_API_ENDPOINT", PHARMACY_BASE],
    ["EMERGENCY_API_KEY", EMERGENCY_KEY],
    ["EMERGENCY_API_ENDPOINT", EMERGENCY_BASE],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new Error(`환경변수가 필요합니다: ${missing.join(", ")}`);

  // 시크릿에 들어온 값이 어떤 호스트를 가리키는지 남긴다(키는 찍지 않는다).
  // 엔드포인트 오타는 로그만 봐서는 절대 드러나지 않는 종류의 실패다.
  PHARMACY_BASE = normalizeBase("PHARMACY_API_ENDPOINT", PHARMACY_BASE);
  EMERGENCY_BASE = normalizeBase("EMERGENCY_API_ENDPOINT", EMERGENCY_BASE);
  console.log(`[fetch-medical] 약국 API: ${PHARMACY_BASE}`);
  console.log(`[fetch-medical] 응급의료 API: ${EMERGENCY_BASE}`);

  const pharmacies = await collectPharmacies();
  const emergencyRooms = await collectEmergencyRooms();

  const pharmacyCount = Object.values(pharmacies).reduce((a, l) => a + l.length, 0);
  const emergencyCount = Object.values(emergencyRooms).reduce((a, l) => a + l.length, 0);
  if (pharmacyCount === 0 && emergencyCount === 0) {
    throw new Error("두 API 모두 0건 - 기존 데이터를 덮어쓰지 않고 중단합니다");
  }

  await mkdir(dataDir, { recursive: true });
  await writeRegionFiles("pharmacy", pharmacies);
  await writeRegionFiles("emergency", emergencyRooms);

  const meta = {
    updatedAt: new Date().toISOString(),
    regions: REGIONS.map(({ code, name }) => ({
      code,
      name,
      pharmacy: pharmacies[code]?.length ?? 0,
      emergency: emergencyRooms[code]?.length ?? 0,
    })),
  };
  await writeFile(path.join(dataDir, "medical-meta.json"), JSON.stringify(meta, null, 2));

  console.log(`[fetch-medical] 저장 완료 (약국 ${pharmacyCount}, 응급실 ${emergencyCount})`);
}

main().catch((err) => {
  console.error(`[fetch-medical] ${err.message}`);
  process.exit(1);
});
