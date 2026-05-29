import type { ReferenceElement } from '@floating-ui/dom';
import type { VNode } from 'snabbdom';
import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type Footnote from '../../block/extra/footnote';
import type { Muya } from '../../muya';
import type { IFootnoteBlockState } from '../../state/types';
import type { IBaseOptions } from '../types';
import { ScrollPage } from '../../block/scrollPage';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';

import './index.css';

interface IFootnoteToolPayload {
    reference: ReferenceElement | null;
    identifier: string;
    footnotes: Map<string, Footnote>;
}

const PREVIEW_MAX_LENGTH = 100;

const defaultOptions: IBaseOptions = {
    placement: 'bottom',
    offsetOptions: {
        mainAxis: 5,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

export class FootnoteTool extends BaseFloat {
    static pluginName = 'footnoteTool';

    private _oldVNode: VNode | null = null;
    private _identifier: string = '';
    private _footnotes: Map<string, Footnote> = new Map();
    private _hideTimer: ReturnType<typeof setTimeout> | null = null;
    private _toolContainer: HTMLDivElement = document.createElement('div');

    constructor(muya: Muya, options: Partial<IBaseOptions> = {}) {
        const name = 'mu-footnote-tool';
        super(muya, name, Object.assign({}, defaultOptions, options));
        this.container!.appendChild(this._toolContainer);
        this.floatBox!.classList.add('mu-footnote-tool-container');
        this.listen();
    }

    override listen() {
        super.listen();
        const { eventCenter } = this.muya;

        eventCenter.subscribe(
            'muya-footnote-tool',
            ((payload: IFootnoteToolPayload) => {
                const { reference, identifier, footnotes } = payload;
                if (reference) {
                    this._identifier = identifier;
                    this._footnotes = footnotes;
                    // Defer through a microtask so the originating click can
                    // finish bubbling before BaseFloat's document-click hide
                    // handler races the open. Without this the float opens
                    // and immediately closes on the same tick.
                    setTimeout(() => {
                        this.show(reference);
                        this._render();
                    }, 0);
                    return;
                }
                if (this._hideTimer)
                    clearTimeout(this._hideTimer);
                this._hideTimer = setTimeout(() => this.hide(), 500);
            }) as (...args: unknown[]) => void,
        );
    }

    private _render() {
        const hasFootnote = this._footnotes.has(this._identifier);
        let previewText = `Can't find footnote with syntax [^${this._identifier}]:`;
        if (hasFootnote) {
            const block = this._footnotes.get(this._identifier)!;
            const collected = collectFootnoteText(block);
            previewText = collected || 'Input the footnote definition...';
        }

        const textNode = h('span.text', previewText);
        const button = h(
            'a.btn',
            {
                on: {
                    click: (event: Event) => this._handleButtonClick(event, hasFootnote),
                },
            },
            hasFootnote ? 'Go to' : 'Create',
        );
        const children = hasFootnote
            ? [textNode, button]
            : [h('span.icon-wrapper'), textNode, button];

        // Root stays plain `<div>` — BaseFloat already puts `mu-footnote-tool`
        // on the outer container, and the CSS selector `.mu-footnote-tool > div`
        // styles this inner wrapper.
        const vnode = h('div', children);
        patch(this._oldVNode || this._toolContainer, vnode);
        this._oldVNode = vnode;
    }

    private _handleButtonClick(event: Event, hasFootnote: boolean) {
        event.preventDefault();
        event.stopPropagation();
        if (hasFootnote)
            this._goTo();
        else
            this._createDefinition();
        this.hide();
    }

    private _goTo() {
        const block = this._footnotes.get(this._identifier);
        if (!block)
            return;
        block.domNode?.scrollIntoView({ behavior: 'smooth' });
        const content = block.firstContentInDescendant();
        content?.setCursor(0, 0, true);
    }

    private _createDefinition() {
        const { scrollPage } = this.muya.editor;
        if (!scrollPage)
            return;

        const state: IFootnoteBlockState = {
            name: 'footnote',
            meta: { identifier: this._identifier },
            children: [{ name: 'paragraph', text: '' }],
        };
        const newBlock = ScrollPage.loadBlock('footnote').create(this.muya, state) as Parent;
        // 'user' source dispatches the corresponding ot-json1 insert through
        // jsonState, so history + collaborative transport see the change.
        scrollPage.append(newBlock, 'user');
        const content = newBlock.firstContentInDescendant() as Content | null;
        content?.setCursor(0, 0, true);
    }
}

function collectFootnoteText(block: Footnote): string {
    // Real footnote blocks (Parent-derived) expose `depthFirstTraverse`. If a
    // caller passes a structurally-typed stand-in (ad-hoc probes / tests),
    // skip the walk rather than throw — the preview just degrades to empty.
    if (typeof (block as { depthFirstTraverse?: unknown }).depthFirstTraverse !== 'function')
        return '';

    let text = '';
    block.depthFirstTraverse((node) => {
        if (node.isContent())
            text += node.text;
    });
    return text.slice(0, PREVIEW_MAX_LENGTH);
}

export default FootnoteTool;
