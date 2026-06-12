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
    public oldVNode: VNode | null = null;
    public linkInfo: ILinkInfo | null = null;
    public linkBlock: Format | null = null;
    public icons: LinkToolIcon[] = iconsConfig;
    public hideTimer: ReturnType<typeof setTimeout> | null = null;
    public linkContainer: HTMLElement;

    constructor(muya: Muya, options: Partial<ILinkToolsOptions> = {}) {
        const name = 'mu-link-tools';
        const opts: ILinkToolsOptions = Object.assign({}, defaultOptions, options);
        super(muya, name, opts);
        this.options = opts;
        const linkContainer = (this.linkContainer = document.createElement('div'));
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
                this.linkInfo = linkInfo ?? null;
                this.linkBlock = block ?? null;
                setTimeout(() => {
                    this.show(reference);
                    this.render();
                }, 0);
            }
            else {
                if (this.hideTimer)
                    clearTimeout(this.hideTimer);

                this.hideTimer = setTimeout(() => {
                    this.hide();
                }, 500);
            }
        });

        const mouseOverHandler = () => {
            if (this.hideTimer)
                clearTimeout(this.hideTimer);
        };

        const mouseOutHandler = () => {
            this.hide();
        };

        eventCenter.attachDOMEvent(this.container!, 'mouseover', mouseOverHandler);
        eventCenter.attachDOMEvent(this.container!, 'mouseleave', mouseOutHandler);
    }

    render() {
        const { icons, oldVNode, linkContainer } = this;
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

        const vnode = h('ul', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(linkContainer, vnode);

        this.oldVNode = vnode;
    }

    selectItem(event: Event, item: LinkToolIcon) {
        event.preventDefault();
        event.stopPropagation();
        switch (item.type) {
            case 'unlink': {
                const block = this.linkBlock;
                const linkInfo = this.linkInfo;
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
                this.options.jumpClick?.(this.linkInfo);
                this.hide();
                break;
        }
    }
}

export default LinkTools;
