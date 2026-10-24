import type { IJSONChangePayload } from '../../state/changePayload';

import type { IBulletListState, TState } from '../../state/types';
import * as json1 from 'ot-json1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import History from '../../history';
import { Muya } from '../../muya';
import JSONState, { asDoc } from '../../state';
import { MarkdownToState } from '../../state/markdownToState';
// @vitest-environment happy-dom
import { defaultCodeSyntax } from '../../state/syntax';
import { ChangeSource } from '../../types';

const instances: Muya[] = [];

afterEach(() => {
    for (const muya of instances.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
});

function boot(markdown = '- a\n- c\n') {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, preferLooseListItem: false });
    instances.push(muya);
    muya.init();
    muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
    return muya;
}

function paragraph(text = 'b') {
    return json1.insertOp([0, 'children', 0, 'children', 1], asDoc({ name: 'paragraph', text }));
}

function liveState(muya: Muya) {
    return muya.editor.scrollPage!.children.map((block) => {
        if (!block.isParent())
            throw new Error('Expected a document block');
        return block.getState();
    });
}

function expectConsistent(muya: Muya, loose: boolean) {
    expect(liveState(muya)).toEqual(muya.getState());
    expect((muya.getState()[0] as IBulletListState).meta.loose).toBe(loose);
    expect(muya.domNode.querySelector('ul')!.classList.contains('mu-tight-list')).toBe(!loose);
}

