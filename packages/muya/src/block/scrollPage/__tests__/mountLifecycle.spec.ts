// @vitest-environment happy-dom

import type { TState } from '../../../state/types';
import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { takeByWeight } from '..';
import { Muya } from '../../../muya';

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

function paragraphs(count = 600): TState[] {
    return Array.from({ length: count }, (_, i) => ({ name: 'paragraph', text: `Paragraph ${i}` }));
}

function boot(json = paragraphs()) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { json } as ConstructorParameters<typeof Muya>[1]);
    instances.push(muya);
    muya.init();
    return muya;
}

function list(items = 2): TState {
    return {
        name: 'order-list',
        meta: { start: 1, loose: false, delimiter: '.', sourceMarkers: Array.from({ length: items }, (_, i) => `${i + 1}.`) },
        children: Array.from({ length: items }, (_, i) => ({
            name: 'list-item',
            children: [{ name: 'paragraph', text: `Item ${i}` }],
        })),
    } as TState;
}

interface IListMeta { meta: { sourceMarkers: string[] } }

function mount(muya: Muya, mode: string) {
    const page = muya.editor.scrollPage!;
    if (mode === 'partial')
        page.ensureMountedThrough(550);
    else if (mode === 'complete')
        page.flushPendingMount();
    else
        (page as unknown as { _mountNextChunk: () => void })._mountNextChunk();
}

