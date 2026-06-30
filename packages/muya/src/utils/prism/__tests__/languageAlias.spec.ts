// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { transformAliasToOrigin } from '../index';

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
});
