import type { VNode } from 'snabbdom';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../index';
import type { IBaseOptions } from '../types';
import { autoUpdate, computePosition, flip, offset } from '@floating-ui/dom';

import dragIcon from '../../assets/icons/drag/2.png';
import BulletList from '../../block/commonMark/bulletList';
import OrderList from '../../block/commonMark/orderList';
import { BLOCK_DOM_PROPERTY } from '../../config';
import { isMouseEvent, throttle, verticalPositionInRect } from '../../utils';
import { h, patch } from '../../utils/snabbdom';
import { getIcon } from './config';

import './index.css';

const LEFT_OFFSET = 100;

function defaultOptions() {
    return {
        placement: 'left-start' as const,
        offsetOptions: {
            mainAxis: 0,
            crossAxis: 0,
            alignmentAxis: 0,
        },
        showArrow: false,
    };
}

function renderIcon(i: string, className: string) {
    return h(
        `i.icon${className ? `.${className}` : ''}`,
        h(
            'i.icon-inner',
            {
                style: {
                    'background': `url(${i}) no-repeat`,
                    'background-size': '100%',
                },
            },
            '',
        ),
    );
}

function isOrderOrBulletList(block: Parent): block is OrderList | BulletList {
    return block instanceof OrderList || block instanceof BulletList;
}

export class ParagraphFrontButton {
    public name: string = 'mu-front-button';
    private _resizeObserver: ResizeObserver | null = null;
    private _options: IBaseOptions;
    private _block: Parent | null = null;
    private _oldVNode: VNode | null = null;
    private _status: boolean = false;
    private _floatBox: HTMLDivElement = document.createElement('div');
    private _container: HTMLDivElement = document.createElement('div');
    private _iconWrapper: HTMLDivElement = document.createElement('div');
    private _cleanup: (() => void) | null = null;
    private _dragTimer: ReturnType<typeof setTimeout> | null = null;
    private _dragInfo: {
        block: Parent;
        target?: Parent | null;
        position?: 'down' | 'up' | null;
    } | null = null;

    private _ghost: HTMLDivElement | null = null;
    private _shadow: HTMLDivElement | null = null;
    private _disableListen: boolean = false;
    private _dragEvents: string[] = [];

    constructor(public muya: Muya, options = {}) {
        this._options = Object.assign({}, defaultOptions(), options);
        this.init();
        this.listen();
    }

    init() {
        const { _floatBox: floatBox, _container: container, _iconWrapper: iconWrapper } = this;
        // Use to remember which float container is shown.
        container.classList.add(this.name);
        container.appendChild(iconWrapper);
        floatBox.classList.add('mu-front-button-wrapper');
        floatBox.appendChild(container);
        document.body.appendChild(floatBox);

        // Since the size of the container is not fixed and changes according to the change of content,
        // the floatBox needs to set the size according to the container size
        const resizeObserver = (this._resizeObserver = new ResizeObserver(() => {
            // Use requestAnimationFrame to avoid "ResizeObserver loop completed" warning
            requestAnimationFrame(() => {
                const { offsetWidth, offsetHeight } = container;

                Object.assign(floatBox.style, {
                    width: `${offsetWidth}px`,
                    height: `${offsetHeight}px`,
                });

                // Position will be updated by autoUpdate
            });
        }));

        resizeObserver.observe(container);
    }

    listen() {
        const { _container: container } = this;
        const { eventCenter } = this.muya;

        // attachDOMEvent's listener is typed as `EventListener` ((evt:
        // Event) => void). Take Event and narrow with the `isMouseEvent`
        // guard — same pattern as `mouseMove` below — rather than casting
        // the wrapper to EventListener (which would hide a real mismatch).
        const mousemoveHandler = throttle((event: Event) => {
            if (this._disableListen)
                return;
            if (!isMouseEvent(event))
                return;

            const { x, y } = event;
            const els = [
                ...document.elementsFromPoint(x, y),
                ...document.elementsFromPoint(x + LEFT_OFFSET, y),
            ];
            const outMostElement = els.find(
                ele =>
                    ele[BLOCK_DOM_PROPERTY]
                    && (ele[BLOCK_DOM_PROPERTY] as Parent).isOutMostBlock,
            );
            if (outMostElement) {
                this.show(outMostElement[BLOCK_DOM_PROPERTY] as Parent);
                this.render();
            }
            else {
                this.hide();
            }
        }, 300);

        const clickHandler = () => {
            eventCenter.emit('muya-front-menu', {
                reference: {
                    getBoundingClientRect: () => container.getBoundingClientRect(),
                },
                block: this._block,
            });
        };

        eventCenter.attachDOMEvent(container, 'mousedown', this._dragBarMouseDown);
        eventCenter.attachDOMEvent(container, 'mouseup', this._dragBarMouseUp);
        eventCenter.attachDOMEvent(document, 'mousemove', mousemoveHandler);
        eventCenter.attachDOMEvent(container, 'click', clickHandler);
    }

