import type { VNode } from 'snabbdom';
import type LangInputContent from '../../block/content/langInputContent';
import type ParagraphContent from '../../block/content/paragraphContent';
import type { Muya } from '../../index';
import { ScrollPage } from '../../block/scrollPage';
import { firstWordOfInfo, parseFenceLine } from '../../utils';
import { createDiagramState, diagramTypeOfLang } from '../../utils/diagram/fence';
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

// The opening fence of the paragraph the user is typing into: its character
// and the language typed after it (empty for a bare fence or a non-fence
// paragraph). The selector's fuzzy search may resolve a non-code language
// (e.g. `vega-lite`) to an unrelated Prism language, so the diagram check
// tries this raw text before the picked item.
function typedFence(text: string): { lang: string; fenceChar: '`' | '~' } {
    const fence = parseFenceLine(text);
    if (!fence)
        return { lang: '', fenceChar: '`' };
    return { lang: firstWordOfInfo(fence.info), fenceChar: fence.fenceChar };
}

// Build the state for the block a ```lang fence becomes. A diagram language,
// typed in full or picked from a partial query (`mer` → mermaid, #5060),
// becomes a diagram block, mirroring markdownToState's file-load path; gfm
// math becomes a math-block; everything else a fenced code block highlighted
// with the selector's matched language.
function newBlockStateForLang(
    typedLang: string,
    matchedLang: string,
    isGfmMath: boolean,
    fenceChar: '`' | '~',
) {
    if (isGfmMath)
        return { name: 'math-block', meta: { mathStyle: 'gfm' }, text: '' };

    const diagramType = diagramTypeOfLang(typedLang) ?? diagramTypeOfLang(matchedLang);
    if (diagramType)
        return createDiagramState(diagramType);

    return {
        name: 'code-block',
        meta: {
            lang: matchedLang,
            type: 'fenced',
            fenceChar,
        },
        text: '',
    };
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
            if (block.blockName === 'paragraph.content')
                lang = typedFence(text).lang;
            else if (block.blockName === 'language-input')
                lang = text;

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
            const isGfmMath
                = muya.options.texMathGfm && name === 'math';
            const { lang: typedLang, fenceChar } = typedFence(block.text);
            const state = newBlockStateForLang(
                typedLang,
                name,
                isGfmMath,
                fenceChar,
            );

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
