
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const dataDir = process.env.MEDICAL_OUT_DIR
  ? path.resolve(process.env.MEDICAL_OUT_DIR)
  : path.join(rootDir, "data");

const PHARMACY_KEY = process.env.PHARMACY_API_KEY;
const EMERGENCY_KEY = process.env.EMERGENCY_API_KEY;
let PHARMACY_BASE = process.env.PHARMACY_API_ENDPOINT;
let EMERGENCY_BASE = process.env.EMERGENCY_API_ENDPOINT;

const PHARMACY_OPERATION = "getParmacyListInfoInqire";
const EMERGENCY_OPERATION = "getEgytListInfoInqire";

const NUM_OF_ROWS = 1000;
const MAX_PAGES = 12;

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
  const query = new URLSearchParams({ numOfRows: String(NUM_OF_ROWS), ...params });
  const url = `${base}/${operation}?serviceKey=${key}&${query.toString()}`;

  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "toddler-milestone-checklist/1.0" } });
  } catch (err) {
    const cause = err.cause?.message ?? err.cause?.code ?? "원인 불명";
    throw new Error(`${base}/${operation} 요청 실패: ${err.message} (${cause})`);
  }
  const text = await res.text();

  const authError = readTag(text, "returnAuthMsg") ?? readTag(text, "errMsg");
  if (authError) throw fatal(new Error(`인증/요청 오류: ${authError}`));
  if (!res.ok) throw new Error(`http ${res.status}`);

  const resultCode = readTag(text, "resultCode");
  if (resultCode && resultCode !== "00") {
    throw fatal(new Error(`API 오류 ${resultCode}: ${readTag(text, "resultMsg") ?? ""}`.trim()));
  }

  return { items: parseItems(text), totalCount: Number(readTag(text, "totalCount") ?? 0) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fatal(err) {
  err.fatal = true;
  return err;
}

async function withRetry(label, fn, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err.fatal) throw err;
      if (attempt === attempts) break;
      const wait = attempt * Number(process.env.RETRY_BACKOFF_MS ?? 5000);
      console.warn(`[fetch-medical] ${label} 실패(${attempt}/${attempts}), ${wait}ms 후 재시도: ${err.message}`);
      await sleep(wait);
    }
  }
  throw lastError;
}

async function fetchAllPages(base, key, operation, params) {
  const collected = [];
  let pageNo = 1;
  let totalCount = null;

  while (pageNo <= MAX_PAGES) {
    const label = `${operation} ${params.Q0 ?? params.STAGE1 ?? "전국"} p${pageNo}`;
    const { items, totalCount: total } = await withRetry(label, () =>
      fetchPage(base, key, operation, { ...params, pageNo: String(pageNo) })
    );
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

async function fetchRegion(base, key, operation, regionKey, region) {
  for (const name of [region.name, ...(region.alt ?? [])]) {
    const items = await fetchAllPages(base, key, operation, { [regionKey]: name });
    if (items.length > 0) return items;
    console.warn(`[fetch-medical] ${region.code}: "${name}" 조회 결과 0건`);
  }
  return [];
}


function parseTime(value) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
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

function isAfterHours(hours) {
  for (let day = 1; day <= 5; day += 1) {
    const close = hours[day]?.[1];
    if (close !== undefined && close >= 21 * 60) return true;
  }
  const saturdayClose = hours[6]?.[1];
  if (saturdayClose !== undefined && saturdayClose >= 18 * 60) return true;
  if (hours[7]) return true;
  if (hours[8]) return true;
  return false;
}


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
    tel: item.dutyTel3 ?? item.dutyTel1 ?? null,
    lat: toNumberOrNull(item.wgs84Lat),
    lon: toNumberOrNull(item.wgs84Lon),
  };
}


