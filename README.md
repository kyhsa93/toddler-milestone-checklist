# toddler-milestone-checklist

A personal, installable PWA for tracking developmental milestones in toddlers aged 12–36 months, plus a simple height/weight growth log. Available in Korean and English (toggle in the top-right corner); UI defaults to English until a language is chosen, matching [kyhsa93.github.io](https://kyhsa93.github.io)'s language switcher.

Live app: https://kyhsa93.github.io/toddler-milestone-checklist/

The checklist covers four domains — social/emotional, language/communication, cognitive, and physical/motor — for four age bands (12, 18, 24, 36 months). It's not autism-specific: this is CDC's own general developmental surveillance approach for spotting possible delay in any of the four domains, and the result breaks down "not yet" counts per domain for exactly that reason.

## Features

- **Age lock**: entering the child's birthdate automatically locks age bands they haven't reached yet, so the result isn't skewed by milestones they can't be expected to show. Age is computed from the birthdate on every visit, so it never goes stale.
- **Regression check**: a standalone question — has the child lost a skill they used to have? — independent of the age-band checklist, since CDC/AAP guidance treats regression as worth a pediatrician visit on its own, regardless of age or other results.
- **Print summary**: the result card has a button to print a clean summary — meant to be brought to a pediatrician visit, not just looked at once.
- **Share**: one footer button, defaults to sharing only the app's name, description, and URL. If you have a checked result, it asks first whether to include it — only appends it on an explicit "yes." It never reads growth entries, birthdate, or sex, so those can never leak into a share.
- **Growth log with percentiles**: a date/height/weight log with a trend chart, plus a height/weight percentile per entry (requires entering the child's birthdate and sex). Uses the WHO Child Growth Standards under 24 months and the CDC 2000 growth charts from 24 months on — the same switch point CDC itself recommends — computed via the standard LMS method with linear interpolation between reference grid points. Only covers ages 12–36 months; entries outside that range show "out of range" instead of a number rather than extrapolating.
- **Symptom urgency check**: for 4 common symptom categories (fever, cough/breathing difficulty, vomiting/diarrhea/dehydration, rash), a short checklist of red-flag signs that outputs an urgency level — emergency now, see a doctor today, or monitor — never a disease name. Fever thresholds are age-aware (using the child's birthdate) since the single most important pediatric fever rule is age-based. Built from published red-flag criteria (WHO IMCI chart booklet, AAP/HealthyChildren.org, NHS "when to worry" guidance), not free-written. Answers here aren't saved anywhere — it's a momentary check, not a log.
- **Choking first aid reference**: age-split (under/over 12 months) step-by-step guidance, since infants and toddlers need different techniques. Sourced from the American Red Cross and AHA's 2025 guideline update; explicitly notes where Korea's official E-GEN guidance still shows the older method.
- **Fever reducer dose calculator**: a weight- and age-aware reference range (mg, not mL) for acetaminophen and ibuprofen, with hard safety gates — no dose is ever shown for an infant under 3 months (always directs to a doctor instead), and ibuprofen is blocked under 6 months. Deliberately never converts to mL, since that requires knowing your specific product's concentration; the tool tells you to check that on the label instead of guessing.
- **Play tips tied to the checklist**: each age band has a collapsible "play ideas" section with one activity per domain, drawn from the CDC's own published tips for that age (not invented) — so the checklist doubles as something to act on, not just observe.
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

## Data

Everything (checklist responses, growth entries, child's birthdate and sex, language choice) is stored only in the browser's `localStorage`. Nothing is sent to a server or leaves the device. There is currently no export/backup option, so data does not survive clearing site data or switching devices. The symptom urgency check and dose calculator are exceptions — those answers are kept in memory only and are gone on reload, by design.
