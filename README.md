# Faster broken-CSV reader

[![make.fun bounty](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/fariztelkom/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/fariztelkom/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

An entry for [Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121), a coding bounty on [make.fun](https://make.fun).

`solve.js` is a dependency-free ES module exporting `run(input)`, a fast drop-in for csv-reader 1.0.0. It reproduces the reference broken-row policy exactly — BOM at the start, LF/CRLF records, stray CRs, doubled quotes, junk after a closing quote, unterminated quotes, and short/long row padding or cutting — while scanning with `charCodeAt` and slicing whole fields instead of building them character by character.

`main.ts` is the program entry: it reads `/input/cases.json` (or `MAKEFUN_INPUT_DIR`), calls `run` on each case and writes `/output/answers.json` (or `MAKEFUN_OUTPUT_DIR`).

Licensed under MIT; see LICENSE.
