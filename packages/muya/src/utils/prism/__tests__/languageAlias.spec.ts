// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import prism, { loadLanguage, transformAliasToOrigin } from '../index';

describe('c++ language alias (#2910)', () => {
    it('resolves `c++` to the cpp grammar', () => {
        expect(transformAliasToOrigin(['c++'])[0]).toBe('cpp');
    });

    it('resolves `h++` to the cpp grammar', () => {
        expect(transformAliasToOrigin(['h++'])[0]).toBe('cpp');
    });

    it('leaves the canonical `cpp` id untouched', () => {
        expect(transformAliasToOrigin(['cpp'])[0]).toBe('cpp');
    });

    // The runtime grammar is registered under the resolved id (`cpp`), never the
    // alias, so code paths must tokenize with `transformAliasToOrigin(lang)` —
    // tokenizing with the raw `c++` grammar is `undefined` and crashes (the
    // backspaceHandler regression this alias exposed).
    it('exposes a runtime grammar for the resolved id but not the raw alias', async () => {
        await loadLanguage('c++');
        const resolved = transformAliasToOrigin(['c++'])[0];
        expect(resolved).toBe('cpp');
        expect(prism.languages[resolved]).toBeTruthy();
        expect(prism.languages['c++']).toBeUndefined();
        expect(() => prism.tokenize('int main(){}', prism.languages[resolved])).not.toThrow();
    });
});
