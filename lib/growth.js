(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ToddlerGrowth = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const GROWTH_REF_CSV = `who,weight,boy,0,0.34870,3.3464,0.14602
who,weight,boy,1,0.22970,4.4709,0.13395
who,weight,boy,2,0.19700,5.5675,0.12385
who,weight,boy,3,0.17380,6.3762,0.11727
who,weight,boy,4,0.15530,7.0023,0.11316
who,weight,boy,5,0.13950,7.5105,0.11080
who,weight,boy,6,0.12570,7.9340,0.10958
who,weight,boy,7,0.11340,8.2970,0.10902
who,weight,boy,8,0.10210,8.6151,0.10882
who,weight,boy,9,0.09170,8.9014,0.10881
who,weight,boy,10,0.08200,9.1649,0.10891
who,weight,boy,11,0.07300,9.4122,0.10906
who,weight,girl,0,0.38090,3.2322,0.14171
who,weight,girl,1,0.17140,4.1873,0.13724
who,weight,girl,2,0.09620,5.1282,0.13000
who,weight,girl,3,0.04020,5.8458,0.12619
who,weight,girl,4,-0.00500,6.4237,0.12402
who,weight,girl,5,-0.04300,6.8985,0.12274
who,weight,girl,6,-0.07560,7.2970,0.12204
who,weight,girl,7,-0.10390,7.6422,0.12178
who,weight,girl,8,-0.12880,7.9487,0.12181
who,weight,girl,9,-0.15070,8.2254,0.12199
who,weight,girl,10,-0.17000,8.4800,0.12223
who,weight,girl,11,-0.18720,8.7192,0.12247
who,length,boy,0,1.00000,49.8842,0.03795
who,length,boy,1,1.00000,54.7244,0.03557
who,length,boy,2,1.00000,58.4249,0.03424
who,length,boy,3,1.00000,61.4292,0.03328
who,length,boy,4,1.00000,63.8860,0.03257
who,length,boy,5,1.00000,65.9026,0.03204
who,length,boy,6,1.00000,67.6236,0.03165
who,length,boy,7,1.00000,69.1645,0.03139
who,length,boy,8,1.00000,70.5994,0.03124
who,length,boy,9,1.00000,71.9687,0.03117
who,length,boy,10,1.00000,73.2812,0.03118
who,length,boy,11,1.00000,74.5388,0.03125
who,length,girl,0,1.00000,49.1477,0.03790
who,length,girl,1,1.00000,53.6872,0.03640
who,length,girl,2,1.00000,57.0673,0.03568
who,length,girl,3,1.00000,59.8029,0.03520
who,length,girl,4,1.00000,62.0899,0.03486
who,length,girl,5,1.00000,64.0301,0.03463
who,length,girl,6,1.00000,65.7311,0.03448
who,length,girl,7,1.00000,67.2873,0.03441
who,length,girl,8,1.00000,68.7498,0.03440
who,length,girl,9,1.00000,70.1435,0.03444
who,length,girl,10,1.00000,71.4818,0.03452
who,length,girl,11,1.00000,72.7710,0.03464
who,weight,boy,12,0.06450,9.6460,0.10925
who,weight,boy,13,0.05630,9.8772,0.10949
who,weight,boy,14,0.04870,10.0944,0.10976
who,weight,boy,15,0.04120,10.3139,0.11008
who,weight,boy,16,0.03430,10.5228,0.11041
who,weight,boy,17,0.02760,10.7289,0.11078
who,weight,boy,18,0.02100,10.9393,0.11120
who,weight,boy,19,0.01490,11.1409,0.11163
who,weight,boy,20,0.00870,11.3478,0.11212
who,weight,boy,21,0.00290,11.5474,0.11261
who,weight,boy,22,-0.00290,11.7528,0.11315
who,weight,boy,23,-0.00830,11.9510,0.11369
who,weight,girl,12,-0.20220,8.9462,0.12267
who,weight,girl,13,-0.21600,9.1722,0.12283
who,weight,girl,14,-0.22770,9.3861,0.12294
who,weight,girl,15,-0.23850,9.6038,0.12299
who,weight,girl,16,-0.24780,9.8124,0.12303
who,weight,girl,17,-0.25610,10.0196,0.12305
who,weight,girl,18,-0.26370,10.2324,0.12309
who,weight,girl,19,-0.27020,10.4372,0.12315
who,weight,girl,20,-0.27630,10.6481,0.12324
who,weight,girl,21,-0.28140,10.8521,0.12335
who,weight,girl,22,-0.28620,11.0633,0.12351
who,weight,girl,23,-0.29030,11.2684,0.12369
who,length,boy,12,1.00000,75.7391,0.03137
who,length,boy,13,1.00000,76.9304,0.03154
who,length,boy,14,1.00000,78.0451,0.03174
who,length,boy,15,1.00000,79.1613,0.03197
who,length,boy,16,1.00000,80.2113,0.03222
who,length,boy,17,1.00000,81.2340,0.03249
who,length,boy,18,1.00000,82.2628,0.03279
who,length,boy,19,1.00000,83.2318,0.03310
who,length,boy,20,1.00000,84.2074,0.03342
who,length,boy,21,1.00000,85.1291,0.03375
who,length,boy,22,1.00000,86.0589,0.03410
who,length,boy,23,1.00000,86.9392,0.03445
who,length,girl,12,1.00000,74.0049,0.03479
who,length,girl,13,1.00000,75.2297,0.03496
who,length,girl,14,1.00000,76.3770,0.03514
who,length,girl,15,1.00000,77.5258,0.03534
who,length,girl,16,1.00000,78.6055,0.03555
who,length,girl,17,1.00000,79.6559,0.03576
who,length,girl,18,1.00000,80.7121,0.03598
who,length,girl,19,1.00000,81.7080,0.03620
who,length,girl,20,1.00000,82.7116,0.03643
who,length,girl,21,1.00000,83.6595,0.03665
who,length,girl,22,1.00000,84.6154,0.03689
who,length,girl,23,1.00000,85.5184,0.03711
cdc,weight,boy,24.5,-0.216501,12.741544,0.108166
cdc,stature,boy,24.5,1.007208,86.861609,0.040396
cdc,weight,girl,24.5,-0.752207,12.134555,0.107740
cdc,stature,girl,24.5,1.051273,85.397317,0.040860
cdc,weight,boy,25.5,-0.239790,12.881023,0.108275
cdc,stature,boy,25.5,0.837251,87.652473,0.040578
cdc,weight,girl,25.5,-0.784234,12.291025,0.108477
cdc,stature,girl,25.5,1.041951,86.290263,0.041142
cdc,weight,boy,26.5,-0.266316,13.018424,0.108421
cdc,stature,boy,26.5,0.681493,88.423264,0.040723
cdc,weight,girl,26.5,-0.814096,12.444693,0.109281
cdc,stature,girl,26.5,1.012592,87.157142,0.041349
cdc,weight,boy,27.5,-0.295755,13.154497,0.108605
cdc,stature,boy,27.5,0.538780,89.175492,0.040833
cdc,weight,girl,27.5,-0.841936,12.596223,0.110144
cdc,stature,girl,27.5,0.970542,87.996018,0.041500
cdc,weight,boy,28.5,-0.327729,13.289897,0.108826
cdc,stature,boy,28.5,0.407697,89.910409,0.040909
cdc,weight,girl,28.5,-0.867889,12.746209,0.111061
cdc,stature,girl,28.5,0.921130,88.805511,0.041611
cdc,weight,boy,29.5,-0.361817,13.425194,0.109083
cdc,stature,boy,29.5,0.286762,90.629078,0.040952
cdc,weight,girl,29.5,-0.892103,12.895172,0.112023
cdc,stature,girl,29.5,0.868221,89.584767,0.041692
cdc,weight,boy,30.5,-0.397568,13.560881,0.109378
cdc,stature,boy,30.5,0.174489,91.332424,0.040965
cdc,weight,girl,30.5,-0.914719,13.043572,0.113023
cdc,stature,girl,30.5,0.814544,90.333417,0.041754
cdc,weight,boy,31.5,-0.434520,13.697379,0.109708
cdc,stature,boy,31.5,0.069445,92.021272,0.040950
cdc,weight,girl,31.5,-0.935877,13.191809,0.114056
cdc,stature,girl,31.5,0.761958,91.051544,0.041804
cdc,weight,boy,32.5,-0.472189,13.835046,0.110073
cdc,stature,boy,32.5,-0.029721,92.696379,0.040909
cdc,weight,girl,32.5,-0.955723,13.340229,0.115115
cdc,stature,girl,32.5,0.711660,91.739635,0.041847
cdc,weight,boy,33.5,-0.510117,13.974183,0.110473
cdc,stature,boy,33.5,-0.124252,93.358465,0.040844
cdc,weight,girl,33.5,-0.974383,13.489133,0.116193
cdc,stature,girl,33.5,0.664323,92.398544,0.041888
cdc,weight,boy,34.5,-0.547886,14.115032,0.110907
cdc,stature,boy,34.5,-0.215288,94.008229,0.040758
cdc,weight,girl,34.5,-0.991981,13.638774,0.117286
cdc,stature,girl,34.5,0.620285,93.029454,0.041929
cdc,weight,boy,35.5,-0.585070,14.257796,0.111375
cdc,stature,boy,35.5,-0.303854,94.646370,0.040654
cdc,weight,girl,35.5,-1.008641,13.789365,0.118387
cdc,stature,girl,35.5,0.579556,93.633823,0.041972
cdc,weight,boy,36.5,-0.621320,14.402627,0.111875
cdc,stature,boy,36.5,-0.390918,95.273591,0.040534
cdc,weight,girl,36.5,-1.024471,13.941083,0.119492
cdc,stature,girl,36.5,0.541981,94.213357,0.042018`;

  const GROWTH_REF = {};
  GROWTH_REF_CSV.trim().split("\n").forEach((line) => {
    const [standard, measure, sex, months, L, M, S] = line.split(",");
    const key = standard + "-" + measure + "-" + sex;
    if (!GROWTH_REF[key]) GROWTH_REF[key] = [];
    GROWTH_REF[key].push({ months: parseFloat(months), L: parseFloat(L), M: parseFloat(M), S: parseFloat(S) });
  });
  Object.values(GROWTH_REF).forEach((rows) => rows.sort((a, b) => a.months - b.months));

  function lookupLMS(ageMonths, measureKind, sex) {
    const standard = ageMonths < 24 ? "who" : "cdc";
    const measure = measureKind === "height" ? (standard === "who" ? "length" : "stature") : "weight";
    const rows = GROWTH_REF[standard + "-" + measure + "-" + sex];
    if (!rows || rows.length === 0) return null;
    if (ageMonths < rows[0].months || ageMonths > rows[rows.length - 1].months) return null;

    let lo = rows[0], hi = rows[rows.length - 1];
    for (let i = 0; i < rows.length - 1; i++) {
      if (ageMonths >= rows[i].months && ageMonths <= rows[i + 1].months) {
        lo = rows[i];
        hi = rows[i + 1];
        break;
      }
    }
    if (lo === hi || hi.months === lo.months) return lo;
    const frac = (ageMonths - lo.months) / (hi.months - lo.months);
    return {
      L: lo.L + (hi.L - lo.L) * frac,
      M: lo.M + (hi.M - lo.M) * frac,
      S: lo.S + (hi.S - lo.S) * frac,
    };
  }

  function normalCDF(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) p = 1 - p;
    return p;
  }

  function calcPercentile(value, ageMonths, measureKind, sex) {
    if (!Number.isFinite(value) || value <= 0 || !sex) return null;
    const lms = lookupLMS(ageMonths, measureKind, sex);
    if (!lms) return null;
    const { L, M, S } = lms;
    const z = Math.abs(L) < 1e-9 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
    return { z, percentile: normalCDF(z) * 100 };
  }

  const SUPPORTED_FROM = 0;
  const SUPPORTED_TO = 36.5;
  const GAP_FROM = 23;
  const GAP_TO = 24.5;

  function coverage(ageMonths) {
    if (!Number.isFinite(ageMonths)) return "out-of-range";
    if (ageMonths < SUPPORTED_FROM || ageMonths > SUPPORTED_TO) return "out-of-range";
    if (ageMonths > GAP_FROM && ageMonths < GAP_TO) return "gap";
    return "covered";
  }

  return {
    GROWTH_REF,
    lookupLMS,
    normalCDF,
    calcPercentile,
    coverage,
    SUPPORTED_FROM,
    SUPPORTED_TO,
    GAP_FROM,
    GAP_TO,
  };
});
