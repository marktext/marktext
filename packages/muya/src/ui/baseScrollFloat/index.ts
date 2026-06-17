import type { ReferenceElement } from '@floating-ui/dom';
import type { Muya } from '../../muya';
import { EVENT_KEYS } from '../../config';
import { isKeyboardEvent, noop } from '../../utils';
import BaseFloat from '../baseFloat';

abstract class BaseScrollFloat extends BaseFloat {
    public scrollElement: HTMLElement | null = null;
    private _reference: Element | ReferenceElement | null = null;
    public activeItem: unknown | null = null;
    public renderArray: unknown[] = [];

    constructor(muya: Muya, name: string, options = {}) {
        super(muya, name, options);
        this._createScrollElement();
    }

    private _createScrollElement() {
        const { container } = this;
        const scrollElement = document.createElement('div');
        container!.appendChild(scrollElement);
        this.scrollElement = scrollElement;
    }

    protected activeEleScrollIntoView(ele: HTMLElement) {
        if (ele) {
            ele.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'start',
            });
        }
    }

    override listen() {
        super.listen();
        const { eventCenter, domNode } = this.muya;
        const handler = (event: Event) => {
            if (!this.status || !isKeyboardEvent(event))
                return;
            switch (event.key) {
                case EVENT_KEYS.ArrowUp:
                    this.step('previous');
                    break;

                case EVENT_KEYS.ArrowDown:
                    // // falls through

                case EVENT_KEYS.Tab:
                    this.step('next');
                    break;

                case EVENT_KEYS.Enter:
                    this.selectItem(this.activeItem);
                    break;

                default:
                    break;
            }
        };

        eventCenter.attachDOMEvent(domNode, 'keydown', handler);
    }

    override hide() {
        super.hide();
        this._reference = null;
    }

    override show(reference: Element | ReferenceElement, cb: (...args: never[]) => void = noop) {
        // See BaseFloat.show: callbacks accept any shape; store as unknown[]
        // so internal forwarding stays workable.
        this.cb = cb as (...args: unknown[]) => void;

        if (reference instanceof HTMLElement) {
            if (this._reference && this._reference === reference && this.status)
                return;
        }

        this._reference = reference;
        super.show(reference, cb);
    }

    step(direction: 'previous' | 'next') {
        let index = this.renderArray.findIndex((item) => {
            return item === this.activeItem;
        });
        index = direction === 'next' ? index + 1 : index - 1;

        if (index < 0)
            index = this.renderArray.length - 1;
        else if (index >= this.renderArray.length)
            index = 0;

        this.activeItem = this.renderArray[index];
        this.render();
        const activeEle = this.getItemElement(this.activeItem);
        if (activeEle)
            this.activeEleScrollIntoView(activeEle);
    }

    selectItem(item: unknown) {
        const { cb } = this;
        cb && cb(item);
        // Delay hide to avoid dispatch enter handler
        requestAnimationFrame(this.hide.bind(this));
    }

    abstract render(): void;

    abstract getItemElement(item: unknown): HTMLElement | null;
}

export default BaseScrollFloat;
