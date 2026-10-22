// @vitest-environment happy-dom

import type { IJSONChangePayload } from '../changePayload';
import type { IOrderListState, TState } from '../types';
import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JSONState, { asDoc } from '..';
import { Muya } from '../../muya';
import * as utils from '../../utils';

const instances: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
});

afterEach(() => {
    for (const muya of instances.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
});

function boot() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: 'hello\n\nuntouched\n' });
    instances.push(muya);
    muya.init();
    const payloads: IJSONChangePayload[] = [];
    muya.on('json-change', (...args: unknown[]) => payloads.push(args[0] as IJSONChangePayload));
    return { muya, state: muya.editor.jsonState, payloads };
}

function orderList(): IOrderListState {
    return {
        name: 'order-list',
        meta: { start: 1, delimiter: '.', loose: false, sourceMarkers: ['1.'] },
        children: [{ name: 'list-item', children: [{ name: 'paragraph', text: 'one' }] }],
    };
}

describe('json-change snapshot compatibility', () => {
    it('keeps both snapshots pinned and memoized after later edits and replacement', () => {
        const { muya, state, payloads } = boot();
        state.dispatch(json1.replaceOp([0, 'text'], 'hello', 'first'));
        state.dispatch(json1.replaceOp([0, 'text'], 'first', 'second'));
        muya.setContent('replacement');
        expect(payloads[0].prevDoc[0]).toEqual({ name: 'paragraph', text: 'hello' });
        expect(payloads[0].doc[0]).toEqual({ name: 'paragraph', text: 'first' });
        expect(payloads[1].prevDoc[0]).toEqual({ name: 'paragraph', text: 'first' });
        expect(payloads[1].doc[0]).toEqual({ name: 'paragraph', text: 'second' });
        expect(payloads[0].prevDoc).toBe(payloads[0].prevDoc);
        expect(payloads[0].doc).toBe(payloads[0].doc);
    });

    it('isolates edits to publicly returned snapshots, including shared untouched subtrees', () => {
        const { state, payloads } = boot();
        state.dispatch(json1.replaceOp([0, 'text'], 'hello', 'first'));
        const before = state.getState();
        payloads[0].prevDoc[1] = { name: 'paragraph', text: 'changed' };
        (payloads[0].doc[1] as { text: string }).text = 'changed too';
        expect(state.getState()).toEqual(before);
        state.dispatch(json1.replaceOp([0, 'text'], 'first', 'second'));
        expect(payloads[1].prevDoc).toEqual(before);
    });

    it('does not clone a document for History or unused snapshot fields', () => {
        const { muya, state, payloads } = boot();
        const before = state.rawState;
        const clone = vi.spyOn(utils, 'deepClone');
        state.dispatch(json1.editOp([0, 'text'], 'text-unicode', [5, '!']));
        const after = state.rawState;
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        expect(clone.mock.calls.some(([value]) => value === before || value === after)).toBe(false);
        void payloads[0].doc;
        void payloads[0].doc;
        expect(clone.mock.calls.filter(([value]) => value === after)).toHaveLength(1);
        void payloads[0].prevDoc;
        void payloads[0].prevDoc;
        expect(clone.mock.calls.filter(([value]) => value === before)).toHaveLength(1);
    });

    it('owns JSON input and inserted values so callers and blocks cannot rewrite snapshots', () => {
        const { state, payloads } = boot();
        const input = [orderList()];
        state.setContent(input);
        const inserted = orderList();
        state.dispatch(json1.insertOp([1], asDoc(inserted)));
        input[0].meta.sourceMarkers![0] = '99.';
        inserted.meta.sourceMarkers![0] = '88.';
        expect((state.getState()[0] as IOrderListState).meta.sourceMarkers).toEqual(['1.']);
        expect((state.getState()[1] as IOrderListState).meta.sourceMarkers).toEqual(['1.']);
        expect((payloads[0].prevDoc[0] as IOrderListState).meta.sourceMarkers).toEqual(['1.']);
        expect((payloads[0].doc[1] as IOrderListState).meta.sourceMarkers).toEqual(['1.']);
        (payloads[0].doc[1] as IOrderListState).meta.sourceMarkers!.push('2.');
        expect((state.getState()[1] as IOrderListState).meta.sourceMarkers).toEqual(['1.']);
    });

    it('keeps outer and nested dispatch snapshots separate', () => {
        const { muya, state, payloads } = boot();
        let nested = false;
        muya.on('json-change', () => {
            if (!nested) {
                nested = true;
                state.dispatch(json1.replaceOp([0, 'text'], 'first', 'second'));
            }
        });
        state.dispatch(json1.replaceOp([0, 'text'], 'hello', 'first'));
        expect(payloads[0].doc[0]).toEqual({ name: 'paragraph', text: 'first' });
        expect(payloads[1].prevDoc[0]).toEqual({ name: 'paragraph', text: 'first' });
        expect(payloads[1].doc[0]).toEqual({ name: 'paragraph', text: 'second' });
    });

    it('skips a cancelled batch without cloning, emitting, or advancing revision', () => {
        const { state, payloads } = boot();
        const revision = state.revision;
        state.insertOperation([2], { name: 'paragraph', text: 'cancelled' });
        state.removeOperation([2]);
        const clone = vi.spyOn(utils, 'deepClone');
        state.flush();
        expect(payloads).toHaveLength(0);
        expect(state.revision).toBe(revision);
        expect(clone).not.toHaveBeenCalled();
        state.dispatch(null);
        expect(payloads).toHaveLength(1);
        expect(payloads[0].op).toBeNull();
        expect(state.revision).toBe(revision);
    });

    it('keeps a new edit queued by a flush listener for the following batch', () => {
        const { muya, state, payloads } = boot();
        muya.once('json-change', () => state.editOperation([0, 'text'], [6, '?']));
        state.editOperation([0, 'text'], [5, '!']);
        state.flush();
        state.flush();
        expect(payloads).toHaveLength(2);
        expect(payloads[0].doc[0]).toEqual({ name: 'paragraph', text: 'hello!' });
        expect(payloads[1].doc[0]).toEqual({ name: 'paragraph', text: 'hello!?' });
    });

    it('getState handles deep trees and preserves defensive metadata copies', () => {
        const { muya } = boot();
        let node: TState = orderList();
        for (let i = 0; i < 10000; i++)
            node = { name: 'block-quote', children: [node] };
        const state = new JSONState(muya, [node]);
        let copy = state.getState()[0];
        for (let i = 0; i < 10000; i++)
            copy = (copy as Extract<TState, { name: 'block-quote' }>).children[0];
        (copy as IOrderListState).meta.sourceMarkers![0] = '99.';
        let original = state.rawState[0];
        for (let i = 0; i < 10000; i++)
            original = (original as Extract<TState, { name: 'block-quote' }>).children[0];
        expect((original as IOrderListState).meta.sourceMarkers).toEqual(['1.']);
    });
});
