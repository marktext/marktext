import type Format from '../block/base/format';
import type ParagraphContent from '../block/content/paragraphContent';
import type { Muya } from '../muya';
import type { IRenderCursor } from '../selection/types';
import type { IParagraphState, TState } from '../state/types';
import type { IHighlight, Labels } from './types';
import { prepareReadingLinks } from '../editor/readOnly';
import logger from '../utils/logger';
import { tokenizer } from './lexer';
import Renderer from './renderer';
import { beginRules } from './rules';

const debug = logger('inlineRenderer:');

class InlineRenderer {
    public labels: Labels = new Map();
    public renderer: Renderer;
    private _labelsState: readonly TState[] | null = null;

    constructor(public muya: Muya) {
        this.renderer = new Renderer(muya, this);
    }

    private _tokenizer(block: Format, highlights: IHighlight[]) {
        const { options } = this.muya;
        const { text } = block;
        const { labels } = this;

        // TODO: different content block should have different rules.
        // eg: atxheading.content has no soft|hard line break
        // setextheading.content has no heading rules.
        const hasBeginRules
            = /thematicbreak\.content|paragraph\.content|atxheading\.content/.test(
                block.blockName,
            );

        return tokenizer(text, { hasBeginRules, labels, options, highlights });
    }

    /**
     * Flush every cached image and force inline images to reload.
     *
     * The renderer memoises loaded images in `loadImageMap` (keyed by src,
     * skipped on the next render once `isSuccess` is true) and resolved URLs
     * in `urlMap`. When an image file changes on disk the cached entry would
     * otherwise keep the stale bitmap, so clearing both maps and re-rendering
     * every content block re-runs `loadImageAsync`, which loads the source
     * afresh.
     */
    invalidateImageCache() {
        this.renderer.loadImageMap.clear();
        this.renderer.urlMap.clear();

        const { scrollPage } = this.muya.editor;
        if (!scrollPage)
            return;

        scrollPage.breadthFirstTraverse((node) => {
            if (node.isContent())
                node.update();
        });
    }

    patch(block: Format, cursor?: IRenderCursor, highlights: IHighlight[] = []) {
        this.labels = this.collectReferenceDefinitions();
        const { domNode } = block;
        if (block.isParent())
            debug.error('Patch can only handle content block');

        const tokens = this._tokenizer(block, highlights);
        const renderCursor = !this.muya.isReadOnly && cursor?.block === block ? cursor : {};
        const html = this.renderer.output(tokens, block, renderCursor);
        domNode!.innerHTML = html;

        if (this.muya.isReadOnly)
            prepareReadingLinks(domNode!);
    }

    // Definitions live in paragraphs across the document; rescanning for every block caused #4887.
    collectReferenceDefinitions(): Labels {
        const state = this.muya.editor.transactions.candidateState;
        if (this._labelsState === state)
            return this.labels;

        const labels = new Map();
        const stack: Iterator<TState>[] = [state[Symbol.iterator]()];
        while (stack.length) {
            const next = stack[stack.length - 1].next();
            if (next.done) {
                stack.pop();
                continue;
            }
            const state = next.value;
            if (state.name === 'paragraph') {
                const { label, info } = this.getLabelInfo(state);
                if (label && info && !labels.has(label))
                    labels.set(label, info);
            }
            else if ('children' in state && Array.isArray(state.children)) {
                stack.push(state.children[Symbol.iterator]());
            }
        }

        this.labels = labels;
        this._labelsState = state;
        return labels;
    }

    getLabelInfo(blockOrState: ParagraphContent | IParagraphState) {
        const { text } = blockOrState;
        const tokens = beginRules.reference_definition.exec(text);
        let label = null;
        let info = null;
        if (tokens) {
            label = (tokens[2] + tokens[3]).toLowerCase();
            info = {
                href: tokens[6],
                title: tokens[10] || '',
            };
        }

        return { label, info };
    }
}

export default InlineRenderer;
