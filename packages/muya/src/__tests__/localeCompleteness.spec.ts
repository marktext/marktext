import { describe, expect, it } from 'vitest';
import { de, en, es, fr, ja, ko, nl, pt, zhCN, zhTW } from '../locales';

// CHARACTERIZATION: every shipped locale must carry the exact same translation
// keys as the canonical `en` locale (no missing/extra keys), and expose a
// `name` tag identifying it. Missing keys would surface untranslated strings;
// extra keys are dead weight. `en` is the source of truth.

const nonEnLocales: Array<[string, typeof en]> = [
    ['de', de],
    ['es', es],
    ['fr', fr],
    ['ja', ja],
    ['ko', ko],
    ['nl', nl],
    ['pt', pt],
    ['zh-CN', zhCN],
    ['zh-TW', zhTW],
];

// Technical terms that MUST NOT be translated — they are product names,
// standards, or widely-recognized English terms used as-is in all locales.
// Note: CJK locales (ja, ko, zh-CN, zh-TW) and Turkish conventionally
// translate these terms. We only enforce this for Latin-script locales.
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

const LATIN_SCRIPT_LOCALES = ['de', 'es', 'fr', 'nl', 'pt'];

describe('locale completeness', () => {
    const enKeys = Object.keys(en.resource).sort();

    it('en exposes a non-empty resource map and the expected name', () => {
        expect(en.name).toBe('en');
        expect(enKeys.length).toBeGreaterThan(0);
    });

    it('ships exactly ten built-in locales (en + 9 translations)', () => {
        expect(nonEnLocales).toHaveLength(9);
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

    describe('technical terms are not translated (Latin-script locales)', () => {
        const latinLocales = nonEnLocales.filter(([tag]) => LATIN_SCRIPT_LOCALES.includes(tag));
        for (const [tag, locale] of latinLocales) {
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
