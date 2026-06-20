import type { VNode } from 'snabbdom';
import type { Muya } from '../../index';
import type {
    IQuickInsertMenuItem,
} from './config';
import Fuse from 'fuse.js';
import { replaceBlockByLabel } from '../../block/blockTransforms';
import ParagraphContent from '../../block/content/paragraphContent';
import { deepClone } from '../../utils';
import { query } from '../../utils/dom';
import { h, patch } from '../../utils/snabbdom';
import BaseScrollFloat from '../baseScrollFloat';
import {
    getLabelFromEvent,
    MENU_CONFIG,
} from './config';

import './index.css';

const checkQuickInsert = (text: string) => /^[/、]\S*$/.test(text);
const checkShowPlaceholder = (text: string) => /^[/、]$/.test(text);
function checkCanInsertFrontMatter(muya: Muya, block: ParagraphContent) {
    const { frontMatter } = muya.options;

    return (
        frontMatter
        && !block.parent?.prev
        && block.parent?.parent?.blockName === 'scrollpage'
    );
}

export class ParagraphQuickInsertMenu extends BaseScrollFloat {
    static pluginName = 'quickInsert';
    public override capturesContentKeydown = true;

    public oldVNode: VNode | null = null;
    private _block: ParagraphContent | null = null;
    public override activeItem: IQuickInsertMenuItem['children'][number] | null = null;
    public override renderArray: IQuickInsertMenuItem['children'] = [];
    private _renderData: IQuickInsertMenuItem[] = [];

    constructor(muya: Muya) {
        const name = 'mu-quick-insert';
        super(muya, name);
        this.renderArray = [];
        this.renderData = MENU_CONFIG;
        this.render();
        this.listen();
    }

    get renderData() {
        return this._renderData;
    }

    set renderData(data) {
        this._renderData = data;

        this.renderArray = data.flatMap(d => d.children);
        if (this.renderArray.length > 0) {
            this.activeItem = this.renderArray[0];
            const activeEle = this.getItemElement(this.activeItem);
            if (activeEle)
                this.activeEleScrollIntoView(activeEle);
        }
    }

    override listen() {
        super.listen();
        const { eventCenter, editor, domNode, i18n } = this.muya;

        eventCenter.subscribe('content-change', ({ block }) => {
            // Check weather need to show quick insert panel
            if (block.blockName !== 'paragraph.content')
                return;

            const { text, domNode } = block;
            const needToShowQuickInsert = checkQuickInsert(text);
            const needToShowPlaceholder = checkShowPlaceholder(text);
            if (needToShowPlaceholder)
                domNode!.setAttribute('placeholder', i18n.t('Search keyword...'));
            else
                domNode!.removeAttribute('placeholder');

            if (needToShowQuickInsert) {
                this._block = block;
                this.show(domNode);
                this._search(text.substring(1)); // remove `/` char
            }
            else {
                this.hide();
            }
        });

        const handleKeydown = (event: Event) => {
            const selectionResult = editor.selection.getSelection();
            const anchorBlock = selectionResult?.anchor.block;
            const isSelectionInSameBlock = selectionResult?.isSelectionInSameBlock;
            if (isSelectionInSameBlock && anchorBlock instanceof ParagraphContent) {
                if (anchorBlock.text)
                    return;

                const label = getLabelFromEvent(event);
                if (label) {
                    event.preventDefault();
                    replaceBlockByLabel({
                        label,
                        block: anchorBlock.parent!,
                        muya: this.muya,
                    });
                }
            }
        };

        eventCenter.attachDOMEvent(domNode, 'keydown', handleKeydown);
    }

    render() {
        const { scrollElement, activeItem, renderData } = this;
        const { i18n } = this.muya;
        let children = renderData.map((section) => {
            const titleVnode = h('div.title', i18n.t(section.name).toUpperCase());
            const items = [];

            for (const item of section.children) {
                const { title, subTitle, label, icon, shortCut } = item;
                const iconVnode = h(
                    'div.icon-container',
                    h(
                        'i.icon',
                        h(
                            `i.icon-${label.replace(/\s/g, '-')}`,
                            {
                                style: {
                                    'background': `url(${icon}) no-repeat`,
                                    'background-size': '100%',
                                },
                            },
                            '',
                        ),
                    ),
                );

                const description = h('div.description', [
                    h(
                        'div.big-title',
                        {
                            attrs: { title: subTitle },
                        },
                        i18n.t(title),
                    ),
                ]);
                const shortCutVnode = h('div.short-cut', [h('span', shortCut)]);
                const selector
                    = activeItem!.label === label ? 'div.item.active' : 'div.item';
                items.push(
                    h(
                        selector,
                        {
                            dataset: { label },
                            on: {
                                click: () => {
                                    this.selectItem(item);
                                },
                            },
                        },
                        [iconVnode, description, shortCutVnode],
                    ),
                );
            }

            return h('section', [titleVnode, ...items]);
        });

        if (children.length === 0)
            children = [h('div.no-result', i18n.t('No result'))];

        const vnode = h('div', children);

        if (this.oldVNode)
            patch(this.oldVNode, vnode);
        else
            patch(scrollElement!, vnode);

        this.oldVNode = vnode;
    }

    private _search(text: string) {
        const { muya, _block: block } = this;
        const { i18n } = muya;
        const canInsertFrontMatter = checkCanInsertFrontMatter(muya, block!);
        const menuConfig = deepClone(MENU_CONFIG);

        if (!canInsertFrontMatter) {
            menuConfig
                .find(menu => menu.name === 'basic blocks')
                ?.children
                .splice(2, 1);
        }
        let result = menuConfig;
        if (text !== '') {
            result = [];

            for (const menu of menuConfig) {
                for (const child of menu.children)
                    child.i18nTitle = i18n.t(child.title);

                const fuse = new Fuse(menu.children, {
                    includeScore: true,
                    keys: ['i18nTitle', 'title'],
                });
                const match = fuse
                    .search(text)
                    .map(i => ({ score: i.score, ...i.item }));
                if (match.length) {
                    result.push({
                        name: menu.name,
                        children: match,
                    });
                }
            }

            if (result.length) {
                result.sort((a, b) => {
                    return a.children[0].score! < b.children[0].score! ? -1 : 1;
                });
            }
        }
        this.renderData = result;
        this.render();
    }

    override selectItem({ label }: IQuickInsertMenuItem['children'][number]) {
        const { _block: block, muya } = this;
        replaceBlockByLabel({
            label,
            block: block!.parent!,
            muya,
        });
        // delay hide to avoid dispatch enter handler
        setTimeout(this.hide.bind(this));
    }

    getItemElement(item: IQuickInsertMenuItem['children'][number]) {
        const { label } = item;

        return query<HTMLElement>(`[data-label="${label}"]`, this.scrollElement!);
    }
}
