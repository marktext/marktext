// @vitest-environment happy-dom
import type { Muya } from '../../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmojiSelector } from '..';
import EventCenter from '../../../event';
import { en } from '../../../locales/en';
import { zhCN } from '../../../locales/zh-CN';

// Integration-shaped tests for the EmojiSelector floating autocomplete UI.
//
// The selector is a BaseScrollFloat subclass driven entirely by the
// `muya-emoji-picker` event (emitted from Format.checkInlineUpdate / the
// `:alias` typing path). We mock the slice of Muya the selector touches
// (eventCenter, domNode, i18n, ui) and run BaseFloat/BaseScrollFloat for real
// so the snabbdom render path is exercised end-to-end in happy-dom.

function makeFakeMuya(t: (s: string) => string = (s: string) => s): { muya: Muya; eventCenter: EventCenter } {
    const eventCenter = new EventCenter();
    const editorDomNode = document.createElement('div');
    const editorWrapper = document.createElement('div');
    editorWrapper.appendChild(editorDomNode);
    document.body.appendChild(editorWrapper);

    const shownFloat = new Set();
    // Mirror Ui.listen so `status` flips when the float shows/hides.
    eventCenter.subscribe('muya-float', (tool: unknown, status: boolean) => {
        status ? shownFloat.add(tool) : shownFloat.delete(tool);
    });

    const muya = {
        domNode: editorDomNode,
        eventCenter,
        i18n: { t },
        ui: { shownFloat },
        options: {},
    } as unknown as Muya;

    return { muya, eventCenter };
}

function stubReference(): HTMLElement {
    const span = document.createElement('span');
    // BaseFloat computes position off the reference; happy-dom has no layout,
    // so a stubbed rect keeps autoUpdate from throwing.
    span.getBoundingClientRect = () =>
        ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
    document.body.appendChild(span);
    return span;
}

// Build an I18n-shaped stub from a real locale resource map so the category
// title rendering asserts against the actual shipped translations.
function localeT(resource: Record<string, string>): (s: string) => string {
    return (key: string) => resource[key] || key;
}

const selectors: EmojiSelector[] = [];

afterEach(() => {
    while (selectors.length)
        selectors.pop()!.destroy();
    vi.restoreAllMocks();
});

describe('emojiSelector — plugin shape', () => {
    it('exposes a stable static pluginName so Muya.use registers it under "emojiPicker"', () => {
        expect(EmojiSelector.pluginName).toBe('emojiPicker');
    });
});

describe('emojiSelector — render on muya-emoji-picker event', () => {
    let muya: Muya;
    let eventCenter: EventCenter;
    let selector: EmojiSelector;

    beforeEach(() => {
        ({ muya, eventCenter } = makeFakeMuya());
        selector = new EmojiSelector(muya);
        selectors.push(selector);
    });

    it('searches matches, marks the first item active, and shows the float', () => {
        const reference = stubReference();
        const setEmoji = vi.fn();

        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji } });

        expect(selector.renderArray.length).toBeGreaterThan(0);
        expect(selector.activeItem).toBe(selector.renderArray[0]);
        expect(selector.status).toBe(true);
    });

    it('groups results under category sections and renders one .item per emoji with a span', () => {
        const reference = stubReference();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji: vi.fn() } });

        const sections = selector.floatBox!.querySelectorAll('section');
        expect(sections.length).toBeGreaterThan(0);
        const items = selector.floatBox!.querySelectorAll('div.item');
        expect(items.length).toBe(selector.renderArray.length);
        // First rendered item carries the active class.
        const activeItems = selector.floatBox!.querySelectorAll('div.item.active');
        expect(activeItems.length).toBe(1);
        // Each item embeds the emoji glyph in a child span and tags its alias.
        const first = items[0] as HTMLElement;
        expect(first.querySelector('span')).not.toBeNull();
        expect(first.dataset.label).toBe(selector.activeItem!.aliases[0]);
    });

    it('hides (no show) when emojiText is empty', () => {
        const reference = stubReference();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: '', block: { setEmoji: vi.fn() } });

        expect(selector.status).toBe(false);
        expect(selector.renderArray.length).toBe(0);
    });

    it('hides when the search yields no matches', () => {
        const reference = stubReference();
        eventCenter.emit('muya-emoji-picker', {
            reference,
            emojiText: 'zzzzznotanemojizzzzz',
            block: { setEmoji: vi.fn() },
        });

        expect(selector.status).toBe(false);
    });
});

describe('emojiSelector — selection', () => {
    let muya: Muya;
    let eventCenter: EventCenter;
    let selector: EmojiSelector;

    beforeEach(() => {
        ({ muya, eventCenter } = makeFakeMuya());
        selector = new EmojiSelector(muya);
        selectors.push(selector);
    });

    it('selectItem calls block.setEmoji with the item\'s first alias', () => {
        const reference = stubReference();
        const setEmoji = vi.fn();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji } });

        const item = selector.renderArray[0];
        selector.selectItem(item);

        expect(setEmoji).toHaveBeenCalledTimes(1);
        expect(setEmoji).toHaveBeenCalledWith(item.aliases[0]);
    });

    it('clicking a rendered item fires setEmoji with that item\'s alias', () => {
        const reference = stubReference();
        const setEmoji = vi.fn();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji } });

        const items = selector.floatBox!.querySelectorAll('div.item');
        const second = (items[1] ?? items[0]) as HTMLElement;
        const expectedAlias = second.dataset.label!;
        second.click();

        expect(setEmoji).toHaveBeenCalledTimes(1);
        expect(setEmoji).toHaveBeenCalledWith(expectedAlias);
    });

    it('step("next") advances activeItem and selecting it routes through setEmoji', () => {
        const reference = stubReference();
        const setEmoji = vi.fn();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji } });

        const first = selector.renderArray[0];
        selector.step('next');
        expect(selector.activeItem).toBe(selector.renderArray[1] ?? first);

        selector.selectItem(selector.activeItem);
        expect(setEmoji).toHaveBeenCalledWith(selector.activeItem!.aliases[0]);
    });
});

describe('emojiSelector — localized category titles', () => {
    it('renders the en category title verbatim', () => {
        const { muya, eventCenter } = makeFakeMuya(localeT(en.resource));
        const selector = new EmojiSelector(muya);
        selectors.push(selector);

        const reference = stubReference();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji: vi.fn() } });

        const titles = [...selector.floatBox!.querySelectorAll('section .title')].map(t => t.textContent);
        const category = selector.renderArray[0].category;
        expect(titles).toContain((en.resource as Record<string, string>)[category]);
    });

    it('renders the zh-CN translation for a matched category via i18n.t', () => {
        const { muya, eventCenter } = makeFakeMuya(localeT(zhCN.resource));
        const selector = new EmojiSelector(muya);
        selectors.push(selector);

        const reference = stubReference();
        eventCenter.emit('muya-emoji-picker', { reference, emojiText: 'smile', block: { setEmoji: vi.fn() } });

        const category = selector.renderArray[0].category;
        const translated = (zhCN.resource as Record<string, string>)[category];
        // The matched emoji lives in a category that zh-CN actually translates.
        expect(translated).toBeTruthy();
        expect(translated).not.toBe(category);

        const titles = [...selector.floatBox!.querySelectorAll('section .title')].map(t => t.textContent);
        expect(titles).toContain(translated);
    });
});
