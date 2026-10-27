// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import * as json1 from 'ot-json1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InlineRenderer from '..';
import { EditTransactions } from '../../editor/transactions';
import JSONState from '../../state';
import { MarkdownToState } from '../../state/markdownToState';
import ExportMarkdown from '../../state/stateToMarkdown';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';

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
    const transactions = new EditTransactions(jsonState, () => muya.options, () => {}, () => {}, () => {});
    Object.assign(muya, { editor: { jsonState, transactions } });
    const renderer = new InlineRenderer(muya);

    return { jsonState, renderer };
}

afterEach(() => vi.restoreAllMocks());

describe('reference definition collection cache', () => {
    it('preserves duplicate definitions through round-trips while resolving the first one', () => {
        const markdown = '[link][ref]\n\n[REF]: https://first.example "First"\n[ref]: https://second.example "Second"\n';
        const parser = new MarkdownToState({ frontMatter: false, texMathDollars: false });
        const states = parser.generate(markdown);
        const output = new ExportMarkdown().generate(states);

        expect(output).toContain('[REF]: https://first.example "First"');
        expect(output).toContain('[ref]: https://second.example "Second"');

        for (const blocks of [states, parser.generate(output)]) {
            const { renderer } = makeRenderer(blocks);
            expect(renderer.collectReferenceDefinitions().get('ref')).toEqual({
                href: 'https://first.example',
                title: 'First',
            });
        }

        for (const render of [getClipBoardHtml, getHighlightHtml]) {
            expect(render(output)).toContain('<a href="https://first.example" title="First">link</a>');
            expect(render(output)).not.toContain('https://second.example');
        }
    });

    it('scans each immutable document snapshot once', () => {
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
        expect(renderer.labels.get('ref')?.href).toBe('https://nested.example');
        const revision = jsonState.revision;
        const scan = vi.spyOn(renderer, 'getLabelInfo');
        jsonState.apply(null);
        renderer.collectReferenceDefinitions();
        expect(scan).not.toHaveBeenCalled();
        expect(jsonState.revision).toBe(revision);
        jsonState.apply(json1.removeOp([0]));
        renderer.collectReferenceDefinitions();
        expect(renderer.labels.get('ref')?.href).toBe('https://last.example');
        jsonState.apply(json1.removeOp([0]));
        renderer.collectReferenceDefinitions();
        expect(renderer.labels.size).toBe(0);
    });
});
