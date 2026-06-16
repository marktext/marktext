import type Format from '../../block/base/format';
import type { Muya } from '../../index';
import type { ImageToken } from '../../inlineRenderer/types';

import { isHTMLElement, isMouseEvent } from '../../utils';
import { findScrollContainer } from '../../utils/dom';
import './index.css';

const VERTICAL_BAR = ['left', 'right'];

const CIRCLE_RADIO = 5;
const BAR_HEIGHT = 50;

export class ImageResizeBar {
    static pluginName = 'transformer';
    private _reference: HTMLElement | null = null;
    private _block: Format | null = null;
    private _imageInfo: {
        token: ImageToken;
        imageId: string;
    } | null = null;

    private _movingAnchor: string | null = null;
    private _status: boolean = false;
    private _width: number | null = null;
    private _eventId: string[] = [];
    private _lastScrollTop: number | null = null;
    private _resizing: boolean = false;
    // A container for storing drag strips
    private _container: HTMLDivElement;

    constructor(public muya: Muya) {
        const container = (this._container = document.createElement('div'));
        container.classList.add('mu-transformer');
        document.body.appendChild(container);

        this._listen();
    }

    private _listen() {
        const { eventCenter, domNode } = this.muya;

        const scrollHandler = (event: Event) => {
            if (!isHTMLElement(event.target))
                return;
            if (typeof this._lastScrollTop !== 'number') {
                this._lastScrollTop = event.target.scrollTop;

                return;
            }

            // only when scroll distance great than 50px, then hide the float box.
            if (
                !this._resizing
                && this._status
                && Math.abs(event.target.scrollTop - this._lastScrollTop) > 50
            ) {
                this.hide();
            }
        };

        eventCenter.on('muya-transformer', ({ block, reference, imageInfo }) => {
            this._reference = reference;
            if (reference) {
                this._block = block;
                this._imageInfo = imageInfo;
                setTimeout(() => {
                    this._render();
                });
            }
            else {
                this.hide();
            }
        });

        eventCenter.attachDOMEvent(document, 'click', this.hide.bind(this));
        eventCenter.attachDOMEvent(findScrollContainer(domNode), 'scroll', scrollHandler);
        eventCenter.attachDOMEvent(this._container, 'dragstart', event =>
            event.preventDefault());
        eventCenter.attachDOMEvent(document.body, 'mousedown', this._mouseDown);
    }

    private _render() {
        const { eventCenter } = this.muya;
        if (this._status)
            this.hide();

        this._status = true;

        this._createElements();
        this._update();
        eventCenter.emit('muya-float', this, true);
    }

    private _createElements() {
        VERTICAL_BAR.forEach((c) => {
            const bar = document.createElement('div');
            bar.classList.add('bar');
            bar.classList.add(c);
            bar.setAttribute('data-position', c);
            this._container.appendChild(bar);
        });
    }

    private _update() {
        const rect = this._reference!.getBoundingClientRect();
        VERTICAL_BAR.forEach((c) => {
            const bar: HTMLDivElement = this._container.querySelector(`.${c}`)!;

            switch (c) {
                case 'left':
                    bar.style.left = `${rect.left - CIRCLE_RADIO}px`;
                    bar.style.top = `${rect.top + rect.height / 2 - BAR_HEIGHT / 2}px`;
                    break;

                case 'right':
                    bar.style.left = `${rect.left + rect.width - CIRCLE_RADIO}px`;
                    bar.style.top = `${rect.top + rect.height / 2 - BAR_HEIGHT / 2}px`;
                    break;
            }
        });
    }

    private _mouseDown = (event: Event) => {
        if (!isHTMLElement(event.target) || !event.target.closest('.bar'))
            return;

        const target = event.target;
        const { eventCenter } = this.muya;
        this._movingAnchor = target.getAttribute('data-position');
        const mouseMoveId = eventCenter.attachDOMEvent(
            document.body,
            'mousemove',
            this._mouseMove,
        );
        const mouseUpId = eventCenter.attachDOMEvent(
            document.body,
            'mouseup',
            this._mouseUp,
        );
        this._resizing = true;
        // Hide image toolbar
        eventCenter.emit('muya-image-toolbar', { reference: null });
        this._eventId.push(mouseMoveId, mouseUpId);
    };

    private _mouseMove = (event: Event) => {
        if (!isMouseEvent(event))
            return;

        event.preventDefault();
        const { clientX } = event;
        let width: number | string = '';
        let relativeAnchor: HTMLDivElement;
        const image = this._reference!.querySelector('img');
        if (!image)
            return;

        switch (this._movingAnchor) {
            case 'left':
                relativeAnchor = this._container.querySelector('.right')!;
                width = Math.max(
                    relativeAnchor.getBoundingClientRect().left + CIRCLE_RADIO - clientX,
                    50,
                );
                break;

            case 'right':
                relativeAnchor = this._container.querySelector('.left')!;
                width = Math.max(
                    clientX - relativeAnchor.getBoundingClientRect().left - CIRCLE_RADIO,
                    50,
                );
                break;
        }
        // Image width/height attribute must be an integer.
        width = Number.parseInt(String(width));
        this._width = width;
        image.setAttribute('width', String(width));
        this._update();
    };

    private _mouseUp = (event: Event) => {
        event.preventDefault();
        const { eventCenter } = this.muya;
        if (this._eventId.length) {
            for (const id of this._eventId)
                eventCenter.detachDOMEvent(id);

            this._eventId = [];
        }

        if (typeof this._width === 'number' && this._block && this._imageInfo) {
            this._block.updateImage(this._imageInfo, 'width', String(this._width));
            this.hide();
        }

        this._width = null;
        this._resizing = false;
        this._movingAnchor = null;
    };

    hide() {
        const { eventCenter } = this.muya;
        const circles = this._container.querySelectorAll('.bar');
        Array.from(circles).forEach(c => c.remove());
        this._status = false;
        eventCenter.emit('muya-float', this, false);
    }
}
