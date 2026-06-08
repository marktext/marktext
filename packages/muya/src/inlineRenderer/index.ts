import type Format from '../block/base/format';
import type ParagraphContent from '../block/content/paragraphContent';
import type { Muya } from '../muya';
import type { ICursor } from '../selection/types';
import type { IParagraphState, TContainerState, TState } from '../state/types';
import type { IHighlight, Labels } from './types';
import logger from '../utils/logger';
import { tokenizer } from './lexer';
import Renderer from './renderer';
import { beginRules } from './rules';

const debug = logger('inlineRenderer:');

class InlineRenderer {
    public labels: Labels = new Map();
    public renderer: Renderer;

    constructor(public muya: Muya) {
        this.renderer = new Renderer(muya, this);
    }

    tokenizer(block: Format, highlights: IHighlight[]) {
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
     * afresh. Mirrors legacy muyajs `StateRender.invalidateImageCache`.
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

    patch(block: Format, cursor?: ICursor, highlights: IHighlight[] = []) {
        this.collectReferenceDefinitions();
        const { domNode } = block;
        if (block.isParent())
            debug.error('Patch can only handle content block');

        const tokens = this.tokenizer(block, highlights);
        const html = this.renderer.output(
            tokens,
            block,
            cursor && cursor.block === block ? cursor : {},
        );
        domNode!.innerHTML = html;
    }

    collectReferenceDefinitions() {
        const state = this.muya.editor.jsonState.getState();
        const labels = new Map();

        const travel = (sts: TState[]) => {
            if (Array.isArray(sts) && sts.length) {
                for (const st of sts) {
                    if (st.name === 'paragraph') {
                        const { label, info } = this.getLabelInfo(st);
                        if (label && info)
                            labels.set(label, info);
                    }
                    else if ((st as TContainerState).children) {
                        travel((st as TContainerState).children);
                    }
                }
            }
        };

        travel(state);

        this.labels = labels;
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
