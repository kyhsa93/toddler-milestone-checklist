import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { computeDose, DRUGS } = createRequire(import.meta.url)("../lib/dosing.js");

const dose = (over = {}) =>
  computeDose({ weight: 10, ageMonths: 24, drug: "acetaminophen", ...over });

test("몸무게가 없거나 이상하면 용량을 내지 않는다", () => {
  for (const weight of ["", null, undefined, 0, -3, "abc", NaN]) {
    assert.equal(dose({ weight }).state, "need-weight", `weight=${String(weight)}`);
  }
});

test("생년월일이 없으면 나이 게이트를 통과시키지 않고 멈춘다", () => {
  assert.equal(dose({ ageMonths: null }).state, "need-birthdate");
  assert.equal(dose({ ageMonths: NaN }).state, "need-birthdate");
});

test("생후 3개월 미만은 어떤 약도 용량을 보여주지 않는다", () => {
  for (const drug of ["acetaminophen", "ibuprofen"]) {
    for (const ageMonths of [0, 1, 2, 2.9]) {
      assert.equal(dose({ drug, ageMonths }).state, "blocked-under3mo", `${drug} ${ageMonths}mo`);
    }
  }
});

test("이부프로펜은 6개월 미만에서 막히고, 아세트아미노펜은 3개월부터 나온다", () => {
  assert.equal(dose({ drug: "ibuprofen", ageMonths: 5.9 }).state, "blocked-ibuprofen-under6mo");
  assert.equal(dose({ drug: "ibuprofen", ageMonths: 6 }).state, "ok");
  assert.equal(dose({ drug: "acetaminophen", ageMonths: 3 }).state, "ok");
});

test("경계값에서 게이트가 열리고 닫히는 지점이 정확하다", () => {
  assert.equal(dose({ ageMonths: 2.999 }).state, "blocked-under3mo");
  assert.equal(dose({ ageMonths: 3 }).state, "ok");
  assert.equal(dose({ drug: "ibuprofen", ageMonths: 5.999 }).state, "blocked-ibuprofen-under6mo");
  assert.equal(dose({ drug: "ibuprofen", ageMonths: 6 }).state, "ok");
});

test("아세트아미노펜 1회 용량은 10~15mg/kg", () => {
  const r = dose({ weight: 12, ageMonths: 24 });
  assert.equal(r.doseMin, 120);
  assert.equal(r.doseMax, 180);
  assert.equal(r.maxPerDay, DRUGS.acetaminophen.maxPerDay);
});

test("이부프로펜 1회 용량은 5~10mg/kg", () => {
  const r = dose({ weight: 12, ageMonths: 24, drug: "ibuprofen" });
  assert.equal(r.doseMin, 60);
  assert.equal(r.doseMax, 120);
});

test("아세트아미노펜 하루 한도는 24개월 전후로 60/75mg/kg", () => {
  assert.equal(dose({ weight: 10, ageMonths: 23.9 }).dailyCap, 600);
  assert.equal(dose({ weight: 10, ageMonths: 24 }).dailyCap, 750);
});

test("아세트아미노펜 하루 한도는 체중이 커도 4000mg을 넘지 않는다", () => {
  assert.equal(dose({ weight: 60, ageMonths: 36 }).dailyCap, 4000);
  assert.equal(dose({ weight: 50, ageMonths: 36 }).dailyCap, 3750);
});

test("이부프로펜 하루 한도는 1회 최대 × 하루 횟수", () => {
  const r = dose({ weight: 12, ageMonths: 24, drug: "ibuprofen" });
  assert.equal(r.dailyCap, r.doseMax * DRUGS.ibuprofen.maxPerDay);
});

test("모르는 약 이름으로는 용량이 나오지 않는다", () => {
  assert.notEqual(dose({ drug: "dexibuprofen" }).state, "ok");
});

test("결과에 mL 값은 절대 들어 있지 않다", () => {
  const r = dose({ weight: 12, ageMonths: 24 });
  assert.equal(Object.keys(r).some((k) => /ml/i.test(k)), false);
});