async function readExisting(kind, code) {
  try {
    const parsed = JSON.parse(await readFile(path.join(dataDir, kind, `${code}.json`), "utf-8"));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function collectPharmacies() {
  const byRegion = {};
  const failedRegions = [];
  let total = 0;
  let kept = 0;

  for (const region of REGIONS) {
    try {
      const items = await fetchRegion(PHARMACY_BASE, PHARMACY_KEY, PHARMACY_OPERATION, "Q0", region);
      total += items.length;

      const list = items
        .map(normalizePharmacy)
        .filter((p) => p.name && isAfterHours(p.hours))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ko"));

      kept += list.length;
      byRegion[region.code] = list;
      console.log(`[fetch-medical] 약국 ${region.code}: 전체 ${items.length} → 야간·휴일 ${list.length}`);
    } catch (err) {
      if (err.fatal) throw err;

      const previous = await readExisting("pharmacy", region.code);
      byRegion[region.code] = previous ?? [];
      failedRegions.push(region.code);
      console.error(
        `[fetch-medical] 약국 ${region.code} 수집 실패: ${err.message} (기존 ${previous?.length ?? 0}건 유지)`
      );
    }
  }

  if (failedRegions.length === REGIONS.length) {
    throw new Error("약국을 한 지역도 받지 못했습니다");
  }
  console.log(
    `[fetch-medical] 약국 합계: 전체 ${total} → 저장 ${kept}` +
      (failedRegions.length ? ` (실패 ${failedRegions.length}개 지역: ${failedRegions.join(", ")})` : "")
  );
  return { byRegion, failedRegions };
}

const ADDRESS_ALIASES = [
  ["seoul", ["서울특별시", "서울시", "서울"]],
  ["busan", ["부산광역시", "부산시", "부산"]],
  ["daegu", ["대구광역시", "대구시", "대구"]],
  ["incheon", ["인천광역시", "인천시", "인천"]],
  ["gwangju", ["광주광역시", "광주시", "광주"]],
  ["daejeon", ["대전광역시", "대전시", "대전"]],
  ["ulsan", ["울산광역시", "울산시", "울산"]],
  ["sejong", ["세종특별자치시", "세종시", "세종"]],
  ["gyeonggi", ["경기도", "경기"]],
  ["gangwon", ["강원특별자치도", "강원도", "강원"]],
  ["chungbuk", ["충청북도", "충북"]],
  ["chungnam", ["충청남도", "충남"]],
  ["jeonbuk", ["전북특별자치도", "전라북도", "전북"]],
  ["jeonnam", ["전라남도", "전남"]],
  ["gyeongbuk", ["경상북도", "경북"]],
  ["gyeongnam", ["경상남도", "경남"]],
  ["jeju", ["제주특별자치도", "제주도", "제주"]],
];

const ADDRESS_PREFIXES = ADDRESS_ALIASES.flatMap(([code, names]) =>
  names.map((name) => ({ name, code }))
).sort((a, b) => b.name.length - a.name.length);

const MERGED_JEONNAM_GWANGJU = "전남광주통합특별시";
const GWANGJU_DISTRICTS = ["동구", "서구", "남구", "북구", "광산구"];

function regionFromAddress(addr) {
  if (!addr) return null;
  const trimmed = addr.trim();

  if (trimmed.startsWith(MERGED_JEONNAM_GWANGJU)) {
    const rest = trimmed.slice(MERGED_JEONNAM_GWANGJU.length).trim();
    const first = rest.split(/\s+/)[0] ?? "";
    return GWANGJU_DISTRICTS.includes(first) ? "gwangju" : "jeonnam";
  }

  for (const { name, code } of ADDRESS_PREFIXES) {
    if (trimmed.startsWith(name)) return code;
  }
  return null;
}

async function collectEmergencyRooms() {
  const byRegion = Object.fromEntries(REGIONS.map((r) => [r.code, []]));

  let items;
  try {
    items = await fetchAllPages(EMERGENCY_BASE, EMERGENCY_KEY, EMERGENCY_OPERATION, {});
  } catch (err) {
    if (err.fatal) throw err;
    console.error(`[fetch-medical] 응급실 수집 실패: ${err.message} (기존 목록 유지)`);
    for (const region of REGIONS) {
      byRegion[region.code] = (await readExisting("emergency", region.code)) ?? [];
    }
    const keptTotal = Object.values(byRegion).reduce((a, l) => a + l.length, 0);
    return { byRegion, failed: true, keptTotal };
  }

  const unmatched = [];

  for (const item of items) {
    const normalized = normalizeEmergency(item);
    if (!normalized.name) continue;
    const code = regionFromAddress(normalized.addr);
    if (!code) {
      unmatched.push(`${normalized.name}: ${JSON.stringify(normalized.addr)}`);
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
      (unmatched.length ? ` (주소로 시도를 못 찾음 ${unmatched.length}건)` : "")
  );
  for (const sample of unmatched.slice(0, 10)) {
    console.warn(`[fetch-medical]   분류 실패: ${sample}`);
  }

  const empty = REGIONS.filter((r) => byRegion[r.code].length === 0).map((r) => r.code);
  if (empty.length) {
    console.warn(`[fetch-medical]   응급실이 0건인 시도: ${empty.join(", ")} - 분류 규칙 확인 필요`);
  }

  for (const region of REGIONS) {
    console.log(`[fetch-medical]   응급실 ${region.code}: ${byRegion[region.code].length}`);
  }
  return { byRegion, failed: false };
}


async function writeRegionFiles(kind, byRegion) {
  const dir = path.join(dataDir, kind);
  await mkdir(dir, { recursive: true });
  for (const [code, list] of Object.entries(byRegion)) {
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

  PHARMACY_BASE = normalizeBase("PHARMACY_API_ENDPOINT", PHARMACY_BASE);
  EMERGENCY_BASE = normalizeBase("EMERGENCY_API_ENDPOINT", EMERGENCY_BASE);
  console.log(`[fetch-medical] 약국 API: ${PHARMACY_BASE}`);
  console.log(`[fetch-medical] 응급의료 API: ${EMERGENCY_BASE}`);

  const { byRegion: pharmacies, failedRegions } = await collectPharmacies();
  const { byRegion: emergencyRooms, failed: emergencyFailed } = await collectEmergencyRooms();

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
    staleRegions: failedRegions,
    emergencyStale: emergencyFailed,
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
