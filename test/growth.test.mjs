import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { GROWTH_REF, lookupLMS, normalCDF, calcPercentile, coverage, GAP_FROM, GAP_TO } =
  createRequire(import.meta.url)("../lib/growth.js");

test("기준 데이터가 온전히 실려 있다", () => {
  const expected = [
    "who-weight-boy",
    "who-weight-girl",
    "who-length-boy",
    "who-length-girl",
    "cdc-weight-boy",
    "cdc-weight-girl",
    "cdc-stature-boy",
    "cdc-stature-girl",
  ];
  assert.deepEqual(Object.keys(GROWTH_REF).sort(), expected.sort());

  for (const [key, rows] of Object.entries(GROWTH_REF)) {
    assert.ok(rows.length > 0, key);
    for (const r of rows) {
      // M(중앙값)과 S(변동계수)가 0 이하면 z 계산이 통째로 무너진다.
      assert.ok(Number.isFinite(r.L) && Number.isFinite(r.M) && Number.isFinite(r.S), `${key} ${r.months}`);
      assert.ok(r.M > 0 && r.S > 0, `${key} ${r.months}`);
    }
    // 보간은 정렬을 전제한다.
    const months = rows.map((r) => r.months);
    assert.deepEqual(months, [...months].sort((a, b) => a - b), key);
    assert.equal(new Set(months).size, months.length, `${key} 중복 나이`);
  }
});

test("WHO는 24개월 미만, CDC는 24개월 이상을 담당한다", () => {
  for (const sex of ["boy", "girl"]) {
    assert.equal(GROWTH_REF[`who-weight-${sex}`][0].months, 0);
    assert.ok(GROWTH_REF[`who-weight-${sex}`].at(-1).months < 24);
    assert.ok(GROWTH_REF[`cdc-weight-${sex}`][0].months >= 24);
  }
});

test("24개월을 기준으로 참조하는 표가 바뀐다", () => {
  // 두 기준은 측정 방법부터 다르다(WHO 누운 키 vs CDC 선 키). 섞어 쓰면 안 된다.
  const under = lookupLMS(20, "height", "boy");
  const over = lookupLMS(30, "height", "boy");
  assert.ok(under && over);
  assert.notEqual(under.M, over.M);
  // 같은 나이를 두 measureKind로 물어도 몸무게는 몸무게 표에서만 나온다.
  assert.notEqual(lookupLMS(12, "weight", "boy").M, lookupLMS(12, "height", "boy").M);
});

test("중앙값을 넣으면 50 백분위가 나온다", () => {
  for (const [months, kind, sex] of [
    [0, "weight", "boy"],
    [12, "weight", "girl"],
    [6, "height", "boy"],
    [30, "weight", "boy"],
    [36, "height", "girl"],
  ]) {
    const { M } = lookupLMS(months, kind, sex);
    const { percentile } = calcPercentile(M, months, kind, sex);
    assert.ok(Math.abs(percentile - 50) < 0.01, `${months}mo ${kind} ${sex}: ${percentile}`);
  }
});

test("WHO -2SD 값은 z가 -2 근처로 나온다", () => {
  // WHO 남아 체중 12개월 -2SD = 7.7kg(공표값, 소수 첫째자리 반올림).
  const { z } = calcPercentile(7.7, 12, "weight", "boy");
  assert.ok(Math.abs(z + 2) < 0.1, `z=${z}`);
});

test("값이 커질수록 백분위도 커진다", () => {
  let prev = -Infinity;
  for (const w of [6, 7, 8, 9, 9.6, 10, 11, 12, 14]) {
    const { percentile } = calcPercentile(w, 12, "weight", "boy");
    assert.ok(percentile > prev, `${w}kg에서 역전: ${percentile} <= ${prev}`);
    prev = percentile;
  }
});

test("중앙값 아래는 50 미만, 위는 50 초과 (z 부호가 뒤집히지 않는다)", () => {
  const { M } = lookupLMS(18, "weight", "girl");
  assert.ok(calcPercentile(M * 0.8, 18, "weight", "girl").percentile < 50);
  assert.ok(calcPercentile(M * 1.2, 18, "weight", "girl").percentile > 50);
  assert.ok(calcPercentile(M * 0.8, 18, "weight", "girl").z < 0);
});

test("격자 사이 나이는 양 끝 사이로 보간된다", () => {
  const lo = lookupLMS(6, "weight", "boy");
  const hi = lookupLMS(7, "weight", "boy");
  const mid = lookupLMS(6.5, "weight", "boy");
  assert.ok(mid.M > lo.M && mid.M < hi.M);
  // 선형 보간이므로 정확히 중간이어야 한다.
  assert.ok(Math.abs(mid.M - (lo.M + hi.M) / 2) < 1e-9);
});

test("정규분포 누적함수가 알려진 값과 맞는다", () => {
  assert.ok(Math.abs(normalCDF(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCDF(1.959964) - 0.975) < 1e-4);
  assert.ok(Math.abs(normalCDF(-1.644854) - 0.05) < 1e-4);
  assert.ok(Math.abs(normalCDF(-2) - 0.02275) < 1e-4);
  // 좌우 대칭.
  for (const z of [0.3, 1, 2.5, 4]) {
    assert.ok(Math.abs(normalCDF(z) + normalCDF(-z) - 1) < 1e-6, `z=${z}`);
  }
});

test("성별이나 값이 없으면 계산하지 않는다", () => {
  assert.equal(calcPercentile(10, 12, "weight", null), null);
  assert.equal(calcPercentile(10, 12, "weight", ""), null);
  assert.equal(calcPercentile(0, 12, "weight", "boy"), null);
  assert.equal(calcPercentile(-5, 12, "weight", "boy"), null);
  assert.equal(calcPercentile(NaN, 12, "weight", "boy"), null);
});

test("지원 범위 밖 나이는 추정하지 않고 null을 낸다", () => {
  // 범위 밖에서 외삽하면 근거 없는 백분위가 나온다. 그냥 계산하지 않는 게 맞다.
  assert.equal(calcPercentile(10, -1, "weight", "boy"), null);
  assert.equal(calcPercentile(20, 37, "weight", "boy"), null);
  assert.equal(calcPercentile(20, 100, "weight", "boy"), null);
});

test("만 2세 전후의 빈 구간은 '범위 밖'이 아니라 '표 사이 구간'으로 구분된다", () => {
  // 23~24.5개월은 WHO 표가 끝나고 CDC 표가 시작되기 전이다. 실려 있는 데이터의
  // 빈틈이지 0~36개월을 벗어난 나이가 아니라서, UI 문구가 갈려야 한다.
  for (const age of [23.1, 23.5, 24, 24.4]) {
    assert.equal(calcPercentile(12, age, "weight", "boy"), null, `${age}mo`);
    assert.equal(coverage(age), "gap", `${age}mo`);
  }
  assert.equal(coverage(GAP_FROM), "covered");
  assert.equal(coverage(GAP_TO), "covered");
  assert.equal(coverage(-1), "out-of-range");
  assert.equal(coverage(40), "out-of-range");
});

test("빈 구간 말고는 0~36개월 전체에서 값이 나온다", () => {
  const missing = [];
  for (let tenths = 0; tenths <= 360; tenths += 1) {
    const age = tenths / 10;
    if (coverage(age) !== "covered") continue;
    for (const [kind, value] of [["weight", 10], ["height", 80]]) {
      if (!calcPercentile(value, age, kind, "boy")) missing.push(`${age}mo ${kind}`);
    }
  }
  assert.deepEqual(missing, []);
});
