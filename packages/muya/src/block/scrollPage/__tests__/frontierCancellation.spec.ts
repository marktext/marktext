// @vitest-environment happy-dom
import type Content from '../../../block/base/content';
import type Parent from '../../../block/base/parent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

const instances: Muya[] = [];
beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
});
afterEach(() => {
    for (const muya of instances.splice(0))
        muya.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
});
function boot(frontier: string) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const parts = Array.from({ length: 600 }, (_, i) => `Paragraph ${i}`);
    parts[550] = frontier;
    const muya = new Muya(host, { markdown: parts.join('\n\n') });
    instances.push(muya);
    muya.init();
    muya.ensureMountedThrough(550);
    const leaf = (muya.editor.scrollPage!.find(550) as Parent).lastContentInDescendant()!;
    muya.editor.activeContentBlock = leaf;
    leaf.setCursor(leaf.text.length, leaf.text.length, true);
    return { muya, leaf };
}

const TABLE = '| a | b |\n| - | - |\n| c | d |';
const CODE = '```js\ncode\n```';
type Handler = 'enterHandler' | 'arrowHandler' | 'tabHandler' | 'deleteHandler';
const EXITS: [string, string, Handler, string, boolean][] = [
    ['code Shift+Enter', CODE, 'enterHandler', 'Enter', true],
    ['table Enter', TABLE, 'enterHandler', 'Enter', false],
    ['table ArrowDown', TABLE, 'arrowHandler', 'ArrowDown', false],
    ['table Tab', TABLE, 'tabHandler', 'Tab', false],
    ['paragraph ArrowDown', 'frontier', 'arrowHandler', 'ArrowDown', false],
    ['paragraph ArrowRight', 'frontier', 'arrowHandler', 'ArrowRight', false],
    ['paragraph Delete', 'frontier', 'deleteHandler', 'Delete', false],
];
function exitBlock(leaf: Content, handler: Handler, key: string, shiftKey: boolean) {
    leaf[handler](new KeyboardEvent('keydown', { key, shiftKey, cancelable: true }));
}

describe('mount cancellation reaches frontier event handlers', () => {
    for (const action of ['replace', 'destroy'] as const) {
        it.each(EXITS)(`%s stops if a progress callback performs ${action}`, (_, markdown, handler, key, shiftKey) => {
            const { muya, leaf } = boot(markdown);
            const before = muya.getState();
            const callback = vi.fn(() => {
                if (action === 'replace')
                    muya.setContent('replacement');
                else
                    muya.destroy();
            });
            muya.once('muya-mount-progress', callback);
            exitBlock(leaf, handler, key, shiftKey);
            muya.flush();
            expect(callback).toHaveBeenCalledTimes(1);
            expect(muya.getState()).toEqual(action === 'replace'
                ? [{ name: 'paragraph', text: 'replacement' }]
                : before);
            if (action === 'destroy')
                expect(muya.eventCenter.events).toHaveLength(0);
        });
    }

    it.each(EXITS.filter(([, , handler]) => handler !== 'deleteHandler'))('%s still reaches a successor if a callback finishes the same document', (_, markdown, handler, key, shiftKey) => {
        const { muya, leaf } = boot(markdown);
        const before = muya.getState();
        muya.once('muya-mount-progress', () => muya.editor.scrollPage!.flushPendingMount());
        exitBlock(leaf, handler, key, shiftKey);
        muya.flush();
        expect(muya.getState()).toEqual(before);
        expect(muya.editor.selection.getSelection()?.anchor.block.text).toBe('Paragraph 551');
    });
});
