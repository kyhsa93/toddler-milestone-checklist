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
- **Offline-capable**: installable as a home-screen app; works offline after the first visit via a service worker.
- Built with accessibility in mind — toggle states and tabs expose `aria-pressed` / `aria-selected` for screen readers.

## Disclaimer

This is **not a diagnostic tool**. It is not affiliated with, and does not reproduce, any clinical screening instrument (e.g. M-CHAT-R/F). The milestone items are drawn from the CDC's "Learn the Signs. Act Early." program (2022-revision checklists), cross-checked against the official checklist content rather than written from memory.

Developmental or medical conditions can only be assessed through standardized evaluation and clinical observation by a qualified pediatrician or developmental specialist. If you have concerns about your child's development, please talk to one — regardless of what this checklist shows.

The checklist intentionally starts at 12 months, since developmental signs relevant here are not clinically observable in newborns.

Growth percentiles are a reference calculation, not a diagnosis — official growth assessment should come from your pediatrician. WHO reference data was fetched directly from who.int (WHO copyright, but openly published for exactly this kind of reuse); CDC reference data was sourced via the CDC-DNPAO-maintained `cdcanthro` package, which mirrors CDC's own published percentile data files (US federal public domain).

## Usage

Open `index.html` in any browser, or visit the live app above. No build step, no server, no dependencies.

## Data

Everything (checklist responses, growth entries, child's birthdate and sex, language choice) is stored only in the browser's `localStorage`. Nothing is sent to a server or leaves the device. There is currently no export/backup option, so data does not survive clearing site data or switching devices.
