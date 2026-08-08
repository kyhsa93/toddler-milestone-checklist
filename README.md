# toddler-milestone-checklist

A personal, installable PWA for tracking developmental milestones in toddlers aged 12–36 months, plus a simple height/weight growth log. Available in Korean and English (toggle in the top-right corner); UI defaults to English until a language is chosen, matching [kyhsa93.github.io](https://kyhsa93.github.io)'s language switcher.

Live app: https://kyhsa93.github.io/toddler-milestone-checklist/

The checklist covers four domains — social/emotional, language/communication, cognitive, and physical/motor — for four age bands (12, 18, 24, 36 months).

## Features

- **Age lock**: entering the child's current age (in months) automatically locks age bands they haven't reached yet, so the result isn't skewed by milestones they can't be expected to show.
- **Print / share summary**: the result card has buttons to print a clean summary or share/copy it as text — meant to be brought to a pediatrician visit, not just looked at once.
- **Growth log**: a simple date/height/weight log with a small trend chart. No percentile calculation.
- **Offline-capable**: installable as a home-screen app; works offline after the first visit via a service worker.
- Built with accessibility in mind — toggle states and tabs expose `aria-pressed` / `aria-selected` for screen readers.

## Disclaimer

This is **not a diagnostic tool**. It is not affiliated with, and does not reproduce, any clinical screening instrument (e.g. M-CHAT-R/F). The milestone items are drawn from the CDC's "Learn the Signs. Act Early." program (2022-revision checklists), cross-checked against the official checklist content rather than written from memory.

Developmental or medical conditions can only be assessed through standardized evaluation and clinical observation by a qualified pediatrician or developmental specialist. If you have concerns about your child's development, please talk to one — regardless of what this checklist shows.

The checklist intentionally starts at 12 months, since developmental signs relevant here are not clinically observable in newborns.

The growth log does not compute percentiles — it's a plain personal record of height/weight over time. Ask your pediatrician for official growth-chart percentiles at checkups.

## Usage

Open `index.html` in any browser, or visit the live app above. No build step, no server, no dependencies.

## Data

Everything (checklist responses, growth entries, child's age, language choice) is stored only in the browser's `localStorage`. Nothing is sent to a server or leaves the device. There is currently no export/backup option, so data does not survive clearing site data or switching devices.
