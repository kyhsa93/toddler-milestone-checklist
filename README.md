# toddler-milestone-checklist

A personal, installable PWA for tracking developmental milestones from 2 to 36 months, plus a simple height/weight growth log (which covers birth onward). Available in Korean and English (toggle in the top-right corner); UI defaults to English until a language is chosen, matching [kyhsa93.github.io](https://kyhsa93.github.io)'s language switcher.

Live app: https://kyhsa93.github.io/toddler-milestone-checklist/

The checklist covers four domains — social/emotional, language/communication, cognitive, and physical/motor — across all ten age bands CDC publishes for this range (2, 4, 6, 9, 12, 15, 18, 24, 30, 36 months). It's not autism-specific: this is CDC's own general developmental surveillance approach for spotting possible delay in any of the four domains, and the result breaks down "not yet" counts per domain for exactly that reason.

## Features

- **Age lock**: entering the child's birthdate automatically locks age bands they haven't reached yet, so the result isn't skewed by milestones they can't be expected to show. Age is computed from the birthdate on every visit, so it never goes stale.
- **Regression check**: a standalone question — has the child lost a skill they used to have? — independent of the age-band checklist, since CDC/AAP guidance treats regression as worth a pediatrician visit on its own, regardless of age or other results.
- **Print summary**: the result card has a button to print a clean summary — meant to be brought to a pediatrician visit, not just looked at once.
- **Share**: one footer button, defaults to sharing only the app's name, description, and URL. If you have a checked result, it asks first whether to include it — only appends it on an explicit "yes." It never reads growth entries, birthdate, or sex, so those can never leak into a share.
- **Growth log with percentiles**: a date/height/weight log with a trend chart, plus a height/weight percentile per entry (requires entering the child's birthdate and sex). Uses the WHO Child Growth Standards under 24 months and the CDC 2000 growth charts from 24 months on — the same switch point CDC itself recommends — computed via the standard LMS method with linear interpolation between reference grid points. Covers birth through 36 months; entries outside that range show "out of range" instead of a number rather than extrapolating. **Known gap**: the bundled WHO rows stop at whole month 23 and the CDC rows start at 24.5, so entries for a child between those ages get no percentile. That is a hole in the reference data this app ships rather than an age the standards leave out, so it is worded differently from a genuinely out-of-range age — closing it needs the WHO month-24 rows and the CDC month-24.0 rows added to `lib/growth.js`.
- **Symptom urgency check**: for 4 common symptom categories (fever, cough/breathing difficulty, vomiting/diarrhea/dehydration, rash), a short checklist of red-flag signs that outputs an urgency level — emergency now, see a doctor today, or monitor — never a disease name. Fever thresholds are age-aware (using the child's birthdate) since the single most important pediatric fever rule is age-based. Built from published red-flag criteria (WHO IMCI chart booklet, AAP/HealthyChildren.org, NHS "when to worry" guidance), not free-written. Answers here aren't saved anywhere — it's a momentary check, not a log.
- **Choking first aid reference**: age-split (under/over 12 months) step-by-step guidance, since infants and toddlers need different techniques. Sourced from the American Red Cross and AHA's 2025 guideline update; explicitly notes where Korea's official E-GEN guidance still shows the older method.
- **Fever reducer dose calculator**: a weight- and age-aware reference range (mg, not mL) for acetaminophen and ibuprofen, with hard safety gates — no dose is ever shown for an infant under 3 months (always directs to a doctor instead), and ibuprofen is blocked under 6 months. Deliberately never converts to mL, since that requires knowing your specific product's concentration; the tool tells you to check that on the label instead of guessing.
- **Play tips tied to the checklist**: each age band has a collapsible "play ideas" section with one activity per domain, drawn from the CDC's own published tips for that age (not invented) — so the checklist doubles as something to act on, not just observe.
- **Night & weekend pharmacy / ER finder**: pharmacies that actually stay open late (weekdays past 21:00), on Saturday evenings, Sundays, or public holidays — plus hospitals with an emergency room — searchable by region, with a "open right now" filter and optional nearest-first sorting. Pharmacies that only open during the day are deliberately excluded: they're everywhere, and listing them buries the ones you need at 9pm. Data comes from Korea's National Emergency Medical Center (E-Gen) open data, refreshed once a day by a GitHub Actions workflow — the API allows only 1,000 calls a day, so the app reads pre-built static JSON instead of calling it from the browser.
- **One entry per child**: a family with more than one child keeps a separate checklist, growth log, birthdate and sex for each, switched from a picker that only appears once a second child is added. Language and the pharmacy region are device settings and stay shared. An existing single-child install is migrated into the first profile on the first run, so nothing has to be re-entered.
- **Offline-capable**: installable as a home-screen app; works offline after the first visit via a service worker.
- Built with accessibility in mind — toggle states and tabs expose `aria-pressed` / `aria-selected` for screen readers.

## Disclaimer

This is **not a diagnostic tool**. It is not affiliated with, and does not reproduce, any clinical screening instrument (e.g. M-CHAT-R/F). The milestone items are drawn from the CDC's "Learn the Signs. Act Early." program (2022-revision checklists), cross-checked against the official checklist content rather than written from memory.

Developmental or medical conditions can only be assessed through standardized evaluation and clinical observation by a qualified pediatrician or developmental specialist. If you have concerns about your child's development, please talk to one — regardless of what this checklist shows.

The checklist intentionally starts at 12 months, since developmental signs relevant here are not clinically observable in newborns.

Growth percentiles are a reference calculation, not a diagnosis — official growth assessment should come from your pediatrician. WHO reference data was fetched directly from who.int (WHO copyright, but openly published for exactly this kind of reuse); CDC reference data was sourced via the CDC-DNPAO-maintained `cdcanthro` package, which mirrors CDC's own published percentile data files (US federal public domain).

The symptom urgency check **never diagnoses a disease** — it only estimates urgency (ER now / same-day doctor / monitor) from red-flag signs a parent can realistically self-assess. It covers 4 common categories, not every reason to seek care. If something worries you that isn't on the list, that alone is a reason to contact a doctor. Key thresholds used: fever ≥38.0°C in an infant under 3 months is always treated as an emergency regardless of other signs (AAP/HealthyChildren.org); breathing-rate red flags follow WHO IMCI's age bands (≥60/min under 2 months, ≥50/min at 2–12 months, ≥40/min at 12 months–5 years); a non-blanching rash with fever is flagged as an emergency (classic meningococcemia warning sign, per NHS guidance) regardless of how well the child otherwise seems.

The dose calculator is a reference range, not a prescription. Sources: AAP/HealthyChildren.org, FDA pediatric labeling, Korea's MFDS — cross-checked, and they agree closely. Acetaminophen: 10–15 mg/kg per dose, 4–6h apart, up to 5x/day, daily cap of 60 mg/kg (under 24 months) or 75 mg/kg (24 months+), hard-capped at 4000mg. Ibuprofen: 5–10 mg/kg per dose, 6–8h apart, up to 4x/day, not for infants under 6 months. Under 3 months, no dose is shown for either drug — the tool always directs to a doctor instead, since AAP guidance treats fever at that age as needing medical evaluation regardless of the number on a thermometer. Note that ibuprofen and dexibuprofen (e.g. Maxibufen, common in Korea) are different drugs with different dosing — this calculator's "ibuprofen" values don't apply to dexibuprofen products.

## Usage

Open `index.html` in any browser, or visit the live app above. No build step, no server, no dependencies.

### Tests

```
npm test
```

Runs on plain `node --test`, no dependencies. Three things are covered:

- `lib/growth.js` (growth percentiles) and `lib/dosing.js` (fever-reducer doses) are split out of `index.html` specifically so they can be run outside a browser. These are the two calculations whose output a parent might act on, and a wrong answer from either looks exactly like a right one — so the dose tests pin every safety gate (no dose under 3 months, no ibuprofen under 6 months, the 4000mg ceiling) and the growth tests pin the reference tables, the standard switch at 24 months, and the age range actually covered.
- `test/profiles.test.mjs` runs `index.html`'s own inline script against a stub DOM to check that per-child data really is stored per child. That failure mode isn't an error — it's one child's record showing up under another child's name, which looks entirely normal on screen.

`lib/*.js` are plain scripts (no build step, in keeping with the rest of the app) that attach one global each, and are also loadable by `require` so the tests can import them. Adding another one means adding it to `sw.js`'s precache list too, or it will work online and break offline.

## Data

Everything (checklist responses, growth entries, child's birthdate and sex, language choice) is stored only in the browser's `localStorage`. Per-child data is namespaced by profile (`dev-p<id>-…`); language and pharmacy region are not, since they describe the device rather than a child. Nothing is sent to a server or leaves the device. There is currently no export/backup option, so data does not survive clearing site data or switching devices. The symptom urgency check and dose calculator are exceptions — those answers are kept in memory only and are gone on reload, by design.

The pharmacy/ER finder is the one feature that reads a file from the network: `data/pharmacy/<region>.json` and `data/emergency/<region>.json`, built daily by `scripts/fetch-medical.mjs` and committed to this repo. Only the region you pick is downloaded. If you use "nearest first," your coordinates stay in the page — the sorting happens locally and the position is never sent anywhere.

### Refreshing the medical data

`.github/workflows/update-medical.yml` runs daily at 05:17 KST and needs four repository secrets:

| Secret | Value |
| --- | --- |
| `PHARMACY_API_KEY` | data.go.kr service key (Decoding) |
| `PHARMACY_API_ENDPOINT` | `https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService` |
| `EMERGENCY_API_KEY` | data.go.kr service key (Decoding) |
| `EMERGENCY_API_ENDPOINT` | `https://apis.data.go.kr/B552657/ErmctInfoInqireService` |

The endpoints stop at the service URL on purpose — the operation (`getParmacyListInfoInqire`, `getEgytListInfoInqire`) is appended in code, so adding another operation from the same service later doesn't mean editing secrets.

Run `node --test "test/*.test.mjs"` to exercise the collector against a stub server; it needs no API key.
