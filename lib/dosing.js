// Fever-reducer dose reference.
//
// Split out of index.html so it can be tested directly. Every branch here is a safety
// gate, and the failure mode of a wrong one is a dose given to a child — so the gates
// fail closed: unknown age shows no dose at all rather than a "probably fine" default,
// and the result is always a mg range, never mL (that conversion needs the specific
// product's concentration, which the app has no way to know).
//
// Sources: AAP/HealthyChildren.org, FDA pediatric labeling, Korea's MFDS — cross-checked.
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

  // Acetaminophen's daily ceiling is per-kg with an absolute cap; ibuprofen's comes
  // from its own per-dose maximum times the doses allowed in a day.
  const ACETAMINOPHEN_DAILY_MG_PER_KG_UNDER_24MO = 60;
  const ACETAMINOPHEN_DAILY_MG_PER_KG_FROM_24MO = 75;
  const ACETAMINOPHEN_DAILY_MG_ABSOLUTE_CAP = 4000;

  // Under this age, AAP treats fever as needing medical evaluation regardless of the
  // number on the thermometer, so no dose is shown for either drug.
  const NO_DOSE_UNDER_MONTHS = 3;

  /**
   * @param {{weight: number|string, ageMonths: number|null, drug: string}} input
   *   weight in kg, ageMonths as a float (null when the birthdate is unknown).
   * @returns {{state: string, ...}} state is one of need-weight, need-birthdate,
   *   blocked-under3mo, blocked-ibuprofen-under6mo, ok.
   */
  function computeDose({ weight, ageMonths, drug: drugName }) {
    const kg = parseFloat(weight);
    if (!Number.isFinite(kg) || kg <= 0) return { state: "need-weight" };

    // Checked before the age gates on purpose: without a birthdate there is no age to
    // gate on, and guessing one would defeat every gate below it.
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
