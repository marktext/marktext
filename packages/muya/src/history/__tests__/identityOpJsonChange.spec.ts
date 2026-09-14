// @vitest-environment happy-dom

// Regression for #4806: an identity (`null`) ot-json1 op must never crash
// History. `compose()` legitimately yields `null` when queued ops cancel out
// (e.g. IME edits), and both the deferred-flush emitter and the `dispatch`
// path can surface it through `json-change`. `History` reads `op.length`, so a
// forwarded `null` threw `Cannot read properties of null (reading 'length')`.

import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { asDoc } from '../../state';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function undoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.undo.length;
}

describe('identity (null) op via json-change — #4806', () => {
    it('updateContents(null) does not crash History and records nothing', () => {
        const muya = bootMuya('hello\n');

        // `Editor.updateContents` deliberately forwards the identity op to
        // `dispatch`, which emits a `json-change` carrying `op: null`.
        expect(() => muya.editor.updateContents(null, null, 'user')).not.toThrow();

        expect(muya.getMarkdown().trim()).toBe('hello');
        expect(undoDepth(muya)).toBe(0);
    });

    it('flushing a compose-to-null batch is a no-op (locks #4815)', () => {
        const muya = bootMuya('hello\n');
        const jsonState = muya.editor.jsonState;

        // A real op and its exact inverse compose to the identity op — the
        // op-level shape of an IME insert cancelled by a delete in one frame.
        const op = json1.insertOp([1], asDoc({ name: 'paragraph', text: 'x' } as never))!;
        const inverse = json1.type.invert(op);
        expect(json1.type.compose(op, inverse)).toBe(null);

        let changes = 0;
        muya.eventCenter.on('json-change', () => {
            changes += 1;
        });

        // @ts-expect-error — drive the private deferred-flush path directly.
        jsonState._operationCache.push(op, inverse);
        // @ts-expect-error — the function the crash stack named.
        expect(() => jsonState._flushOperationCache()).not.toThrow();

        expect(changes).toBe(0);
        expect(muya.getMarkdown().trim()).toBe('hello');
        expect(undoDepth(muya)).toBe(0);
    });
});
