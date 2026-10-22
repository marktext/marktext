import type { VNode } from 'snabbdom';
import type HTMLBlock from '../../block/commonMark/html';
import type DiagramBlock from '../../block/extra/diagram';
import type MathBlock from '../../block/extra/math';
import type { Muya } from '../../index';
import type { IPreviewToolIcon } from './config';
import { ScrollPage } from '../../block/scrollPage';
import { BLOCK_DOM_PROPERTY } from '../../config';
import { isMouseEvent, throttle } from '../../utils';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';
import { PREVIEW_BLOCK_NAMES, previewToolBarItems } from './config';

import './index.css';

const INSET = 5;

const defaultOptions = {
    placement: 'right-start' as const,
    offsetOptions: {
        mainAxis: 0,
        crossAxis: INSET,
        alignmentAxis: 0,
    },
    showArrow: false,
};

type TPreviewBlock = HTMLBlock | MathBlock | DiagramBlock;

export interface IPreviewDiagramPayload {
    type: string;
    code: string;
    preview: HTMLElement;
    label: string | null;
}

export class PreviewToolBar extends BaseFloat {
    static pluginName = 'previewTools';
    private _oldVNode: VNode | null = null;
    private _block: TPreviewBlock | null = null;
    private _iconContainer: HTMLDivElement = document.createElement('div');

    constructor(muya: Muya, options = {}) {
        const name = 'mu-preview-tools';
        const opts = Object.assign({}, defaultOptions, options);
        super(muya, name, opts);
        this.options = opts;
        this.container?.appendChild(this._iconContainer);
        this.floatBox?.classList.add('mu-preview-tools-container');
        this.listen();
    }

    override listen() {
        const { eventCenter } = this.muya;
        super.listen();

        const handler = throttle((event: Event) => {
            if (!isMouseEvent(event))
                return;

            const { x, y } = event;
            const eles = [...document.elementsFromPoint(x, y)];
            const container = [...eles].find(
                ele =>
                    ele[BLOCK_DOM_PROPERTY]
                    && PREVIEW_BLOCK_NAMES.has((ele[BLOCK_DOM_PROPERTY] as TPreviewBlock).blockName),
            );
            if (container && !(container[BLOCK_DOM_PROPERTY] as TPreviewBlock).active) {
                const block = container[BLOCK_DOM_PROPERTY] as TPreviewBlock;
                if (block.blockName === 'html-block' && this.muya.options.disableHtml)
                    return this.hide();

                this._block = block;
                this.render();
                this._tuckInsideBlock();
                this.show(container);
            }
            else {
                this.hide();
            }
        }, 300);

        eventCenter.attachDOMEvent(document.body, 'mousemove', handler);
    }

    // The float outlives the hover, and the block it was built for can be
    // deleted while this reference is the only thing still holding its DOM.
    override hide() {
        super.hide();
        this._block = null;
    }

    // `right-start` puts the float's left edge on the block's right edge; a
    // negative mainAxis pulls it back inside the block's top-right corner.
    // Measured after `render()` and before `show()`, so the first
    // `computePosition` already sees the width this toolbar will have.
    private _tuckInsideBlock() {
        const width = this.container?.offsetWidth ?? 0;
        if (this.floatBox)
            this.floatBox.style.width = `${width}px`;
        this.options.offsetOptions = {
            mainAxis: -(width + INSET),
            crossAxis: INSET,
            alignmentAxis: 0,
        };
    }

    private _previewNode(): HTMLElement | null {
        return (this._block?.attachments?.head?.domNode as HTMLElement | undefined) ?? null;
    }

    private _items(): IPreviewToolIcon[] {
        const { _block: block } = this;
        if (!block)
            return [];

        const rendered = !!this._previewNode()?.querySelector('svg, img');

        return previewToolBarItems(block.blockName, rendered);
    }

    render() {
        const { _iconContainer: iconContainer, _oldVNode: oldVNode } = this;
        const { i18n } = this.muya;
        const children = this._items().map((i) => {
            const iconWrapperSelector = 'div.icon-wrapper';
            const icon = h(
                'i.icon',
                h(
                    'i.icon-inner',
                    {
                        style: {
                            'background': `url(${i.icon}) no-repeat`,
                            'background-size': '100%',
                        },
                    },
                    '',
                ),
            );
            const iconWrapper = h(iconWrapperSelector, icon);

            const itemSelector = `li.item.${i.type}`;

            return h(
                itemSelector,
                {
                    attrs: {
                        title: i18n.t(i.tooltip),
                    },
                    on: {
                        click: (event) => {
                            this.selectItem(event, i);
                        },
                    },
                },
                [iconWrapper],
            );
        });

        const vnode = h('ul', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(iconContainer, vnode);

        this._oldVNode = vnode;
    }

    selectItem(event: Event, i: IPreviewToolIcon) {
        event.preventDefault();
        const { _block: block } = this;
        let cursorBlock = null;
        switch (i.type) {
            case 'view': {
                const preview = this._previewNode();
                const diagram = block as DiagramBlock;
                if (preview) {
                    this.muya.eventCenter.emit('preview-diagram', {
                        type: diagram.meta.type,
                        code: diagram.firstContentInDescendant()?.text ?? '',
                        preview,
                        label: preview.getAttribute('aria-label'),
                    } satisfies IPreviewDiagramPayload);
                }
                break;
            }

            case 'edit': {
                cursorBlock = block!.firstContentInDescendant();
                break;
            }

            case 'delete': {
                const state = {
                    name: 'paragraph',
                    text: '',
                };

                const newBlock = ScrollPage.loadBlock('paragraph').create(
                    this.muya,
                    state,
                );
                block!.replaceWith(newBlock);
                cursorBlock = newBlock.firstContentInDescendant();
                break;
            }
        }

        if (cursorBlock)
            cursorBlock.setCursor(0, 0);

        this.hide();
    }
}
