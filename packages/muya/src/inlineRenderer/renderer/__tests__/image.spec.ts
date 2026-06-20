// @vitest-environment happy-dom

import type { VNode } from 'snabbdom';
import type Format from '../../../block/base/format';
import type { IRenderCursor } from '../../../selection/types';
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
    ) => { id: string; isSuccess: boolean | undefined; width?: number; height?: number; url?: string };
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
    url?: string;
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

function findImgSrc(vnodes: VNode | VNode[]): string | undefined {
    const arr = Array.isArray(vnodes) ? vnodes : [vnodes];
    let found: string | undefined;
    const walk = (node: unknown) => {
        if (!node || typeof node !== 'object')
            return;
        const vnode = node as VNode;
        if (vnode.sel === 'img') {
            found = (vnode.data?.props?.src as string | undefined);
            return;
        }
        if (Array.isArray(vnode.children))
            vnode.children.forEach(walk);
    };
    arr.forEach(walk);
    return found;
}

// Narrow casts shared by every test: the fake renderer and block stubs
// don't satisfy the full Renderer / Format / IRenderCursor surface, but
// `image()` only touches the loadImageAsync / urlMap / muya fields and
// the token range.
const fakeBlock = {} as unknown as Format;
const fakeCursor = {} as unknown as IRenderCursor;
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

// Regression: "Reload images" must keep showing the refreshed local file even
// after the block re-renders (every keystroke rewrites the block's innerHTML).
// `loadImageAsync` resolves a cache-busted `file://?mucache=...` URL; the
// rendered <img> must use that resolved URL rather than the plain `file://`
// path, otherwise innerHTML re-requests the un-busted URL and Chromium serves
// the stale, previously cached bitmap. Remote URLs have no resolved override.
describe('image renderer — uses the cache-busted url for local files', () => {
    it('renders the resolved (cache-busted) url returned by loadImageAsync', () => {
        const renderer = makeRenderer({
            id: 'mu-image-6',
            isSuccess: true,
            width: 400,
            height: 300,
            url: 'file:///tmp/pic.png?mucache=mu-6',
        });
        const token = makeImageToken({ src: 'file:///tmp/pic.png' });

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(findImgSrc(out)).toBe('file:///tmp/pic.png?mucache=mu-6');
    });

    it('falls back to the plain src when no resolved url is returned', () => {
        const renderer = makeRenderer({
            id: 'mu-image-7',
            isSuccess: true,
            width: 400,
            height: 300,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(findImgSrc(out)).toBe('https://example.com/x.png');
    });
});

// Regression: the wrapper class gate that drives click-to-open-editor.
// `.mu-image-fail` (loadImageAsync isSuccess:false) and `.mu-empty-image`
// (token has no resolvable src) are the branches at image.ts:188 / image.ts:227.
// The click-to-open-editor behaviour itself is e2e-covered (muya
// image-tools.spec.ts); only the wrapper-class assignment is the missing slice.
describe('image renderer — fail / empty wrapper classes', () => {
    it('adds `mu-image-fail` class when loadImageAsync reports isSuccess:false', () => {
        const renderer = makeRenderer({
            id: 'mu-image-8',
            isSuccess: false,
        });
        const token = makeImageToken();

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        const selector = getWrapperSelector(out);
        expect(selector).toContain('.mu-image-fail');
        expect(selector).not.toContain('.mu-image-success');
        expect(selector).not.toContain('.mu-empty-image');
    });

    it('adds `mu-empty-image` class when the token has no resolvable src', () => {
        const renderer = makeRenderer({
            id: 'mu-image-9',
            isSuccess: false,
        });
        const token = makeImageToken({ src: '' });
        token.src = '';
        token.srcAndTitle = '';

        const out = image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        const selector = getWrapperSelector(out);
        expect(selector).toContain('.mu-empty-image');
        expect(selector).not.toContain('.mu-image-fail');
        expect(selector).not.toContain('.mu-image-success');
    });

    it('does not call loadImageAsync for an empty-src token (no resolvable src)', () => {
        const renderer = makeRenderer({
            id: 'mu-image-10',
            isSuccess: false,
        });
        const token = makeImageToken({ src: '' });
        token.src = '';
        token.srcAndTitle = '';

        image.call(
            asRenderer(renderer),
            { h, block: fakeBlock, token, cursor: fakeCursor },
        );

        expect(renderer.loadImageAsync).not.toHaveBeenCalled();
    });
});
