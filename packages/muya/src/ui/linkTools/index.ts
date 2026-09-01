import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { Muya } from '../../muya';
import type { IBaseOptions } from '../types';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';
import iconsConfig from './config';

import './index.css';

type LinkToolIcon = typeof iconsConfig[number];

interface ILinkInfo {
    href?: string | null;
    title?: string | null;
    text?: string;
    raw?: string;
    range?: { start: number; end: number } | null;
    [key: string]: unknown;
}

interface ILinkToolsOptions extends IBaseOptions {
    jumpClick?: (linkInfo: ILinkInfo | null) => void;
}

interface ILinkToolsEventPayload {
    reference: HTMLElement | null;
    linkInfo?: ILinkInfo | null;
    block?: Format | null;
}

const defaultOptions = {
    placement: 'bottom' as const,
    offsetOptions: {
        mainAxis: 5,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

class LinkTools extends BaseFloat {
    static pluginName = 'linkTools';

    public override options: ILinkToolsOptions;
    private _oldVNode: VNode | null = null;
    private _linkInfo: ILinkInfo | null = null;
    private _linkBlock: Format | null = null;
    private _icons: LinkToolIcon[] = iconsConfig;
    private _hideTimer: ReturnType<typeof setTimeout> | null = null;
    private _linkContainer: HTMLElement;

    constructor(muya: Muya, options: Partial<ILinkToolsOptions> = {}) {
        const name = 'mu-link-tools';
        const opts: ILinkToolsOptions = Object.assign({}, defaultOptions, options);
        super(muya, name, opts);
        this.options = opts;
        const linkContainer = (this._linkContainer = document.createElement('div'));
        this.container!.appendChild(linkContainer);
        // Add a per-instance class on the floatBox so the parent
        // `.mu-float-wrapper` is identifiable in DOM and reachable by
        // `.mu-float-wrapper.mu-link-tools-container { … }` selectors.
        this.floatBox!.classList.add('mu-link-tools-container');
        this.listen();
    }

    override listen() {
        const { eventCenter } = this.muya;
        super.listen();
        eventCenter.subscribe('muya-link-tools', ({ reference, linkInfo, block }: ILinkToolsEventPayload) => {
            if (reference) {
                this._linkInfo = linkInfo ?? null;
                this._linkBlock = block ?? null;
                setTimeout(() => {
                    this.show(reference);
                    this.render();
                }, 0);
            }
            else {
                if (this._hideTimer)
                    clearTimeout(this._hideTimer);

                this._hideTimer = setTimeout(() => {
                    this.hide();
                }, 500);
            }
        });

        const mouseOverHandler = () => {
            if (this._hideTimer)
                clearTimeout(this._hideTimer);
        };

        const mouseOutHandler = () => {
            this.hide();
        };

        eventCenter.attachDOMEvent(this.container!, 'mouseover', mouseOverHandler);
        eventCenter.attachDOMEvent(this.container!, 'mouseleave', mouseOutHandler);
    }

    render() {
        const { _oldVNode: oldVNode, _linkContainer: linkContainer } = this;
        // A link whose href was sanitized away (e.g. an unsupported custom
        // protocol, issue #4356) carries `href: null` — there is nothing to
        // jump to, so offer only "unlink" (the same nothing-to-act-on rule
        // that keeps unresolved reference links out of the popover entirely).
        const icons = this._linkInfo?.href
            ? this._icons
            : this._icons.filter(icon => icon.type !== 'jump');
        const children = icons.map((i) => {
            let icon: VNode | undefined;
            let iconWrapperSelector: string | undefined;
            if (i.icon) {
                // SVG icon Asset
                iconWrapperSelector = 'div.icon-wrapper';
                icon = h(
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
            }
            const iconWrapper = h(iconWrapperSelector ?? 'div.icon-wrapper', icon);
            const itemSelector = `li.item.${i.type}`;

            return h(
                itemSelector,
                {
                    on: {
                        click: (event: Event) => {
                            this.selectItem(event, i);
                        },
                    },
                },
                iconWrapper,
            );
        });

        const ulNode = h('ul', children);

        const wrapperChildren: VNode[] = [];

        let previewText = this._linkInfo?.title || this._linkInfo?.href;

        if (this._linkInfo?.href?.startsWith('#')) {
            const anchorId = this._linkInfo.href.slice(1);
            if (anchorId) {
                // If it's an internal reference, find the anchor element and display its paragraph text
                const anchorElement = this.muya.domNode.querySelector<HTMLElement>(
                    `#${CSS.escape(anchorId)}`,
                );
                if (anchorElement) {
                    const blockElement = anchorElement.closest('.mu-paragraph, [data-role="paragraph"], .mu-block, .mu-html-block');
                    let rawText = '';
                    if (blockElement && blockElement.textContent) {
                        rawText = blockElement.textContent;
                    }
                    else if (anchorElement.parentElement && anchorElement.parentElement.textContent) {
                        rawText = anchorElement.parentElement.textContent;
                    }

                    if (rawText) {
                        // Strip HTML tags and leading reference markers like [4]
                        previewText = rawText
                            .replace(/<[^>]+>/g, '')
                            .replace(/^\[.*?\]\s*/, '')
                            .trim();
                    }
                }
            }
        }

        if (previewText) {
            try {
                previewText = decodeURI(previewText);
            }
            catch {
                // ignore
            }
            wrapperChildren.push(h('div.mu-link-preview', previewText));
        }

        wrapperChildren.push(ulNode);

        const vnode = h('div', wrapperChildren);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(linkContainer, vnode);

        this._oldVNode = vnode;
    }

    selectItem(event: Event, item: LinkToolIcon) {
        event.preventDefault();
        event.stopPropagation();
        switch (item.type) {
            case 'unlink': {
                const block = this._linkBlock;
                const linkInfo = this._linkInfo;
                if (block && linkInfo && linkInfo.range) {
                    block.unlink({
                        range: linkInfo.range,
                        text: linkInfo.text ?? '',
                    });
                }
                this.hide();
                break;
            }

            case 'jump':
                this.options.jumpClick?.(this._linkInfo);
                this.hide();
                break;
        }
    }
}

export default LinkTools;
