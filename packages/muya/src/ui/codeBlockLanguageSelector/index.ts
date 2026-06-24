import type { VNode } from 'snabbdom';
import type LangInputContent from '../../block/content/langInputContent';
import type ParagraphContent from '../../block/content/paragraphContent';
import type { Muya } from '../../index';
import { ScrollPage } from '../../block/scrollPage';
import { search } from '../../utils/prism';

import { h, patch } from '../../utils/snabbdom';
import BaseScrollFloat from '../baseScrollFloat';
import fileIcons from '../utils/fileIcons';

import './index.css';

const defaultOptions = {
    placement: 'bottom-start' as const,
    offsetOptions: {
        mainAxis: 0,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

const DIAGRAM_LANGS = new Set(['mermaid', 'vega-lite', 'plantuml', 'flowchart', 'sequence']);

// The language the user actually typed after the ``` fence. The selector's
// fuzzy search may resolve a non-code language (e.g. `vega-lite`) to an
// unrelated Prism language, so the diagram check keys off this raw text.
function typedFenceLang(text: string): string {
    return text.match(/`{3,}\s*([\w-]+)/)?.[1] ?? '';
}

// Build the state for the block a ```lang fence becomes. Diagram languages
// (from the typed text) become a diagram block, mirroring markdownToState's
// file-load path; GitLab math becomes a math-block; everything else a fenced
// code block highlighted with the selector's matched language.
function newBlockStateForLang(typedLang: string, matchedLang: string, isGitlabMath: boolean) {
    if (isGitlabMath)
        return { name: 'math-block', meta: { mathStyle: 'gitlab' }, text: '' };

    if (DIAGRAM_LANGS.has(typedLang)) {
        return {
            name: 'diagram',
            meta: { type: typedLang, lang: typedLang === 'vega-lite' ? 'json' : 'yaml' },
            text: '',
        };
    }

    return { name: 'code-block', meta: { lang: matchedLang, type: 'fenced' }, text: '' };
}

export class CodeBlockLanguageSelector extends BaseScrollFloat {
    static pluginName = 'codePicker';
    public override capturesContentKeydown = true;
    private _oldVNode: VNode | null = null;
    private _block: ParagraphContent | LangInputContent | null = null;

    constructor(muya: Muya, options = {}) {
        const name = 'mu-list-picker';
        const opts = Object.assign({}, defaultOptions, options);
        super(muya, name, opts);
        this.listen();
    }

    override listen() {
        super.listen();
        const { eventCenter } = this.muya;

        eventCenter.on('content-change', ({ block }) => {
            if (block.blockName !== 'paragraph.content' && block.blockName !== 'language-input')
                return;

            const { text, domNode } = block;
            let lang = '';
            if (block.blockName === 'paragraph.content') {
                const token = text.match(/(^ {0,3}`{3,})([^` ]+)/);
                if (token && token[2])
                    lang = token[2];
            }
            else if (block.blockName === 'language-input') {
                lang = text;
            }

            const modes = search(lang);
            if (modes.length) {
                this._block = block;
                this.show(domNode);
                this.renderArray = modes;
                this.activeItem = modes[0];
                this.render();
            }
            else {
                this.hide();
            }
        });

        // Self-hide when the caret leaves the picker's target block (#4654).
        eventCenter.on('selection-change', ({ anchorBlock }) => {
            if (this.status && anchorBlock !== this._block)
                this.hide();
        });
    }

    render() {
        const { renderArray, _oldVNode: oldVNode, scrollElement, activeItem } = this;
        let children = (
            renderArray as {
                name: string;
                [key: string]: string;
            }[]
        ).map((item) => {
            let iconClassNames;
            if (item.name)
                iconClassNames = fileIcons.getClassByLanguage(item.name);

            // Because `markdown mode in Codemirror` don't have extensions.
            // if still can not get the className, add a common className 'atom-icon light-cyan'
            if (!iconClassNames && item.name === 'markdown')
                iconClassNames = fileIcons.getClassByName('fakeName.md');

            const text = h('div.language', item.name);
            const selector = activeItem === item ? 'li.item.active' : 'li.item';
            const itemContent = [text];

            if (iconClassNames) {
                const iconSelector
                    = `span${
                        iconClassNames
                            .split(/\s/)
                            .map((s: string) => `.${s}`)
                            .join('')}`;
                const icon = h('div.icon-wrapper', h(iconSelector));
                itemContent.push(icon);
            }

            return h(
                selector,
                {
                    dataset: {
                        label: item.name,
                    },
                    on: {
                        click: () => {
                            this.selectItem(item);
                        },
                    },
                },
                itemContent,
            );
        });

        if (children.length === 0)
            children = [h('div.no-result', 'No result')];

        const vnode = h('ul', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(scrollElement!, vnode);

        this._oldVNode = vnode;
    }

    getItemElement(item: { name: string }): HTMLElement {
        const { name } = item;

        // Item element will always existed, so use !.
        return this.floatBox!.querySelector(`[data-label="${name}"]`)!;
    }

    override selectItem(item: { name: string }) {
        const { _block: block, muya } = this;
        const { name } = item;

        if (!block)
            return;

        // Bail if the block was detached from the document while the picker
        // stayed open — mutating an orphaned block crashes on a null parent (#4654).
        if (!block.outMostBlock)
            return;

        function isParagraphContent(
            b: ParagraphContent | LangInputContent,
        ): b is ParagraphContent {
            return b.blockName === 'paragraph.content';
        }

        if (isParagraphContent(block)) {
            const isGitlabMath
                = muya.options.isGitlabCompatibilityEnabled && name === 'math';
            const state = newBlockStateForLang(typedFenceLang(block.text), name, isGitlabMath);

            const newBlock = ScrollPage.loadBlock(state.name).create(
                this.muya,
                state,
            );
            block.parent?.replaceWith(newBlock);
            const codeContent = newBlock.lastContentInDescendant();
            codeContent?.setCursor(0, 0);
        }
        else {
            const codeBlock = block.parent!;
            block.text = name;
            block.update();
            codeBlock.lang = name;
            codeBlock.lastContentInDescendant()?.setCursor(0, 0);
        }

        super.selectItem(item);
    }
}
