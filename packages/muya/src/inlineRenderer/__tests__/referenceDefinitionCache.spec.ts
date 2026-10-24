// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import * as json1 from 'ot-json1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InlineRenderer from '..';
import { EditTransactions } from '../../editor/transactions';
import JSONState, { asDoc } from '../../state';

function makeRenderer(blocks: TState[]) {
    const muya = {
        options: {
            footnote: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
            texMathDollars: false,
            listIndentation: 1,
        },
        eventCenter: { emit: () => {} },
    } as unknown as Muya;
    const jsonState = new JSONState(muya, blocks);
    const transactions = new EditTransactions(jsonState, () => muya.options, transaction => jsonState.apply(transaction.operation), () => {}, () => {});
    Object.assign(muya, { editor: { jsonState, transactions } });
    const renderer = new InlineRenderer(muya);

    return { jsonState, transactions, renderer };
}

afterEach(() => vi.restoreAllMocks());

describe('reference definition collection cache', () => {
    it('caches repeated reads of committed definitions', () => {
        const { renderer } = makeRenderer([
            { name: 'paragraph', text: '[ref]: https://first.example' },
            { name: 'paragraph', text: '[label][ref]' },
        ]);
        const scan = vi.spyOn(renderer, 'getLabelInfo');

        const labels = renderer.collectReferenceDefinitions();
        expect(renderer.collectReferenceDefinitions()).toBe(labels);
        expect(labels.get('ref')?.href).toBe('https://first.example');

        expect(scan).toHaveBeenCalledTimes(2);
        expect(renderer.labels.get('ref')?.href).toBe('https://first.example');
    });

    it('reuses definitions throughout a batch of unrelated paragraph edits', () => {
        const { transactions, renderer } = makeRenderer([
            { name: 'paragraph', text: '[ref]: https://example.com' },
            ...Array.from({ length: 100 }, () => ({ name: 'paragraph' as const, text: 'ordinary text' })),
        ]);
        const labels = renderer.collectReferenceDefinitions();
        const scan = vi.spyOn(renderer, 'getLabelInfo');
        transactions.run(() => {
            for (let i = 1; i <= 100; i++) {
                transactions.apply(json1.editOp([i, 'text'], 'text-unicode', ['!']));
                expect(renderer.collectReferenceDefinitions()).toBe(labels);
            }
            expect(scan).not.toHaveBeenCalled();
        });
        expect(renderer.collectReferenceDefinitions().get('ref')?.href).toBe('https://example.com');
    });

    it('updates definitions created, edited, renamed, and removed within a scope', () => {
        const { transactions, renderer } = makeRenderer([
            { name: 'paragraph', text: 'ordinary text' },
        ]);
        expect(renderer.collectReferenceDefinitions().size).toBe(0);
        transactions.run(() => {
            transactions.apply(json1.replaceOp([0, 'text'], 'ordinary text', '[ref]: https://first.example'));
            const initial = renderer.collectReferenceDefinitions();
            expect(initial.get('ref')?.href).toBe('https://first.example');
            transactions.apply(json1.replaceOp([0, 'text'], '[ref]: https://first.example', '[other]: https://second.example'));
            const renamed = renderer.collectReferenceDefinitions();
            expect(renamed.has('ref')).toBe(false);
            expect(renamed.get('other')?.href).toBe('https://second.example');
            expect(initial.get('ref')?.href).toBe('https://first.example');
            transactions.apply(json1.replaceOp([0, 'text'], '[other]: https://second.example', 'ordinary text'));
            expect(renderer.collectReferenceDefinitions().size).toBe(0);
            transactions.apply(json1.insertOp([1], asDoc({ name: 'paragraph', text: '[new]: https://new.example' })));
            expect(renderer.collectReferenceDefinitions().get('new')?.href).toBe('https://new.example');
            transactions.apply(json1.removeOp([1]));
            expect(renderer.collectReferenceDefinitions().size).toBe(0);
        });
    });

    it('keeps nested duplicate-definition precedence through moves and rollback', () => {
        const { transactions, renderer } = makeRenderer([
            { name: 'block-quote', children: [{ name: 'paragraph', text: '[ref]: https://nested.example' }] },
            { name: 'paragraph', text: '[ref]: https://last.example' },
        ]);
        expect(renderer.collectReferenceDefinitions().get('ref')?.href).toBe('https://last.example');
        expect(() => transactions.run(() => {
            transactions.apply(json1.moveOp([1], [0]));
            expect(renderer.collectReferenceDefinitions().get('ref')?.href).toBe('https://nested.example');
            transactions.apply(json1.removeOp([1]));
            expect(renderer.collectReferenceDefinitions().get('ref')?.href).toBe('https://last.example');
            throw new Error('abort definitions');
        })).toThrow('abort definitions');
        expect(renderer.collectReferenceDefinitions().get('ref')?.href).toBe('https://last.example');
    });

    it('recollects after document replacement and applied edits', () => {
        const { jsonState, renderer } = makeRenderer([
            { name: 'paragraph', text: '[ref]: https://first.example' },
        ]);
        const initialRevision = jsonState.revision;

        renderer.collectReferenceDefinitions();
        jsonState.setContent([
            { name: 'paragraph', text: '[ref]: https://second.example' },
        ]);
        expect(jsonState.revision).toBe(initialRevision + 1);

        const scan = vi.spyOn(renderer, 'getLabelInfo');
        renderer.collectReferenceDefinitions();
        renderer.collectReferenceDefinitions();
        expect(scan).toHaveBeenCalledTimes(1);
        expect(renderer.labels.get('ref')?.href).toBe('https://second.example');

        jsonState.apply(
            json1.replaceOp(
                [0, 'text'],
                '[ref]: https://second.example',
                '[ref]: https://third.example',
            ),
        );
        expect(jsonState.revision).toBe(initialRevision + 2);

        scan.mockClear();
        renderer.collectReferenceDefinitions();
        renderer.collectReferenceDefinitions();
        expect(scan).toHaveBeenCalledTimes(1);
        expect(renderer.labels.get('ref')?.href).toBe('https://third.example');
    });
    it('scans deeply nested definitions without cloning or recursing', () => {
        let state: TState = { name: 'paragraph', text: '[ref]: https://deep.example' };
        for (let i = 0; i < 10000; i++)
            state = { name: 'block-quote', children: [state] };
        const { jsonState, renderer } = makeRenderer([state]);
        const getState = vi.spyOn(jsonState, 'getState');
        renderer.collectReferenceDefinitions();
        expect(renderer.labels.get('ref')?.href).toBe('https://deep.example');
        expect(getState).not.toHaveBeenCalled();
    });

    it('keeps traversal order and invalidates deleted definitions but not null operations', () => {
        const { jsonState, renderer } = makeRenderer([
            { name: 'block-quote', children: [{ name: 'paragraph', text: '[ref]: https://nested.example' }] },
            { name: 'paragraph', text: '[ref]: https://last.example' },
        ]);
        renderer.collectReferenceDefinitions();
        expect(renderer.labels.get('ref')?.href).toBe('https://last.example');
        const revision = jsonState.revision;
        const scan = vi.spyOn(renderer, 'getLabelInfo');
        jsonState.apply(null);
        renderer.collectReferenceDefinitions();
        expect(scan).not.toHaveBeenCalled();
        expect(jsonState.revision).toBe(revision);
        jsonState.apply(json1.removeOp([1]));
        renderer.collectReferenceDefinitions();
        expect(renderer.labels.get('ref')?.href).toBe('https://nested.example');
        jsonState.apply(json1.removeOp([0]));
        renderer.collectReferenceDefinitions();
        expect(renderer.labels.size).toBe(0);
    });
});
