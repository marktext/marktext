// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import * as json1 from 'ot-json1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InlineRenderer from '..';
import JSONState from '../../state';

function makeRenderer(blocks: TState[]) {
    const muya = {
        options: {
            footnote: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
            texMathDollars: false,
            listIndentation: 1,
        },
        eventCenter: { emit: () => {} },
    } as unknown as Muya;
    const jsonState = new JSONState(muya, blocks);
    Object.assign(muya, { editor: { jsonState } });
    const renderer = new InlineRenderer(muya);

    return { jsonState, renderer };
}

function collect(renderer: InlineRenderer) {
    // Exercise the cache directly so token rendering does not obscure state reads.
    // @ts-expect-error -- intentional coverage of the private collection boundary.
    renderer._collectReferenceDefinitions();
}

afterEach(() => vi.restoreAllMocks());

describe('reference definition collection cache', () => {
    it('scans document state once per revision', () => {
        const { jsonState, renderer } = makeRenderer([
            { name: 'paragraph', text: '[ref]: https://first.example' },
            { name: 'paragraph', text: '[label][ref]' },
        ]);
        const getState = vi.spyOn(jsonState, 'rawState', 'get');

        collect(renderer);
        collect(renderer);

        expect(getState).toHaveBeenCalledTimes(1);
        expect(renderer.labels.get('ref')?.href).toBe('https://first.example');
    });

    it('recollects after document replacement and applied edits', () => {
        const { jsonState, renderer } = makeRenderer([
            { name: 'paragraph', text: '[ref]: https://first.example' },
        ]);
        const initialRevision = jsonState.revision;

        collect(renderer);
        jsonState.setContent([
            { name: 'paragraph', text: '[ref]: https://second.example' },
        ]);
        expect(jsonState.revision).toBe(initialRevision + 1);

        const getState = vi.spyOn(jsonState, 'rawState', 'get');
        collect(renderer);
        collect(renderer);
        expect(getState).toHaveBeenCalledTimes(1);
        expect(renderer.labels.get('ref')?.href).toBe('https://second.example');

        jsonState.dispatch(
            json1.replaceOp(
                [0, 'text'],
                '[ref]: https://second.example',
                '[ref]: https://third.example',
            ),
        );
        expect(jsonState.revision).toBe(initialRevision + 2);

        getState.mockClear();
        collect(renderer);
        collect(renderer);
        expect(getState).toHaveBeenCalledTimes(1);
        expect(renderer.labels.get('ref')?.href).toBe('https://third.example');
    });
    it('scans deeply nested definitions without cloning or recursing', () => {
        let state: TState = { name: 'paragraph', text: '[ref]: https://deep.example' };
        for (let i = 0; i < 10000; i++)
            state = { name: 'block-quote', children: [state] };
        const { jsonState, renderer } = makeRenderer([state]);
        const getState = vi.spyOn(jsonState, 'getState');
        collect(renderer);
        expect(renderer.labels.get('ref')?.href).toBe('https://deep.example');
        expect(getState).not.toHaveBeenCalled();
    });

    it('keeps traversal order and invalidates deleted definitions but not null operations', () => {
        const { jsonState, renderer } = makeRenderer([
            { name: 'block-quote', children: [{ name: 'paragraph', text: '[ref]: https://nested.example' }] },
            { name: 'paragraph', text: '[ref]: https://last.example' },
        ]);
        collect(renderer);
        expect(renderer.labels.get('ref')?.href).toBe('https://last.example');
        const revision = jsonState.revision;
        const scan = vi.spyOn(jsonState, 'rawState', 'get');
        jsonState.dispatch(null);
        collect(renderer);
        expect(scan).not.toHaveBeenCalled();
        expect(jsonState.revision).toBe(revision);
        jsonState.dispatch(json1.removeOp([1]));
        collect(renderer);
        expect(renderer.labels.get('ref')?.href).toBe('https://nested.example');
        jsonState.dispatch(json1.removeOp([0]));
        collect(renderer);
        expect(renderer.labels.size).toBe(0);
    });
});
