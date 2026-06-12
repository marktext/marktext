// @vitest-environment happy-dom

import type { VNode } from 'snabbdom';
import type Format from '../../../block/base/format';
import type { ICursor } from '../../../selection/types';
import type { ImageToken } from '../../types';
import type Renderer from '../index';
import { describe, expect, it, vi } from 'vitest';
import { h } from '../../../utils/snabbdom';
import image from '../image';

// Regression tests for marktext commit cb7be189 (#1318):
// "Feat: Support inline image and small image".
// When the loaded image's natural width or height is smaller than 100px,
// the wrapper element should receive an extra `.mu-small-image` class so
// themes can adjust the layout (the floating toolbar/buttons would otherwise
// dwarf the image itself). Before the port, `image.ts` discarded the
// width/height returned by `loadImageAsync`.

interface IFakeRenderer {
    loadImageAsync: (
        info: { isUnknownType: boolean; src: string },
        attrs: Record<string, string>,
    ) => { id: string; isSuccess: boolean | undefined; width?: number; height?: number };
    urlMap: Map<string, string>;
    muya: {
        editor: { selection: { image: null | unknown } };
        i18n: { t: (s: string) => string };
    };
}

function makeRenderer(loadResult: {
    id: string;
    isSuccess: boolean | undefined;
    width?: number;
    height?: number;
}): IFakeRenderer {
    return {
        loadImageAsync: vi.fn(() => loadResult),
        urlMap: new Map(),
        muya: {
            editor: { selection: { image: null } },
            i18n: { t: (s: string) => s },
        },
    };
}

function makeImageToken(overrides: Partial<ImageToken['attrs']> = {}): ImageToken {
    return {
        type: 'image',
        raw: '![alt](https://example.com/x.png)',
        marker: '!',
        srcAndTitle: 'https://example.com/x.png',
        attrs: {
            src: 'https://example.com/x.png',
            title: '',
            alt: 'alt',
            ...overrides,
        },
        src: 'https://example.com/x.png',
        title: '',
        parent: [],
        range: { start: 0, end: 33 },
        alt: 'alt',
        backlash: { first: '', second: '' },
    } as unknown as ImageToken;
}

function getWrapperSelector(vnodes: VNode | VNode[]): string {
    const arr = Array.isArray(vnodes) ? vnodes : [vnodes];
    return arr[0].sel as string;
}

// Narrow casts shared by every test: the fake renderer and block stubs
// don't satisfy the full Renderer / Format / ICursor surface, but
// `image()` only touches the loadImageAsync / urlMap / muya fields and
// the token range.
const fakeBlock = {} as unknown as Format;
const fakeCursor = {} as unknown as ICursor;
function asRenderer(r: IFakeRenderer): Renderer {
    return r as unknown as Renderer;
}

describe('image renderer — small image class (marktext cb7be189)', () => {
    it('adds `mu-small-image` class when loaded width is below 100px', () => {
        const renderer = makeRenderer({
            id: 'mu-image-1',
            isSuccess: true,
            width: 60,
            height: 200,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(getWrapperSelector(out)).toContain('.mu-small-image');
    });

    it('adds `mu-small-image` class when loaded height is below 100px', () => {
        const renderer = makeRenderer({
            id: 'mu-image-2',
            isSuccess: true,
            width: 300,
            height: 80,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(getWrapperSelector(out)).toContain('.mu-small-image');
    });

    it('does NOT add `mu-small-image` when both dimensions are >= 100', () => {
        const renderer = makeRenderer({
            id: 'mu-image-3',
            isSuccess: true,
            width: 400,
            height: 300,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(getWrapperSelector(out)).not.toContain('.mu-small-image');
    });

    it('does NOT add `mu-small-image` when the image is still loading (no width/height)', () => {
        const renderer = makeRenderer({
            id: 'mu-image-4',
            isSuccess: undefined,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(getWrapperSelector(out)).not.toContain('.mu-small-image');
    });

    it('does NOT add `mu-small-image` when the image failed to load', () => {
        const renderer = makeRenderer({
            id: 'mu-image-5',
            isSuccess: false,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(getWrapperSelector(out)).not.toContain('.mu-small-image');
    });
});
