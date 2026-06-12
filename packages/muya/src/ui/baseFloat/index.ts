import type { Placement, ReferenceElement } from '@floating-ui/dom';
import type { Muya } from '../../index';
import type { IBaseOptions } from '../types';
import { autoUpdate, computePosition, flip, offset } from '@floating-ui/dom';
import { EVENT_KEYS } from '../../config';

import { isHTMLElement, isKeyboardEvent, noop } from '../../utils';
import { findScrollContainer } from '../../utils/dom';

import './index.css';

function defaultOptions() {
    return {
        placement: 'bottom-start' as Placement,
        offsetOptions: {
            mainAxis: 10,
            crossAxis: 0,
            alignmentAxis: 0,
        },
        showArrow: false,
    };
}

const BUTTON_GROUP = ['mu-table-drag-bar', 'mu-front-button'];

abstract class BaseFloat {
    public options: IBaseOptions;
    public status: boolean = false;
    public floatBox: HTMLElement | null = null;
    public container: HTMLElement | null = null;
    public lastScrollTop: number | null = null;
    public cb: (...args: unknown[]) => void = noop;

    private _cleanup: (() => void) | null = null;
    private _resizeObserver: ResizeObserver | null = null;

    constructor(
        public muya: Muya,
        public name: string,
        options = {},
    ) {
        this.options = Object.assign({}, defaultOptions(), options);
        this.init();
    }

    init() {
        const floatBox = document.createElement('div');
        const container = document.createElement('div');
        // Use to remember which float container is shown.
        container.classList.add(this.name);
        container.classList.add('mu-float-container');
        floatBox.classList.add('mu-float-wrapper');

        floatBox.appendChild(container);
        document.body.appendChild(floatBox);

        this.floatBox = floatBox;
        this.container = container;

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
            });
        }));

        resizeObserver.observe(container);
    }

    listen() {
        const { eventCenter, domNode } = this.muya;
        const { floatBox } = this;

        const keydownHandler = (event: Event) => {
            if (isKeyboardEvent(event) && event.key === EVENT_KEYS.Escape)
                this.hide();
        };

        /**
         * After the editor scrolls vertically beyond a certain range,
         * it means that the user's focus is no longer on the float box,
         * so the float box needs to be hidden.
         */
        const scrollHandler = (event: Event) => {
            if (!isHTMLElement(event.target))
                return;
            if (typeof this.lastScrollTop !== 'number') {
                this.lastScrollTop = event.target.scrollTop;

                return;
            }

            // only when scroll distance great than 50px, then hide the float box.
            if (
                this.status
                && Math.abs(event.target.scrollTop - this.lastScrollTop) > 50
            ) {
                this.hide();
            }
        };

        eventCenter.attachDOMEvent(document, 'click', this.hide.bind(this));
        eventCenter.attachDOMEvent(floatBox!, 'click', (event) => {
            event.stopPropagation();
            event.preventDefault();
        });
        eventCenter.attachDOMEvent(domNode, 'keydown', keydownHandler);
        eventCenter.attachDOMEvent(findScrollContainer(domNode), 'scroll', scrollHandler);
    }

    hide() {
        if (!this.status)
            return;

        const { eventCenter } = this.muya;
        const { floatBox } = this;
        this.status = false;

        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        if (floatBox) {
            Object.assign(floatBox.style, {
                opacity: 0,
                top: '-9999px',
                left: '-9999px',
            });
        }

        this.cb = noop;
        this.lastScrollTop = null;

        if (BUTTON_GROUP.includes(this.name))
            eventCenter.emit('muya-float-button', this, false);
        else eventCenter.emit('muya-float', this, false);
    }

    // `cb` is a generic "selection made" callback. Concrete floats invoke it
    // with their own argument tuple (e.g. emojiSelector → `(item)`,
    // tableChessboard → `(row, column)`). `never[]` in the contravariant
    // arg position accepts any concrete callback shape.
    show(reference: ReferenceElement, cb: (...args: never[]) => void = noop) {
        const { floatBox } = this;
        const { eventCenter } = this.muya;
        const { placement, offsetOptions } = this.options;
        if (!floatBox) {
            throw new Error('The float box is not existed.');
        }
        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        // `cb` is declared with `never[]` args at the parameter so any
        // concrete callback shape is accepted; the field stores it as
        // `unknown[]` so internal call sites can forward arbitrary args.
        this.cb = cb as (...args: unknown[]) => void;

        this._cleanup = autoUpdate(reference, floatBox, () => {
            computePosition(reference, floatBox, {
                placement,
                middleware: [offset(offsetOptions), flip()],
            }).then(({ x, y }) => {
                Object.assign(floatBox.style, {
                    left: `${x}px`,
                    top: `${y}px`,
                    opacity: 1,
                });
            });
        });

        this.status = true;

        if (BUTTON_GROUP.includes(this.name))
            eventCenter.emit('muya-float-button', this, true);
        else eventCenter.emit('muya-float', this, true);
    }

    destroy() {
        if (this.container && this._resizeObserver)
            this._resizeObserver.unobserve(this.container);

        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        this.floatBox?.remove();
    }
}

export default BaseFloat;
