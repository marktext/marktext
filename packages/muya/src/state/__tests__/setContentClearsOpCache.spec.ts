// @vitest-environment happy-dom

import type { TState } from '../types';
import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

const instances: Muya[] = [];
afterEach(() => {
    for (const muya of instances.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
});

function makeEditor(blocks: TState[]) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { json: blocks });
    muya.init();
    instances.push(muya);
    return muya.editor;
}

function nextFrame(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('setContent drops the previous document pending op batch (#2938)', () => {
    it('a deferred op from the old doc does not corrupt the new content after a tab switch', async () => {
        const editor = makeEditor([{ name: 'paragraph', text: 'A' }]);

        editor.transactions.insertOperation([1], { name: 'paragraph', text: 'STALE' });

        editor.setContent([
            { name: 'paragraph', text: 'B1' },
            { name: 'paragraph', text: 'B2' },
        ]);

        await nextFrame();
        await nextFrame();

        const texts = (editor.jsonState.getState() as Array<{ text: string }>).map(b => b.text);
        expect(texts).toEqual(['B1', 'B2']);
    });

    it('edits after a setContent still flush normally', async () => {
        const editor = makeEditor([{ name: 'paragraph', text: 'A' }]);
        editor.transactions.insertOperation([1], { name: 'paragraph', text: 'STALE' });
        editor.setContent([{ name: 'paragraph', text: 'B' }]);
        await nextFrame();

        editor.transactions.insertOperation([1], { name: 'paragraph', text: 'C' });
        await nextFrame();
        await nextFrame();

        const texts = (editor.jsonState.getState() as Array<{ text: string }>).map(b => b.text);
        expect(texts).toEqual(['B', 'C']);
    });
});
