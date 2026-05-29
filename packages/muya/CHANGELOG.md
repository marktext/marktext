# Changelog

# [0.2.0](https://github.com/marktext/muya/compare/v0.1.0...v0.2.0) (2026-05-20)


### Bug Fixes

* backport marktext muya editor/cursor/IME fixes (PR-3) ([#211](https://github.com/marktext/muya/issues/211)) ([0f4e45b](https://github.com/marktext/muya/commit/0f4e45be8964d32a2ed9173d3622aa58831e0450)), closes [#2960](https://github.com/marktext/muya/issues/2960) [#2331](https://github.com/marktext/muya/issues/2331) [#2816](https://github.com/marktext/muya/issues/2816) [#2842](https://github.com/marktext/muya/issues/2842) [#2330](https://github.com/marktext/muya/issues/2330) [#2331](https://github.com/marktext/muya/issues/2331) [#2331](https://github.com/marktext/muya/issues/2331) [#2330](https://github.com/marktext/muya/issues/2330)
* backport marktext muya P0 crashes (PR-1a) ([#208](https://github.com/marktext/muya/issues/208)) ([b6a62dd](https://github.com/marktext/muya/commit/b6a62dd2845444a241394d14f8d1d67b6cb31352)), closes [#4222](https://github.com/marktext/muya/issues/4222) [#4190](https://github.com/marktext/muya/issues/4190) [#3001](https://github.com/marktext/muya/issues/3001) [#3010](https://github.com/marktext/muya/issues/3010)
* backport marktext muya XSS protections (PR-1b) ([#209](https://github.com/marktext/muya/issues/209)) ([883f8be](https://github.com/marktext/muya/commit/883f8be2d864ee4a65a46b211e2c2cb1a30be459))
* cleanup PR-7a — list/paragraph/clipboard 4-pack (verified-not-applicable + defensive tests) ([#215](https://github.com/marktext/muya/issues/215)) ([6163dfb](https://github.com/marktext/muya/commit/6163dfb0857d40f4ca337cc01cc7d9cee39de26a)), closes [#908](https://github.com/marktext/muya/issues/908) [#1025](https://github.com/marktext/muya/issues/1025) [#2375](https://github.com/marktext/muya/issues/2375)
* cleanup PR-7b — nested block boundaries 4-pack (1 fix + 3 verified-not-applicable) ([#216](https://github.com/marktext/muya/issues/216)) ([03109fe](https://github.com/marktext/muya/commit/03109fee082f0856b82eee4acc8e68a800a2b01f)), closes [#908](https://github.com/marktext/muya/issues/908) [#1025](https://github.com/marktext/muya/issues/1025) [#2375](https://github.com/marktext/muya/issues/2375) [#1153](https://github.com/marktext/muya/issues/1153) [#812](https://github.com/marktext/muya/issues/812) [#572](https://github.com/marktext/muya/issues/572)
* **clipboard:** keep heading intact when pasting multi-line text into it ([68dc9e9](https://github.com/marktext/muya/commit/68dc9e9e734708ffe70867ad39faf1649f806afa)), closes [#671](https://github.com/marktext/muya/issues/671)
* **clipboard:** promote text-only <table> blob to the HTML paste path ([00da011](https://github.com/marktext/muya/commit/00da0119273dc9b02b1bcb18d0b3f1d5c2c96db3)), closes [#1271](https://github.com/marktext/muya/issues/1271)
* **clipboard:** skip clipboard writes when there is nothing to copy ([b564bb7](https://github.com/marktext/muya/commit/b564bb7f70d68130162d30c97a0b9b7b16a7d613)), closes [#3130](https://github.com/marktext/muya/issues/3130)
* EventCenter listener leak + once-listener iteration mutation (PR-17) ([#230](https://github.com/marktext/muya/issues/230)) ([39852a6](https://github.com/marktext/muya/commit/39852a6f0723ba84b61315aa6abee1fb6aa4c1ef))
* parser CommonMark/GFM correctness + regression baseline (PR-2a) ([#212](https://github.com/marktext/muya/issues/212)) ([55e2c74](https://github.com/marktext/muya/commit/55e2c7453e83a27127bd4fc0066dfa366dd9cafb)), closes [#2840](https://github.com/marktext/muya/issues/2840) [#1733](https://github.com/marktext/muya/issues/1733) [#917](https://github.com/marktext/muya/issues/917) [#870](https://github.com/marktext/muya/issues/870) [#964](https://github.com/marktext/muya/issues/964) [#870](https://github.com/marktext/muya/issues/870) [#832](https://github.com/marktext/muya/issues/832) [#803](https://github.com/marktext/muya/issues/803) [#921](https://github.com/marktext/muya/issues/921) [#947](https://github.com/marktext/muya/issues/947) [#1531](https://github.com/marktext/muya/issues/1531) [#1421](https://github.com/marktext/muya/issues/1421) [#947](https://github.com/marktext/muya/issues/947) [#921](https://github.com/marktext/muya/issues/921) [#1531](https://github.com/marktext/muya/issues/1531) [#741](https://github.com/marktext/muya/issues/741)
* **paste:** parse <title> from HTML response body, not as JSON ([314c5e2](https://github.com/marktext/muya/commit/314c5e21a75345b7333a6f32b6db87a695e9697f)), closes [#1344](https://github.com/marktext/muya/issues/1344)
* reference link/image markdown loading + roundtrip (PR-16) ([#229](https://github.com/marktext/muya/issues/229)) ([3802ab3](https://github.com/marktext/muya/commit/3802ab34a20cf3e0ec3292d7434ffe47c8cc64e7))
* stateToMarkdown serialization baseline (PR-2b) ([#213](https://github.com/marktext/muya/issues/213)) ([20e536e](https://github.com/marktext/muya/commit/20e536e4d3c71115a0acf5e61ad36e861ece9956)), closes [#2840](https://github.com/marktext/muya/issues/2840) [#1733](https://github.com/marktext/muya/issues/1733) [#917](https://github.com/marktext/muya/issues/917) [#870](https://github.com/marktext/muya/issues/870) [#964](https://github.com/marktext/muya/issues/964) [#870](https://github.com/marktext/muya/issues/870) [#832](https://github.com/marktext/muya/issues/832) [#803](https://github.com/marktext/muya/issues/803) [#921](https://github.com/marktext/muya/issues/921) [#947](https://github.com/marktext/muya/issues/947) [#1531](https://github.com/marktext/muya/issues/1531) [#1421](https://github.com/marktext/muya/issues/1421) [#947](https://github.com/marktext/muya/issues/947) [#921](https://github.com/marktext/muya/issues/921) [#1531](https://github.com/marktext/muya/issues/1531) [#741](https://github.com/marktext/muya/issues/741) [#916](https://github.com/marktext/muya/issues/916) [#840](https://github.com/marktext/muya/issues/840) [#916](https://github.com/marktext/muya/issues/916) [#840](https://github.com/marktext/muya/issues/840)


### Features

* code block line numbers (PR-5a) + P3 verified-not-applicable cleanup ([#219](https://github.com/marktext/muya/issues/219)) ([e2ca1db](https://github.com/marktext/muya/commit/e2ca1dbd812fb7b9b657f9fd295920a0fa449804)), closes [#3](https://github.com/marktext/muya/issues/3)
* CommonMark/GFM spec conformance infrastructure (PR-6a) ([#218](https://github.com/marktext/muya/issues/218)) ([4d77c05](https://github.com/marktext/muya/commit/4d77c05434b3d740e2392b77cdea4e200bb3c06b))
* focus/blur events + format cursor jump-to-end (PR-10) ([#225](https://github.com/marktext/muya/issues/225)) ([0b3ace5](https://github.com/marktext/muya/commit/0b3ace59f7a4f984fdeda2671892eb12c4134f69))
* footnote complete — block class + UI tool + click wiring + HTML backref (PR-8) ([#221](https://github.com/marktext/muya/issues/221)) ([a545c4f](https://github.com/marktext/muya/commit/a545c4fb996d266093db23e579906ff0022756b9)), closes [#1](https://github.com/marktext/muya/issues/1)
* image small-image class + inline resize-bar suppression (PR-11a) ([#224](https://github.com/marktext/muya/issues/224)) ([d553a74](https://github.com/marktext/muya/commit/d553a7483090ef064e4a09442d87386181451ed9))
* linkTools dispatch for <a>, reference link, markdown link (PR-11b) ([#226](https://github.com/marktext/muya/issues/226)) ([f383565](https://github.com/marktext/muya/commit/f3835658affd7971367bc443686f479db9e02c2e)), closes [#1415](https://github.com/marktext/muya/issues/1415)
* muya.getTOC() public API (PR-15) ([#228](https://github.com/marktext/muya/issues/228)) ([5e15e15](https://github.com/marktext/muya/commit/5e15e1576c2e77702bd70c9273705b6e102569d8))

# [0.2.0] (2026-05-21)

The marktext-muya backport batch. 22 PRs (#208–#230) brought the upstream marktext muya tree onto `@muyajs/core` end-to-end, with full test coverage on every change.

### Features

* footnote complete — block class + UI tool + click wiring + HTML backref ([#221](https://github.com/marktext/muya/pull/221))
* reference link/image — markdown loading + round-trip + image domsrc ([#229](https://github.com/marktext/muya/pull/229))
* `LinkTools` dispatch for `<a>`, reference link, markdown link ([#226](https://github.com/marktext/muya/pull/226))
* `muya.getTOC()` public API ([#228](https://github.com/marktext/muya/pull/228))
* `focus` / `blur` events + format cursor jump-to-end after applying bold/italic/etc. ([#225](https://github.com/marktext/muya/pull/225))
* code block line numbers (`codeBlockLineNumbers` editor option) ([#219](https://github.com/marktext/muya/pull/219))
* image small-image class + inline resize-bar suppression ([#224](https://github.com/marktext/muya/pull/224))
* CommonMark 0.31 + GFM 0.29-gfm spec conformance infrastructure ([#218](https://github.com/marktext/muya/pull/218))
* backport marktext muya parser test suites ([#220](https://github.com/marktext/muya/pull/220))

### Bug Fixes

* P0 crashes — `normalizeTable` row count, `loadImageAsync` failed cache ([#208](https://github.com/marktext/muya/pull/208))
* XSS protections — `langInputContent`, hyperlinks, Mermaid, code block ([#209](https://github.com/marktext/muya/pull/209))
* parser CommonMark/GFM correctness + regression baseline ([#212](https://github.com/marktext/muya/pull/212))
* `stateToMarkdown` serialization baseline ([#213](https://github.com/marktext/muya/pull/213))
* defensive inline regressions for bold+code, parens-in-dest ([#214](https://github.com/marktext/muya/pull/214))
* backport marktext muya editor/cursor/IME/autopair/table fixes ([#211](https://github.com/marktext/muya/pull/211))
* clipboard / paste / copy correctness ([#210](https://github.com/marktext/muya/pull/210), [#215](https://github.com/marktext/muya/pull/215), [#216](https://github.com/marktext/muya/pull/216), [#217](https://github.com/marktext/muya/pull/217))
* `EventCenter` listener leak + once-listener iteration mutation ([#230](https://github.com/marktext/muya/pull/230))

### Internal

* test coverage 1 → 386 tests (43 files)
* conformance baseline locked at CommonMark 87.7% / GFM 86.3%; regression-gated by `expected-failures.json`
* residuals cleanup — XSS assessment + post-refactor split + skipped tags ([#223](https://github.com/marktext/muya/pull/223), [#227](https://github.com/marktext/muya/pull/227))

# [0.1.0](https://github.com/marktext/muya/compare/v0.0.39...v0.1.0) (2026-05-20)


### Bug Fixes

* avoid shared Marked state leaking across renderHtml calls ([#202](https://github.com/marktext/muya/issues/202)) ([a1caa67](https://github.com/marktext/muya/commit/a1caa6782d9f8d7d5c5232528641852a9fe34925))
* **build:** restore lib/types output after vite-plugin-dts v5 upgrade ([6da5a21](https://github.com/marktext/muya/commit/6da5a21641f337f427c36dce6255ccd6622e6306))

## [0.0.39](https://github.com/marktext/muya/compare/v0.0.38...v0.0.39) (2025-11-17)


### Bug Fixes

* ResizeObserver loop completed with undelivered notifications. ([58e4789](https://github.com/marktext/muya/commit/58e4789becbb0edda79d96fd483340dd58faaa82))

## [0.0.38](https://github.com/marktext/muya/compare/v0.0.37...v0.0.38) (2025-11-17)


### Bug Fixes

* hide inline format toolbar when necessary ([c515b7f](https://github.com/marktext/muya/commit/c515b7f6f30e2f520032c355f09f3a037f9b8294))

## [0.0.37](https://github.com/marktext/muya/compare/v0.0.36...v0.0.37) (2025-11-13)


### Bug Fixes

* list style css ([8785f21](https://github.com/marktext/muya/commit/8785f21c75917eaf0899298a5aae7edbadf5c3f5))

## [0.0.36](https://github.com/marktext/muya/compare/v0.0.35...v0.0.36) (2025-11-13)


### Features

* update list style ([c2f7cb8](https://github.com/marktext/muya/commit/c2f7cb8f17ae65c166652bbd5565c2afd5b9bf8a))

## [0.0.35](https://github.com/marktext/muya/compare/v0.0.34...v0.0.35) (2025-11-06)


### Bug Fixes

* TS error in table picker ([ab1f81f](https://github.com/marktext/muya/commit/ab1f81f57b1ce9e3e5c66ab8c7d2d42c1d78f3cd))

## [0.0.34](https://github.com/marktext/muya/compare/v0.0.33...v0.0.34) (2025-11-06)


### Bug Fixes

* some lint error ([f6af8e0](https://github.com/marktext/muya/commit/f6af8e04ae7531f55e2dff378b281049d8e83fbf))

## [0.0.33](https://github.com/marktext/muya/compare/v0.0.32...v0.0.33) (2025-10-28)


### Bug Fixes

* undo error when input slash ([#172](https://github.com/marktext/muya/issues/172)) ([5f3cbbb](https://github.com/marktext/muya/commit/5f3cbbbcbab79be8d3d7ad9a02035f0e1ae25480))
* update @muya/core to @muyajs/core in examples ([055d04d](https://github.com/marktext/muya/commit/055d04da4f34c9ff8784f00c207b3504d44d06d4))

# CHANGELOG
