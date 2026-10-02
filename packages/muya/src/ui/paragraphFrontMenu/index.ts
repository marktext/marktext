import type { VNode } from 'snabbdom';
import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type AtxHeading from '../../block/commonMark/atxHeading';
import type { Muya } from '../../index';
import type {
    IBulletListState,
    IOrderListState,
    ITaskListState,
    TState,
} from '../../state/types';
import type { IQuickInsertMenuItem } from '../paragraphQuickInsertMenu/config';
import { replaceBlockByLabel } from '../../block/blockTransforms';
import { ScrollPage } from '../../block/scrollPage';
import emptyStates from '../../config/emptyStates';

import { isAnyListState, isAtxHeadingState } from '../../state/types';
import { deepClone, isHTMLElement } from '../../utils';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';
import { canTurnIntoMenu, FRONT_MENU } from './config';
import './index.css';

function renderIcon({ label, icon }: { label: string; icon: string }) {
    return h(
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
    );
}

const defaultOptions = {
    placement: 'bottom' as const,
    offsetOptions: {
        mainAxis: 0,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

export class ParagraphFrontMenu extends BaseFloat {
    static pluginName = 'frontMenu';
    public override capturesContentKeydown = true;
    private _oldVNode: VNode | null = null;
    private _block: Parent | null = null;
    private _frontMenuContainer: HTMLDivElement = document.createElement('div');

    constructor(muya: Muya, options = {}) {
        const name = 'mu-front-menu';
        const opts = Object.assign({}, defaultOptions, options);
        super(muya, name, opts);
        const parent = this.container!.parentNode;
        if (isHTMLElement(parent)) {
            Object.assign(parent.style, {
                overflow: 'visible',
            });
        }
        this.container!.appendChild(this._frontMenuContainer);
        this.listen();
    }

    override listen() {
        const { container } = this;
        const { eventCenter } = this.muya;
        super.listen();

        eventCenter.subscribe('muya-front-menu', ({ reference, block }) => {
            if (reference) {
                this._block = block;

                setTimeout(() => {
                    this.show(reference);
                    this.render();
                }, 0);
            }
        });

        const enterLeaveHandler = () => {
            this.hide();
            this._block = null;
        };

        eventCenter.attachDOMEvent(container!, 'mouseleave', enterLeaveHandler);
    }

    private _renderSubMenu(subMenu: IQuickInsertMenuItem['children']) {
        const { _block: block } = this;
        const { i18n } = this.muya;
        const children = subMenu.map((menuItem) => {
            const { title, label, subTitle } = menuItem;
            const iconWrapperSelector = 'div.icon-wrapper';
            const iconWrapper = h(
                iconWrapperSelector,
                {
                    props: {
                        title: `${i18n.t(title)}\n${subTitle}`,
                    },
                },
                renderIcon(menuItem),
            );

            let itemSelector = `div.turn-into-item.${label}`;
            if (block?.blockName === 'atx-heading') {
                if (
                    label.startsWith(block.blockName)
                    && label.endsWith(String((block as AtxHeading).meta.level))
                ) {
                    itemSelector += '.active';
                }
            }
            else if (label === block?.blockName) {
                itemSelector += '.active';
            }

            return h(
                itemSelector,
                {
                    on: {
                        click: (event) => {
                            this.selectItem(event, { label });
                        },
                    },
                },
                [iconWrapper],
            );
        });
        const subMenuSelector = 'li.turn-into-menu';

        return h(subMenuSelector, children);
    }

    render() {
        const { _oldVNode: oldVNode, _frontMenuContainer: frontMenuContainer, _block: block } = this;
        const { i18n } = this.muya;
        const { blockName } = block!;
        const children = FRONT_MENU.map(({ icon, label, text, shortCut }) => {
            const iconWrapperSelector = 'div.icon-wrapper';
            const iconWrapper = h(iconWrapperSelector, renderIcon({ icon, label }));
            const textWrapper = h('span.text', i18n.t(text));
            const shortCutWrapper = h('div.short-cut', [h('span', shortCut)]);
            const itemSelector = `li.item.${label}`;
            const itemChildren = [iconWrapper, textWrapper, shortCutWrapper];

            return h(
                itemSelector,
                {
                    on: {
                        click: (event) => {
                            this.selectItem(event, { label });
                        },
                    },
                },
                itemChildren,
            );
        });

        // Frontmatter can not be duplicated
        if (blockName === 'frontmatter')
            children.splice(0, 1);

        const subMenu = canTurnIntoMenu(block!);
        if (subMenu.length) {
            const line = h('li.divider');
            children.unshift(line);
            children.unshift(this._renderSubMenu(subMenu));
        }

        const vnode = h('ul', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else patch(frontMenuContainer, vnode);

        this._oldVNode = vnode;
    }

    selectItem(event: Event, { label }: { label: string }) {
        event.preventDefault();
        event.stopPropagation();

        // A single menu open performs at most one action: consume the target
        // synchronously, then bail unless it is still in the document. This
        // covers both a rapid second click (a real double-click before the
        // deferred hide()) and an external command — e.g. the app menu bar —
        // that unwrapped the block while this menu stayed open. Every action
        // below assumes `block.parent` (#4686).
        const block = this._block;
        this._block = null;
        if (!block?.parent)
            return;

        const oldState = block.getState();

        const cursorBlock = /duplicate|new|delete/.test(label)
            ? this._applyMetaAction(label, block, oldState)
            : this._turnIntoBlock(label, block, oldState);

        if (cursorBlock) {
            // mock cursorBlock focus
            cursorBlock.setCursor(0, 0, true);
        }
        // Delay hide to avoid dispatch enter handler
        setTimeout(this.hide.bind(this));
    }

    private _applyMetaAction(label: string, block: Parent, oldState: TState) {
        const { muya } = this;
        switch (label) {
            case 'duplicate': {
                const state = deepClone(oldState);
                const dupBlock = ScrollPage.loadBlock(state.name).create(muya, state);
                block.parent!.insertAfter(dupBlock, block);
                return dupBlock.lastContentInDescendant();
            }

            case 'new': {
                const state = deepClone(emptyStates.paragraph);
                const newBlock = ScrollPage.loadBlock('paragraph').create(
                    muya,
                    state,
                );
                block.parent!.insertAfter(newBlock, block);
                return newBlock.lastContentInDescendant();
            }

            case 'delete': {
                let cursorBlock = null;
                if (block.prev) {
                    cursorBlock = block.prev.lastContentInDescendant();
                }
                else if (block.next) {
                    cursorBlock = block.next.firstContentInDescendant();
                }
                else {
                    const state = deepClone(emptyStates.paragraph);
                    const newBlock = ScrollPage.loadBlock('paragraph').create(
                        muya,
                        state,
                    );
                    block.parent!.insertAfter(newBlock, block);
                    cursorBlock = newBlock.lastContentInDescendant();
                }
                block.remove();

                return cursorBlock;
            }

            default:
                return null;
        }
    }

    private _turnIntoBlock(label: string, block: Parent, oldState: TState) {
        const { muya } = this;
        switch (block.blockName) {
            case 'paragraph':
                // fall through
            case 'atx-heading': {
                if (block.blockName === 'paragraph' && block.blockName === label)
                    return null;

                const headingLevel = isAtxHeadingState(oldState) ? oldState.meta.level : null;
                if (
                    block.blockName === 'atx-heading'
                    && headingLevel !== null
                    && label.split(' ')[1] === String(headingLevel)
                ) {
                    return null;
                }

                const rawText = 'text' in oldState ? oldState.text : '';
                const text
                    = block.blockName === 'paragraph'
                        ? rawText
                        : rawText.replace(/^ {0,3}#{1,6}(?:\s+|$)/, '');
                replaceBlockByLabel({
                    block,
                    label,
                    muya,
                    text,
                });

                return null;
            }

            case 'order-list':
                // fall through
            case 'bullet-list':
                // fall through
            case 'task-list':
                return this._turnIntoList(label, block, oldState);

            default:
                return null;
        }
    }

    private _turnIntoList(label: string, block: Parent, oldState: TState) {
        const { muya } = this;
        const { editor } = muya;
        const { bulletListMarker, orderListDelimiter } = muya.options;

        if (!isAnyListState(oldState))
            return null;

        // Clicking the active list type toggles the list off,
        // unwrapping every item back into plain paragraphs (matches
        // the command-palette/menu `reset-to-paragraph` behaviour).
        if (block.blockName === label) {
            muya.resetToParagraph(block);

            return null;
        }

        // The conversion between order/bullet/task lists re-shapes both
        // the parent `meta` and each item's `meta` (only task-list-items
        // carry meta). Rebuild a fresh state of the target shape rather
        // than mutating the old one in place — the in-place form requires
        // discriminant-changing casts that TS can't track.
        const sourceMeta = oldState.meta;
        const loose = sourceMeta.loose;
        const delimiter = 'delimiter' in sourceMeta
            ? sourceMeta.delimiter
            : orderListDelimiter;
        const marker = 'marker' in sourceMeta
            ? sourceMeta.marker
            : bulletListMarker;

        const childContents: TState[][] = oldState.children.map(
            li => deepClone(li.children),
        );

        let state: ITaskListState | IOrderListState | IBulletListState;
        if (label === 'task-list') {
            state = {
                name: 'task-list',
                meta: { marker: marker ?? bulletListMarker, loose: !!loose },
                children: childContents.map(children => ({
                    name: 'task-list-item',
                    meta: { checked: false },
                    children,
                })),
            };
        }
        else if (label === 'order-list') {
            state = {
                name: 'order-list',
                meta: { delimiter, loose: !!loose, start: 1 },
                children: childContents.map(children => ({
                    name: 'list-item',
                    children,
                })),
            };
        }
        else {
            state = {
                name: 'bullet-list',
                meta: { marker: marker ?? bulletListMarker, loose: !!loose },
                children: childContents.map(children => ({
                    name: 'list-item',
                    children,
                })),
            };
        }
        // TODO: @JOCS, remove use this.selection directly.
        const { anchorPath, anchor, focus, isSelectionInSameBlock }
            = editor.selection;
        const listBlock = ScrollPage.loadBlock(label).create(muya, state);
        block.replaceWith(listBlock);
        const guessCursorBlock
            = muya.editor.scrollPage?.queryBlock(anchorPath);
        if (guessCursorBlock && isSelectionInSameBlock) {
            const begin = Math.min(anchor!.offset, focus!.offset);
            const end = Math.max(anchor!.offset, focus!.offset);
            // Make guessCursorBlock active. queryBlock returns the
            // closest block at the given path; for an inline path
            // it's a Content leaf (which has setCursor).
            (guessCursorBlock as Content).setCursor(begin, end, true);

            return null;
        }

        return listBlock.firstContentInDescendant();
    }
}
