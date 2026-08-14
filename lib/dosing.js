(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ToddlerDosing = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const DRUGS = {
    acetaminophen: { mgPerKgMin: 10, mgPerKgMax: 15, interval: "4~6", maxPerDay: 5, minAgeMonths: 3 },
    ibuprofen: { mgPerKgMin: 5, mgPerKgMax: 10, interval: "6~8", maxPerDay: 4, minAgeMonths: 6 },
  };

  const ACETAMINOPHEN_DAILY_MG_PER_KG_UNDER_24MO = 60;
  const ACETAMINOPHEN_DAILY_MG_PER_KG_FROM_24MO = 75;
  const ACETAMINOPHEN_DAILY_MG_ABSOLUTE_CAP = 4000;

  const NO_DOSE_UNDER_MONTHS = 3;

  function computeDose({ weight, ageMonths, drug: drugName }) {
    const kg = parseFloat(weight);
    if (!Number.isFinite(kg) || kg <= 0) return { state: "need-weight" };

    if (ageMonths === null || !Number.isFinite(ageMonths)) return { state: "need-birthdate" };
    if (ageMonths < NO_DOSE_UNDER_MONTHS) return { state: "blocked-under3mo" };

    const drug = DRUGS[drugName];
    if (!drug) return { state: "need-weight" };
    if (drugName === "ibuprofen" && ageMonths < drug.minAgeMonths) {
      return { state: "blocked-ibuprofen-under6mo" };
    }

    const doseMin = Math.round(kg * drug.mgPerKgMin);
    const doseMax = Math.round(kg * drug.mgPerKgMax);
    let dailyCap;
    if (drugName === "acetaminophen") {
      const capPerKg =
        ageMonths < 24
          ? ACETAMINOPHEN_DAILY_MG_PER_KG_UNDER_24MO
          : ACETAMINOPHEN_DAILY_MG_PER_KG_FROM_24MO;
      dailyCap = Math.min(Math.round(kg * capPerKg), ACETAMINOPHEN_DAILY_MG_ABSOLUTE_CAP);
    } else {
      dailyCap = doseMax * drug.maxPerDay;
    }

    return { state: "ok", doseMin, doseMax, interval: drug.interval, maxPerDay: drug.maxPerDay, dailyCap };
  }

  return { DRUGS, computeDose };
});