describe('progressive mount isolation and lifecycle', () => {
    it('isolates array metadata when materializing an unmounted tail', () => {
        const json = paragraphs();
        json[550] = list();
        const muya = boot(json);
        const page = muya.editor.scrollPage!;
        page.ensureMountedThrough(550);
        const block = page.find(550) as unknown as IListMeta;
        const state = muya.editor.jsonState.rawState[550] as unknown as IListMeta;
        block.meta.sourceMarkers[0] = '99.';
        expect(state.meta.sourceMarkers[0]).toBe('1.');
    });

    it('keeps a lazy event snapshot isolated from later mounted-block metadata edits', () => {
        const json = paragraphs();
        json[550] = list();
        const muya = boot(json);
        let payload: { doc: TState[] } | undefined;
        muya.once('json-change', (...args: unknown[]) => {
            payload = args[0] as typeof payload;
        });
        muya.editor.updateContents(json1.editOp([0, 'text'], 'text-unicode', [11, '!']), null, 'api');
        muya.editor.scrollPage!.ensureMountedThrough(550);
        const block = muya.editor.scrollPage!.find(550) as unknown as IListMeta;
        block.meta.sourceMarkers[0] = '99.';
        expect((payload!.doc[550] as unknown as IListMeta).meta.sourceMarkers[0]).toBe('1.');
    });

    it.each(['partial', 'complete', 'background'])('does not continue a %s mount after flush listeners destroy the editor', (mode) => {
        const muya = boot();
        const page = muya.editor.scrollPage!;
        const first = page.firstContentInDescendant()!;
        first.text = 'pending edit';
        let destroyed = false;
        muya.once('json-change', () => {
            muya.destroy();
            destroyed = true;
        });
        const before = page.children.length;
        mount(muya, mode);
        expect(destroyed).toBe(true);
        expect(page.children.length).toBe(before);
        expect(muya.eventCenter.events).toHaveLength(0);
    });

    it.each(['partial', 'complete', 'background'])('does not apply an old %s mount request to a replacement document during flush', (mode) => {
        const muya = boot();
        const page = muya.editor.scrollPage!;
        page.firstContentInDescendant()!.text = 'pending edit';
        muya.once('json-change', () => {
            muya.setContent(paragraphs(700));
        });
        mount(muya, mode);
        expect(muya.editor.jsonState.rawState).toHaveLength(700);
        expect(page.children.length).toBe(512);
    });

    it('resolves prefix references using definitions in the unmounted tail', () => {
        const json = paragraphs();
        json[0] = { name: 'paragraph', text: '[link][tail]' };
        json[599] = { name: 'paragraph', text: '[tail]: https://example.com/target' };
        const muya = boot(json);
        expect(muya.editor.scrollPage!.children.length).toBe(512);
        expect(muya.domNode.querySelector('a')?.getAttribute('href')).toBe('https://example.com/target');
    });

    it('characterizes the atomic-block limit: one large list mounts completely synchronously', () => {
        const muya = boot([list(600)]);
        expect(muya.domNode.querySelectorAll('li')).toHaveLength(600);
        expect(muya.editor.scrollPage!.children.length).toBe(1);
    });

    it.each(['json-change', 'muya-mount-progress', 'muya-mount-complete'])('cancels an operation if %s replaces the document during preparation', (event) => {
        const muya = boot();
        if (event === 'json-change')
            muya.editor.scrollPage!.firstContentInDescendant()!.text = 'pending';
        muya.once(event, () => muya.setContent(paragraphs(700)));
        const index = event === 'muya-mount-complete' ? 599 : 550;
        const text = `Paragraph ${index}`;
        muya.editor.updateContents(json1.editOp([index, 'text'], 'text-unicode', [text.length, '!']), null, 'api');
        expect(muya.getState()).toEqual(paragraphs(700));
        expect(muya.editor.scrollPage!.children.length).toBe(512);
        vi.runAllTimers();
        expect(muya.editor.scrollPage!.children.length).toBe(700);
    });

    it('cancels an operation when a progress listener destroys the editor', () => {
        const muya = boot();
        muya.once('muya-mount-progress', () => muya.destroy());
        muya.editor.updateContents(json1.editOp([550, 'text'], 'text-unicode', [13, '!']), null, 'api');
        expect(muya.getState()).toEqual(paragraphs());
        expect(muya.eventCenter.events).toHaveLength(0);
    });

    it('does not resolve a stale query in a replacement document', () => {
        const muya = boot();
        muya.once('muya-mount-progress', () => muya.setContent(paragraphs(700)));
        expect(muya.editor.scrollPage!.queryBlock([550])).toBeUndefined();
        expect(muya.editor.scrollPage!.children.length).toBe(512);
    });

    it.each(['muya-mount-progress', 'muya-mount-complete'])('does not restore stale source or history if %s replaces the document during cursor resolution', (event) => {
        const muya = boot();
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'edited';
        muya.flush();
        expect(muya.getHistory().stack.undo.length).toBeGreaterThan(0);
        muya.once(event, () => muya.setContent('replacement'));
        const line = event === 'muya-mount-complete' ? 1198 : 1100;
        expect(muya.setCursorByOffset({ anchor: { line, ch: 1 }, focus: { line, ch: 1 } })).toBe(false);
        expect(muya.getMarkdown().trim()).toBe('replacement');
        expect(muya.getHistory().stack.undo).toHaveLength(0);
    });

    it('does not rebuild a destroyed editor during cursor resolution', () => {
        const muya = boot();
        const replace = vi.spyOn(muya.editor, 'setContent');
        muya.once('muya-mount-progress', () => muya.destroy());
        expect(muya.setCursorByOffset({ anchor: { line: 1100, ch: 1 }, focus: { line: 1100, ch: 1 } })).toBe(false);
        expect(replace).toHaveBeenCalledTimes(1);
        expect(muya.eventCenter.events).toHaveLength(0);
    });

    it('reports cancellation if the final cursor mount replaces the cleaned document', () => {
        const muya = boot();
        let progress = 0;
        muya.on('muya-mount-progress', () => {
            if (++progress === 2)
                muya.setContent('replacement');
        });
        expect(muya.setCursorByOffset({ anchor: { line: 1100, ch: 1 }, focus: { line: 1100, ch: 1 } })).toBe(false);
        expect(muya.getMarkdown().trim()).toBe('replacement');
    });

    it.each(['replace', 'destroy'])('does not set an old anchor after %s while resolving the focus in the tail', (action) => {
        const muya = boot();
        const oldAnchor = muya.editor.scrollPage!.firstContentInDescendant()!;
        const setCursor = vi.spyOn(oldAnchor, 'setCursor');
        muya.once('muya-mount-progress', () => {
            if (action === 'replace')
                muya.setContent('replacement');
            else
                muya.destroy();
        });
        expect(() => muya.setCursor({
            anchorPath: [0, 'text'],
            focusPath: [550, 'text'],
            anchor: { offset: 1 },
            focus: { offset: 2 },
        })).not.toThrow();
        expect(setCursor).not.toHaveBeenCalled();
        if (action === 'replace')
            expect(muya.getMarkdown().trim()).toBe('replacement');
    });

    it('accepts completion of the same mount by a progress listener', () => {
        const muya = boot();
        const complete = vi.fn();
        muya.on('muya-mount-complete', complete);
        muya.once('muya-mount-progress', () => muya.editor.scrollPage!.flushPendingMount());
        expect(muya.ensureMountedThrough(550)).toBe(true);
        expect(muya.editor.scrollPage!.children.length).toBe(600);
        vi.runAllTimers();
        expect(complete).toHaveBeenCalledTimes(1);
    });

    it('schedules only one continuation when a progress listener mounts farther', () => {
        const muya = boot();
        const schedule = vi.spyOn(globalThis, 'setTimeout');
        let extended = false;
        muya.on('muya-mount-progress', () => {
            if (!extended) {
                extended = true;
                muya.ensureMountedThrough(575);
            }
        });
        muya.ensureMountedThrough(550);
        expect(muya.editor.scrollPage!.children.length).toBe(576);
        expect(schedule).toHaveBeenCalledTimes(1);
        vi.runAllTimers();
        expect(muya.editor.scrollPage!.children.length).toBe(600);
    });

    it('finishes only the replacement mount after a progress callback changes documents', () => {
        const muya = boot();
        const totals: number[] = [];
        muya.on('muya-mount-complete', (...args: unknown[]) => totals.push((args[0] as { total: number }).total));
        muya.once('muya-mount-progress', () => muya.setContent(paragraphs(700)));
        expect(muya.ensureMountedThrough(550)).toBe(false);
        vi.runAllTimers();
        expect(totals).toEqual([700]);
    });

    it('reports completion once without changing the logical revision', () => {
        const muya = boot();
        const state = muya.editor.jsonState;
        const root = state.rawState;
        const revision = state.revision;
        const complete = vi.fn();
        muya.on('muya-mount-complete', complete);
        vi.runAllTimers();
        muya.editor.scrollPage!.flushPendingMount();
        expect(complete).toHaveBeenCalledExactlyOnceWith({ total: 600 });
        expect(state.rawState).toBe(root);
        expect(state.revision).toBe(revision);
    });

    it.each(['short', ''])('cancels the old completion notification when replaced with %j', (markdown) => {
        const muya = boot();
        const complete = vi.fn();
        muya.on('muya-mount-complete', complete);
        muya.setContent(markdown);
        vi.runAllTimers();
        expect(complete).not.toHaveBeenCalled();
        expect(muya.editor.scrollPage!.children.length).toBe(1);
    });

    it('counts deeply nested state without recursion and stops at its budget', () => {
        let node: TState = { name: 'paragraph', text: 'deep' };
        for (let i = 0; i < 10000; i++)
            node = { name: 'block-quote', children: [node] };
        expect(takeByWeight([node, ...paragraphs(1)], 0, 512)).toBe(1);
        expect(takeByWeight([node, ...paragraphs(1)], 0, Infinity)).toBe(2);
        const unreachable = {
            name: 'block-quote',
            get children(): TState[] { throw new Error('budget already exhausted'); },
        } as TState;
        expect(takeByWeight([...paragraphs(511), unreachable], 0, 512)).toBe(512);
        expect(takeByWeight([], 0, 512)).toBe(0);
        expect(takeByWeight(paragraphs(600), 512, 20)).toBe(532);
    });
});