    private _dragBarMouseDown = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        this._dragTimer = setTimeout(() => {
            this._startDrag();
            this._dragTimer = null;
        }, 300);
    };

    private _dragBarMouseUp = () => {
        if (this._dragTimer) {
            clearTimeout(this._dragTimer);
            this._dragTimer = null;
        }
    };

    private _mouseMove = (event: Event) => {
        if (!this._dragInfo || !isMouseEvent(event))
            return;

        event.preventDefault();

        const { x, y } = event;
        const els = [
            ...document.elementsFromPoint(x, y),
            ...document.elementsFromPoint(x + LEFT_OFFSET, y),
        ];
        const outMostElement = els.find(
            ele =>
                ele[BLOCK_DOM_PROPERTY]
                && (ele[BLOCK_DOM_PROPERTY] as Parent).isOutMostBlock,
        );
        this._moveShadow(event);

        if (
            outMostElement
            && outMostElement[BLOCK_DOM_PROPERTY] !== this._dragInfo.block
            && (outMostElement[BLOCK_DOM_PROPERTY] as Parent).blockName !== 'frontmatter'
        ) {
            const block = outMostElement[BLOCK_DOM_PROPERTY];
            const rect = outMostElement.getBoundingClientRect();
            const position = verticalPositionInRect(event, rect);
            this._createStyledGhost(rect, position);

            Object.assign(this._dragInfo, {
                target: block,
                position,
            });
        }
        else {
            if (this._ghost) {
                this._ghost.remove();
                this._ghost = null;
                this._dragInfo.target = null;
                this._dragInfo.position = null;
            }
        }
    };

    private _mouseUp = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        this._disableListen = false;
        const { eventCenter } = this.muya;
        this._dragEvents.forEach(eventId => eventCenter.detachDOMEvent(eventId));
        this._dragEvents = [];
        if (this._ghost)
            this._ghost.remove();

        this._destroyShadow();
        document.body.style.cursor = 'auto';
        this._dragTimer = null;
        const { block, target, position } = this._dragInfo || {};

        if (target && position && block) {
            if (
                (position === 'down' && block.prev === target)
                || (position === 'up' && block.next === target)
            ) {
                return;
            }

            if (position === 'up')
                block.insertInto(block.parent!, target);
            else
                block.insertInto(block.parent!, target.next);

            // TODO: @JOCS, remove use this.selection directly.
            const { anchorBlock, anchor, focus, isSelectionInSameBlock }
                = block.muya.editor.selection ?? {};

            if (
                isSelectionInSameBlock
                && anchorBlock
                && anchorBlock.isInBlock(block)
            ) {
                const begin = Math.min(anchor!.offset, focus!.offset);
                const end = Math.max(anchor!.offset, focus!.offset);
                anchorBlock.setCursor(begin, end);
            }
        }

        this._dragInfo = null;
    };

    private _startDrag = () => {
        const { _block: block } = this;
        // Frontmatter should not be drag.
        if (!block || block.blockName === 'frontmatter')
            return;

        this._disableListen = true;
        this._dragInfo = {
            block,
        };
        this._createStyledShadow();
        this.hide();
        const { eventCenter } = this.muya;

        document.body.style.cursor = 'grabbing';

        this._dragEvents = [
            eventCenter.attachDOMEvent(
                document,
                'mousemove',
                throttle(this._mouseMove, 100),
            ),
            eventCenter.attachDOMEvent(document, 'mouseup', this._mouseUp),
        ];
    };

    private _createStyledGhost(rect: DOMRect, position: 'down' | 'up') {
        let ghost = this._ghost;
        if (!ghost) {
            ghost = document.createElement('div');
            document.body.appendChild(ghost);
            ghost.classList.add('mu-line-ghost');
            this._ghost = ghost;
        }

        Object.assign(ghost.style, {
            width: `${rect.width}px`,
            left: `${rect.left}px`,
            top: position === 'up' ? `${rect.top}px` : `${rect.top + rect.height}px`,
        });
    }

    private _createStyledShadow() {
        const { domNode } = this._block!;
        const { width, top, left } = domNode!.getBoundingClientRect();
        const shadow = document.createElement('div');
        shadow.classList.add('mu-shadow');
        Object.assign(shadow.style, {
            width: `${width}px`,
            top: `${top}px`,
            left: `${left}px`,
        });
        shadow.appendChild(domNode!.cloneNode(true));
        document.body.appendChild(shadow);
        this._shadow = shadow;
    }

    private _moveShadow(event: Event) {
        const { _shadow: shadow } = this;
        // The shadow already be removed.
        if (!shadow || !isMouseEvent(event))
            return;

        const { y } = event;
        Object.assign(shadow.style, {
            top: `${y}px`,
        });
    }

    private _destroyShadow() {
        const { _shadow: shadow } = this;
        if (shadow) {
            shadow.remove();
            this._shadow = null;
        }
    }

    render() {
        const { _container: container, _iconWrapper: iconWrapper, _block: block, _oldVNode: oldVNode } = this;

        const iconWrapperSelector = 'div.mu-icon-wrapper';
        const i = getIcon(block!);
        const iconParagraph = renderIcon(i, 'paragraph');
        const iconDrag = renderIcon(dragIcon, 'drag');

        const vnode = h(iconWrapperSelector, [iconParagraph, iconDrag]);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(iconWrapper, vnode);

        this._oldVNode = vnode;

        // Reset float box style height
        const { lineHeight } = getComputedStyle(block!.domNode!);
        container.style.height = lineHeight;
    }

    hide() {
        if (!this._status)
            return;

        this._block = null;
        this._status = false;
        const { eventCenter } = this.muya;
        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        if (this._floatBox) {
            Object.assign(this._floatBox.style, {
                left: `-9999px`,
                top: `-9999px`,
                opacity: '0',
            });
        }

        eventCenter.emit('muya-float-button', this, false);
    }

    show(block: Parent) {
        if (this._block && this._block === block)
            return;

        this._block = block;
        const { domNode } = block;
        const { _floatBox: floatBox } = this;
        const { placement, offsetOptions } = this._options;
        const { eventCenter } = this.muya;

        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        const styles = window.getComputedStyle(domNode!);
        const paddingTop = Number.parseFloat(styles.paddingTop);

        const isLooseList = isOrderOrBulletList(block) && block.meta.loose;
        const dynamicMainAxis = isLooseList ? paddingTop * 2 : paddingTop;

        // Extract offset values, handling both number and object types
        let crossAxisValue = 0;
        let alignmentAxisValue = 0;
        if (typeof offsetOptions === 'object' && offsetOptions !== null && !('then' in offsetOptions)) {
            crossAxisValue = (offsetOptions as { crossAxis?: number }).crossAxis ?? 0;
            alignmentAxisValue = (offsetOptions as { alignmentAxis?: number | null }).alignmentAxis ?? 0;
        }

        const updatePosition = () => {
            computePosition(domNode!, floatBox, {
                placement,
                middleware: [
                    offset({
                        mainAxis: dynamicMainAxis,
                        crossAxis: crossAxisValue,
                        alignmentAxis: alignmentAxisValue,
                    }),
                    flip(),
                ],
            }).then(({ x, y }) => {
                Object.assign(floatBox.style, {
                    left: `${x}px`,
                    top: `${y}px`,
                    opacity: 1,
                });
            });
        };

        updatePosition();
        this._cleanup = autoUpdate(domNode!, floatBox, updatePosition);

        this._status = true;
        eventCenter.emit('muya-float-button', this, true);
    }

    destroy() {
        if (this._container && this._resizeObserver)
            this._resizeObserver.unobserve(this._container);

        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        this._floatBox.remove();
    }
}