describe('completed edit transactions', () => {
    it.each([false, true])('renders inserted reference links against their document (scoped: %s)', (scoped) => {
        const muya = boot('seed\n');
        const operation = json1.type.compose(
            json1.insertOp([1], asDoc({ name: 'paragraph', text: '[ref]: https://example.com' })),
            json1.insertOp([2], asDoc({ name: 'paragraph', text: '[label][ref]' })),
        );
        const apply = () => muya.editor.updateContents(operation, null, ChangeSource.Api);
        if (scoped)
            muya.transact(apply);
        else
            apply();
        expect(liveState(muya)).toEqual(muya.getState());
        expect(muya.domNode.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    });

    it('rejects setContent inside a scope before changing the document or history', () => {
        const muya = boot();
        muya.insertParagraph('after', 'b');
        const before = muya.getState();
        const history = muya.getHistory();
        const change = vi.fn();
        muya.on('json-change', change);
        expect(() => muya.transact(() => muya.setContent('replacement\n'))).toThrow('cannot run inside an edit transaction');
        expect(muya.getState()).toEqual(before);
        expect(liveState(muya)).toEqual(before);
        expect(muya.getHistory()).toEqual(history);
        expect(change).not.toHaveBeenCalled();
    });

    it('preserves API source and user-only history policy inside a scope', () => {
        const muya = boot('seed\n');
        const userHistory = new History(muya, { userOnly: true, maxStack: 100, delay: 1000 });
        const changes: IJSONChangePayload[] = [];
        muya.on('json-change', (change: IJSONChangePayload) => changes.push(change));
        muya.transact(() => {
            muya.editor.updateContents(json1.insertOp([1], asDoc({ name: 'paragraph', text: 'api' })), null, ChangeSource.Api);
        });
        expect(changes.map(change => change.source)).toEqual([ChangeSource.Api]);
        expect(userHistory.getHistory().stack.undo).toHaveLength(0);
    });

    it.each([false, true])('treats mixed API and Block edits as a user command (API first: %s)', (apiFirst) => {
        const muya = boot('seed\n');
        const before = muya.getState();
        const changes: IJSONChangePayload[] = [];
        muya.on('json-change', (change: IJSONChangePayload) => changes.push(change));
        const api = () => muya.editor.updateContents(json1.insertOp([1], asDoc({ name: 'paragraph', text: 'api' })), null, ChangeSource.Api);
        const user = () => {
            muya.editor.scrollPage!.firstContentInDescendant()!.text = 'user';
        };
        muya.transact(() => {
            (apiFirst ? api : user)();
            muya.transact(apiFirst ? user : api);
        });
        expect(changes.map(change => change.source)).toEqual([ChangeSource.User]);
        expect(liveState(muya)).toEqual(muya.getState());
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it('refreshes reference definitions between provisional edits and after rollback', () => {
        const muya = boot('[ref]: https://first.example\n\n[label][ref]\n');
        const replace = (before: string, after: string) => {
            muya.editor.updateContents(json1.editOp([0, 'text'], 'text-unicode', [{ d: `[ref]: ${before}` }, `[ref]: ${after}`]), null, ChangeSource.Api);
        };
        expect(() => muya.transact(() => {
            replace('https://first.example', 'https://second.example');
            expect(muya.domNode.querySelector('a')?.getAttribute('href')).toBe('https://second.example');
            replace('https://second.example', 'https://third.example');
            expect(muya.domNode.querySelector('a')?.getAttribute('href')).toBe('https://third.example');
            throw new Error('abort');
        })).toThrow('abort');
        expect(muya.domNode.querySelector('a')?.getAttribute('href')).toBe('https://first.example');
        expect(liveState(muya)).toEqual(muya.getState());
        expect(muya.getHistory().stack.undo).toHaveLength(0);
    });

    it('rejects reparsing options inside a scope before changing options or state', () => {
        const muya = boot();
        const before = muya.getState();
        const frontMatter = muya.options.frontMatter;
        expect(() => muya.transact(() => muya.setOptions({ frontMatter: !frontMatter }, true))).toThrow('cannot run inside an edit transaction');
        expect(muya.options.frontMatter).toBe(frontMatter);
        expect(muya.getState()).toEqual(before);
        expect(liveState(muya)).toEqual(before);
    });

    it.each(['options', 'locale'])('flushes pending edits before a %s rebuild and keeps subsequent edits consistent', (refresh) => {
        const muya = boot('seed\n');
        const content = muya.editor.scrollPage!.firstContentInDescendant()!;
        content.text = 'changed';
        content.update();
        if (refresh === 'options')
            muya.setOptions({ codeBlockLineNumbers: true }, true);
        else
            muya.locale({ name: 'review-test', resource: {} });
        muya.flush();
        expect(muya.getMarkdown()).toBe('changed\n');
        expect(liveState(muya)).toEqual(muya.getState());
        expect(muya.domNode.querySelector('.mu-paragraph-content')!.textContent).toBe('changed');
        expect(muya.getHistory().stack.undo).toHaveLength(1);

        muya.editor.history.cutoff();
        const rebuilt = muya.editor.scrollPage!.firstContentInDescendant()!;
        rebuilt.text += '!';
        rebuilt.update();
        muya.flush();
        expect(muya.getMarkdown()).toBe('changed!\n');
        expect(liveState(muya)).toEqual(muya.getState());
        expect(muya.domNode.querySelector('.mu-paragraph-content')!.textContent).toBe('changed!');
        muya.undo();
        expect(muya.getMarkdown()).toBe('changed\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe('seed\n');
    });

    it.each(['options', 'locale'])('rejects a scoped %s rebuild before changing configuration', (refresh) => {
        const muya = boot('seed\n');
        const before = muya.getState();
        const options = { ...muya.options };
        const language = muya.i18n.lang;
        const change = vi.fn();
        muya.on('json-change', change);
        expect(() => muya.transact(() => {
            const content = muya.editor.scrollPage!.firstContentInDescendant()!;
            content.text = 'changed';
            content.update();
            if (refresh === 'options')
                muya.setOptions({ codeBlockLineNumbers: !options.codeBlockLineNumbers }, true);
            else
                muya.locale({ name: 'review-test', resource: {} });
        })).toThrow('cannot run inside an edit transaction');
        expect(muya.options).toEqual(options);
        expect(muya.i18n.lang).toBe(language);
        expect(muya.getState()).toEqual(before);
        expect(liveState(muya)).toEqual(before);
        expect(muya.domNode.querySelector('.mu-paragraph-content')!.textContent).toBe('seed');
        expect(muya.getHistory().stack.undo).toHaveLength(0);
        expect(change).not.toHaveBeenCalled();
    });

    it('rolls back a locked document without enabling user edits or publishing a change', () => {
        const muya = boot('seed\n');
        const before = muya.getState();
        const revision = muya.editor.jsonState.revision;
        const change = vi.fn();
        muya.on('json-change', change);
        expect(() => muya.transact(() => {
            const content = muya.editor.scrollPage!.firstContentInDescendant()!;
            content.text = 'changed';
            content.update();
            muya.setReadOnly(true);
            throw new Error('abort locked command');
        })).toThrow('abort locked command');
        expect(muya.getState()).toEqual(before);
        expect(liveState(muya)).toEqual(before);
        expect(muya.domNode.querySelector('.mu-paragraph-content')!.textContent).toBe('seed');
        expect(muya.isReadOnly).toBe(true);
        expect(muya.canMutate).toBe(false);
        expect(muya.editor.jsonState.revision).toBe(revision);
        expect(muya.getHistory().stack.undo).toHaveLength(0);
        expect(change).not.toHaveBeenCalled();
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'blocked';
        muya.flush();
        expect(liveState(muya)).toEqual(before);
    });

    it('commits nested Block commands and API operations once, with a complete history operation', () => {
        const muya = boot();
        const before = muya.getState();
        const apply = vi.spyOn(muya.editor.jsonState, 'apply');
        const changes: IJSONChangePayload[] = [];
        const listener = (payload: IJSONChangePayload) => {
            expectConsistent(muya, true);
            changes.push(payload);
        };
        muya.on('json-change', listener);
        muya.transact(() => {
            muya.insertParagraph('after', 'b');
            muya.transact(() => {
                muya.editor.updateContents(
                    json1.insertOp([0, 'children', 1, 'children', 1], asDoc({ name: 'paragraph', text: 'd' })),
                    null,
                    ChangeSource.User,
                );
            });
            expect(apply).not.toHaveBeenCalled();
            expect(changes).toHaveLength(0);
        });
        expect(apply).toHaveBeenCalledOnce();
        expect(apply.mock.calls[0][0]).toEqual(changes[0].op);
        expect(json1.type.apply(asDoc(before), changes[0].op)).toEqual(muya.getState());
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        muya.off('json-change', listener);
        const after = muya.getState();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(after);
    });

    it('does not normalize a temporary structure within a mixed API and Block transaction', () => {
        const muya = boot();
        const before = muya.getState();
        const revision = muya.editor.jsonState.revision;
        const change = vi.fn();
        muya.on('json-change', change);
        muya.transact(() => {
            muya.editor.updateContents(paragraph(), null, ChangeSource.User);
            const block = muya.editor.scrollPage!.queryBlock([0, 'children', 0, 'children', 1]);
            block!.remove();
        });
        expectConsistent(muya, false);
        expect(muya.getState()).toEqual(before);
        expect(muya.editor.jsonState.revision).toBe(revision);
        expect(change).not.toHaveBeenCalled();
    });

    it('does not let an explicit flush split an active transaction', () => {
        const muya = boot();
        const change = vi.fn();
        muya.on('json-change', change);
        muya.transact(() => {
            muya.insertParagraph('after', 'b');
            muya.flush();
            expect(change).not.toHaveBeenCalled();
            muya.insertParagraph('after', 'd');
        });
        expect(change).toHaveBeenCalledOnce();
        expectConsistent(muya, true);
    });

    it('rejects nested history navigation before changing either history stack', () => {
        const muya = boot();
        muya.insertParagraph('after', 'b');
        const before = muya.getState();
        const history = muya.getHistory();
        expect(() => muya.transact(() => muya.undo())).toThrow('cannot run inside an edit transaction');
        expect(muya.getState()).toEqual(before);
        expect(muya.getHistory()).toEqual(history);
        expectConsistent(muya, true);
    });

    it('rolls back a failed command without a partial document, event, or history entry', () => {
        const muya = boot();
        const before = muya.getState();
        const revision = muya.editor.jsonState.revision;
        const change = vi.fn();
        muya.on('json-change', change);
        expect(() => muya.transact(() => {
            muya.insertParagraph('after', 'b');
            throw new Error('abort command');
        })).toThrow('abort command');
        expect(muya.getState()).toEqual(before);
        expectConsistent(muya, false);
        expect(muya.editor.jsonState.revision).toBe(revision);
        expect(muya.getHistory().stack.undo).toHaveLength(0);
        expect(change).not.toHaveBeenCalled();
        muya.editor.updateContents(paragraph(), null, ChangeSource.User);
        expectConsistent(muya, true);
    });

    it('aborts the outer scope even when a nested command exception is caught', () => {
        const muya = boot();
        const before = muya.getState();
        expect(() => muya.transact(() => {
            try {
                muya.transact(() => {
                    muya.insertParagraph('after', 'b');
                    throw new Error('nested failure');
                });
            }
            catch {}
        })).toThrow('nested failure');
        expect(muya.getState()).toEqual(before);
        expectConsistent(muya, false);
    });

    it('flushes an earlier live edit before an independent API transaction', () => {
        const muya = boot();
        const observed: TState[][] = [];
        muya.on('json-change', (payload: IJSONChangePayload) => {
            expect(liveState(muya)).toEqual(payload.doc);
            observed.push(payload.doc);
        });
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'changed';
        muya.editor.updateContents(paragraph(), null, ChangeSource.Api);
        expect(observed).toHaveLength(2);
        expect((observed[0][0] as IBulletListState).children[0].children).toEqual([{ name: 'paragraph', text: 'changed' }]);
        expectConsistent(muya, true);
    });

    it('lets event listeners start a new transaction after both representations are committed', () => {
        const muya = boot();
        const observed: IJSONChangePayload[] = [];
        muya.on('json-change', (payload: IJSONChangePayload) => {
            expect(liveState(muya)).toEqual(payload.doc);
            observed.push(payload);
            if (observed.length === 1)
                muya.editor.updateContents(json1.insertOp([1], asDoc({ name: 'paragraph', text: 'next' })), null, ChangeSource.Api);
        });
        muya.insertParagraph('after', 'b');
        expect(observed).toHaveLength(2);
        expect(observed[1].prevDoc).toEqual(observed[0].doc);
        expect(liveState(muya)).toEqual(muya.getState());
    });

    it('replays undo and redo without running editing rules again', () => {
        const muya = boot();
        const parse = vi.spyOn(MarkdownToState.prototype, 'generate');
        muya.editor.updateContents(json1.insertOp([0, 'children', 0, 'children', 1], asDoc({
            name: 'code-block',
            meta: { lang: '' },
            syntax: defaultCodeSyntax('x'),
            text: 'x',
        })), null, ChangeSource.User);
        expect(parse).toHaveBeenCalled();
        const after = muya.getState();
        parse.mockClear();
        muya.setOptions({ preferLooseListItem: true });
        muya.undo();
        muya.redo();
        expect(parse).not.toHaveBeenCalled();
        expect(muya.getState()).toEqual(after);
        expectConsistent(muya, false);
    });

    it('records the completed operation for a whole-document replacement', () => {
        const muya = boot();
        const before = muya.getState();
        const target = muya.getState();
        (target[0] as IBulletListState).children[0].children.push({ name: 'paragraph', text: 'b' });
        expect(muya.replaceContent(target)).toBe(true);
        const after = muya.getState();
        expectConsistent(muya, true);
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(after);
        expectConsistent(muya, true);
    });

    it('can replay a completed operation while still recording its history policy', () => {
        const muya = boot();
        const parse = vi.spyOn(MarkdownToState.prototype, 'generate');
        muya.editor.transactions.apply(json1.insertOp([0, 'children', 0, 'children', 1], asDoc({
            name: 'code-block',
            meta: { lang: '' },
            syntax: defaultCodeSyntax('x'),
            text: 'x',
        })), { replay: true, source: ChangeSource.Api });
        expect(parse).not.toHaveBeenCalled();
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        expectConsistent(muya, false);
    });

    it('keeps JSONState.apply literal and independent of editor rules and notifications', () => {
        const muya = boot();
        const state = new JSONState(muya, muya.getState());
        const input = paragraph();
        const original = structuredClone(input);
        const change = vi.fn();
        muya.on('json-change', change);
        state.apply(input);
        const list = state.getState()[0] as IBulletListState;
        expect(list.children[0].children).toHaveLength(2);
        expect(list.meta.loose).toBe(false);
        expect(input).toEqual(original);
        expect(change).not.toHaveBeenCalled();
    });
});
