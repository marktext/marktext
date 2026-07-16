// @vitest-environment happy-dom

import * as json1 from 'ot-json1';
import { describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// `doc` was never read in-repo, but `json-change` is published API surface
// (README): external listeners may destructure it. It stays available as a
// memoized lazy getter so unused reads cost nothing on large documents.

describe('json-change payload compatibility', () => {
    it('exposes doc as a memoized lazy getter with the post-apply state', () => {
        window.MUYA_VERSION = 'test';
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, {
            markdown: 'hello\n',
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();

        let payload: { prevDoc: unknown[]; doc: unknown[] } | null = null;
        muya.on('json-change', (...args: unknown[]) => {
            payload = args[0] as { prevDoc: unknown[]; doc: unknown[] };
        });

        const op = json1.replaceOp([0, 'text'], 'hello', 'changed');
        muya.editor.jsonState.dispatch(op!);

        expect(payload).not.toBeNull();
        const first = payload!.doc;
        expect(JSON.stringify(first)).toContain('changed');
        expect(JSON.stringify(payload!.prevDoc)).toContain('hello');
        // Memoized: repeated reads return the same clone.
        expect(payload!.doc).toBe(first);

        muya.destroy();
        host.remove();
    });

    it('keeps snapshot semantics when the payload is read after later edits', () => {
        window.MUYA_VERSION = 'test';
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, {
            markdown: 'hello\n',
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();

        const payloads: { doc: unknown }[] = [];
        muya.on('json-change', (...args: unknown[]) => {
            payloads.push(args[0] as { doc: unknown });
        });

        muya.editor.jsonState.dispatch(json1.replaceOp([0, 'text'], 'hello', 'first')!);
        muya.editor.jsonState.dispatch(json1.replaceOp([0, 'text'], 'first', 'second')!);

        // Reading the FIRST event's doc only now must still see the document
        // as it was right after the first edit — the old eager-clone contract.
        expect(JSON.stringify(payloads[0].doc)).toContain('first');
        expect(JSON.stringify(payloads[0].doc)).not.toContain('second');
        expect(JSON.stringify(payloads[1].doc)).toContain('second');

        muya.destroy();
        host.remove();
    });
});
