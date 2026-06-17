import { describe, expect, it } from 'vitest';
import { de, en, es, fr, ja, ko, pt, zhCN, zhTW } from '../locales';

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
    ['pt', pt],
    ['zh-CN', zhCN],
    ['zh-TW', zhTW],
];

describe('locale completeness', () => {
    const enKeys = Object.keys(en.resource).sort();

    it('en exposes a non-empty resource map and the expected name', () => {
        expect(en.name).toBe('en');
        expect(enKeys.length).toBeGreaterThan(0);
    });

    it('ships exactly nine built-in locales (en + 8 translations)', () => {
        expect(nonEnLocales).toHaveLength(8);
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
});
