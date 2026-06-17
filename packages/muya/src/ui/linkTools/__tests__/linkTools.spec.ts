// @vitest-environment happy-dom
import type Format from '../../../block/base/format';
import type { Muya } from '../../../muya';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventCenter from '../../../event';
import LinkTools from '../index';

// P3 defensive lock for marktext `1ef0d016` (link tools — unlink / jump).
// The new linkTools subscriber + `selectItem` dispatcher is fully staged
// in muya but there's no emitter for `muya-link-tools` yet, so neither
// the unlink path nor the jump path is exercised end-to-end. Without a
// test pinning the dispatch, a future refactor (e.g. renaming `unlink` /
// `jumpClick`, or swapping the switch on `item.type`) would silently
// regress the structure when the wiring is finally completed.
//
// These tests stub the floating-tool DOM surface and the eventCenter,
// then poke `selectItem` directly to verify each branch dispatches to
// the right collaborator.

// White-box view onto LinkTools' private render state, which these tests
// inject directly to exercise `selectItem`'s dispatch branches.
interface ILinkToolsView {
    _linkBlock: Format | null;
    _linkInfo: {
        href?: string;
        text?: string;
        raw?: string;
        range?: { start: number; end: number } | null;
    } | null;
    selectItem: (event: Event, item: { type: string; icon: string }) => void;
    destroy: () => void;
}

interface ITestSession {
    muya: Muya;
    tools: ILinkToolsView;
    domNode: HTMLElement;
}

const sessions: ITestSession[] = [];

function makeFakeMuya(): { muya: Muya; domNode: HTMLElement } {
    const eventCenter = new EventCenter();
    const domNode = document.createElement('div');
    document.body.appendChild(domNode);
    // BaseFloat.listen() attaches a scroll handler to `domNode.parentElement`,
    // so `domNode` needs a parent — `document.body` here.
    const muya = {
        eventCenter,
        domNode,
    } as unknown as Muya;
    return { muya, domNode };
}

interface ILinkToolsTestOptions {
    jumpClick?: (linkInfo: unknown) => void;
}

function bootLinkTools(options: ILinkToolsTestOptions = {}): ITestSession {
    const { muya, domNode } = makeFakeMuya();
    const tools = new LinkTools(muya, options) as unknown as ILinkToolsView;
    const session = { muya, tools, domNode };
    sessions.push(session);
    return session;
}

function makeFakeEvent() {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as Event;
}

afterEach(() => {
    // Tear each session down: detach DOM listeners attached via EventCenter,
    // destroy the floating-tool DOM (resize observers + floatBox), and
    // unmount the host node from document.body. This prevents listener /
    // node leakage across tests in the same worker.
    while (sessions.length) {
        const { muya, tools, domNode } = sessions.pop()!;
        tools.destroy();
        muya.eventCenter.detachAllDomEvents();
        domNode.remove();
    }
});

describe('linkTools.selectItem — dispatches to block.unlink / jumpClick', () => {
    it('unlink: routes to block.unlink with { range, text } from linkInfo', () => {
        const { tools } = bootLinkTools();
        const blockUnlink = vi.fn();
        // linkBlock is typed as Format | null; the fake only implements
        // `unlink` (the only method selectItem calls).
        tools._linkBlock = { unlink: blockUnlink } as unknown as Format;
        tools._linkInfo = {
            href: 'https://example.com',
            text: 'hi',
            raw: '[hi](https://example.com)',
            range: { start: 5, end: 30 },
        };

        tools.selectItem(makeFakeEvent(), { type: 'unlink', icon: '' });

        expect(blockUnlink).toHaveBeenCalledTimes(1);
        expect(blockUnlink).toHaveBeenCalledWith({
            range: { start: 5, end: 30 },
            text: 'hi',
        });
    });

    it('unlink: no-ops when block is missing (defensive)', () => {
        const { tools } = bootLinkTools();
        tools._linkBlock = null;
        tools._linkInfo = { href: 'x', text: 'y', range: { start: 0, end: 1 } };

        // Should not throw.
        tools.selectItem(makeFakeEvent(), { type: 'unlink', icon: '' });
    });

    it('unlink: no-ops when linkInfo.range is missing', () => {
        const { tools } = bootLinkTools();
        const blockUnlink = vi.fn();
        // linkBlock is typed as Format | null; the fake only implements
        // `unlink` (the only method selectItem calls).
        tools._linkBlock = { unlink: blockUnlink } as unknown as Format;
        tools._linkInfo = { href: 'x', text: 'y', range: null };

        tools.selectItem(makeFakeEvent(), { type: 'unlink', icon: '' });

        expect(blockUnlink).not.toHaveBeenCalled();
    });

    it('jump: routes to options.jumpClick with the captured linkInfo', () => {
        const jumpClick = vi.fn();
        const { tools } = bootLinkTools({ jumpClick });

        const linkInfo = { href: 'https://example.com' };
        tools._linkInfo = linkInfo;

        tools.selectItem(makeFakeEvent(), { type: 'jump', icon: '' });

        expect(jumpClick).toHaveBeenCalledTimes(1);
        expect(jumpClick).toHaveBeenCalledWith(linkInfo);
    });
});
