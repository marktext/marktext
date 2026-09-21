import { describe, expect, it } from 'vitest';
import * as locales from '../locales';

// CHARACTERIZATION: every shipped locale must carry the exact same translation
// keys as the canonical `en` locale (no missing/extra keys), and expose a
// `name` tag identifying it. Missing keys would surface untranslated strings;
// extra keys are dead weight. `en` is the source of truth.

const { de, en, es, fr, ja, ko, nl, pt, ru, tr, zhCN, zhTW } = locales;

// Spelled out rather than derived from `locales` so the name-tag suite below
// asserts against an independent expectation instead of the value it checks.
// `covers every locale the package exports` keeps the two in sync.
const nonEnLocales: Array<[string, typeof en]> = [
    ['de', de],
    ['es', es],
    ['fr', fr],
    ['ja', ja],
    ['ko', ko],
    ['nl', nl],
    ['pt', pt],
    ['ru', ru],
    ['tr', tr],
    ['zh-CN', zhCN],
    ['zh-TW', zhTW],
];

// Technical terms that MUST NOT be translated — they are product names,
// standards, or widely-recognized English terms used as-is in all locales.
// Enforced only for the locales listed in TERM_PRESERVING_LOCALES below; the
// others (ja, ko, zh-CN, zh-TW, tr) do translate them by convention, e.g.
// tr.ts renders Front Matter as "Ön Bilgi".
//
// Canonical spelling of product/standard names (for reference):
//   - PlantUML   (not "Plantuml") — https://plantuml.com
//   - Mermaid    — https://mermaid.js.org
//   - Vega-Lite  (not "Vega Chart") — https://vega.github.io/vega-lite/
//   - Front Matter — YAML metadata block (industry standard term)
//   - KaTeX      (not "Katex") — https://katex.org
//   - MathJax    (not "Mathjax") — https://www.mathjax.org
//
// NOTE: The locale key for PlantUML is misspelled as 'Plantuml' in the source.
// This is a known upstream issue — the key cannot be changed without a
// coordinated refactor, but display values SHOULD use the correct casing.
const TECHNICAL_TERMS: Record<string, string> = {
    'Front Matter': 'Front Matter',
    'Mermaid': 'Mermaid',
    'Plantuml': 'PlantUML', // key is misspelled upstream; display value uses correct casing
};

// Locales that keep the English product names as-is. Not a script property —
// ru is Cyrillic and still spells Front Matter, Mermaid and PlantUML the
// English way — so membership is per-locale convention, not per-alphabet.
const TERM_PRESERVING_LOCALES = ['de', 'es', 'fr', 'nl', 'pt', 'ru'];

describe('locale completeness', () => {
    const enKeys = Object.keys(en.resource).sort();

    it('en exposes a non-empty resource map and the expected name', () => {
        expect(en.name).toBe('en');
        expect(enKeys.length).toBeGreaterThan(0);
    });

    it('covers every locale the package exports', () => {
        const exported = Object.values(locales).map(locale => locale.name).sort();
        const covered = ['en', ...nonEnLocales.map(([tag]) => tag)].sort();
        expect(covered).toEqual(exported);
    });

    describe('key parity with en', () => {
        for (const [tag, locale] of nonEnLocales) {
            it(`${tag} has the same resource keys as en (no missing/extra)`, () => {
                expect(Object.keys(locale.resource).sort()).toEqual(enKeys);
            });
        }
    });

    describe('locale name tags', () => {
        const expected: Record<string, string> = {
            'de': 'de',
            'es': 'es',
            'fr': 'fr',
            'ja': 'ja',
            'ko': 'ko',
            'nl': 'nl',
            'pt': 'pt',
            'ru': 'ru',
            'tr': 'tr',
            'zh-CN': 'zh-CN',
            'zh-TW': 'zh-TW',
        };
        for (const [tag, locale] of nonEnLocales) {
            it(`${tag} reports the expected name tag`, () => {
                expect(locale.name).toBe(expected[tag]);
            });
        }
    });

    describe('every resource value is a non-empty string', () => {
        for (const [tag, locale] of [['en', en] as [string, typeof en], ...nonEnLocales]) {
            it(`${tag} has only non-empty string values`, () => {
                for (const value of Object.values(locale.resource)) {
                    expect(typeof value).toBe('string');
                    expect((value as string).length).toBeGreaterThan(0);
                }
            });
        }
    });

    describe('technical terms are not translated', () => {
        const termLocales = nonEnLocales.filter(([tag]) => TERM_PRESERVING_LOCALES.includes(tag));
        for (const [tag, locale] of termLocales) {
            for (const [key, expectedValue] of Object.entries(TECHNICAL_TERMS)) {
                it(`${tag} keeps "${key}" untranslated`, () => {
                    const resource = locale.resource as Record<string, string>;
                    if (key in resource) {
                        expect(resource[key]).toBe(expectedValue);
                    }
                });
            }
        }
    });
});
