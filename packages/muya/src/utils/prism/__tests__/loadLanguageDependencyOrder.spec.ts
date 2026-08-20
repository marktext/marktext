// @vitest-environment happy-dom

// Regression for the flaky `c++`/`cpp` load: Prism components load their
// dependencies via `getLoader().load()`. Without a Promise `chainer`, the
// loader fires a dependent component's import without awaiting its dependency,
// so `cpp` (whose grammar `extend`s `c`) could evaluate before `c` was
// registered — `Prism.languages.extend('c', …)` then ran on `undefined` and
// threw "Cannot set properties of undefined (setting 'class-name')", which also
// left the load promise unresolved (a hang, surfacing as a CI test timeout).
// The fix loads in dependency order; this pins that contract.

import { afterEach, describe, expect, it, vi } from 'vitest';
import prism, { loadLanguage } from '../index';
import { loadedLanguages } from '../loadLanguage';

function resetCppState() {
    for (const lang of ['c', 'cpp']) {
        delete (prism.languages as Record<string, unknown>)[lang];
        loadedLanguages.delete(lang);
    }
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('loadLanguage — dependency load order (flaky c++ fix)', () => {
    it('loads a dependency (`c`) before the dependent (`cpp`) that extends it', async () => {
        resetCppState();

        const addOrder: string[] = [];
        const realAdd = loadedLanguages.add.bind(loadedLanguages);
        vi.spyOn(loadedLanguages, 'add').mockImplementation((lang: string) => {
            addOrder.push(lang);
            return realAdd(lang);
        });

        await expect(loadLanguage('c++')).resolves.toBeDefined();

        // `cpp` requires `c`; the fix guarantees `c` is registered first.
        expect(addOrder).toContain('c');
        expect(addOrder).toContain('cpp');
        expect(addOrder.indexOf('c')).toBeLessThan(addOrder.indexOf('cpp'));

        // And the resulting grammar is the valid extend-of-c, not `undefined`.
        expect(prism.languages.cpp).toBeTruthy();
        expect(() => prism.tokenize('int main(){}', prism.languages.cpp)).not.toThrow();
    });
});
