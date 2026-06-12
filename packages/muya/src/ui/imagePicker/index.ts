import type { VNode } from 'snabbdom';
import type { Muya } from '../../index';
import { query } from '../../utils/dom';

import { h, patch } from '../../utils/snabbdom';
import BaseScrollFloat from '../baseScrollFloat';

import './index.css';

/**
 * A single path suggestion produced by the `imagePathAutoComplete` hook.
 * `text` is the basename rendered (and written back into the src input);
 * `iconClass` selects a font-icon class, `type` distinguishes files from
 * directories. Extra keys are tolerated so callers can carry metadata.
 */
export interface IImagePathSuggestion {
    text: string;
    iconClass?: string;
    type?: string;
    [key: string]: unknown;
}

/** Payload of the `muya-image-picker` event the ImageEditTool dispatches. */
interface IImagePickerEvent {
    reference: HTMLElement | null;
    list: IImagePathSuggestion[];
    cb: (item: IImagePathSuggestion) => void;
}

const defaultOptions = {
    placement: 'bottom-start' as const,
    offsetOptions: {
        mainAxis: 0,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

/**
 * Floating autocomplete dropdown that suggests local image file paths as the
 * user edits an image's `src` in the {@link ImageEditTool}. It listens
 * for the `muya-image-picker` event, renders a scrollable filtered list, and
 * supports arrow-key navigation plus Enter/click to choose. The chosen path is
 * written back through the callback supplied in the event payload.
 *
 * The list itself is produced by the host application via the
 * `imagePathAutoComplete` option on the ImageEditTool — muya only renders the
 * result and reports the selection.
 */
export class ImagePathPicker extends BaseScrollFloat {
    static pluginName = 'imagePathPicker';

    private _oldVNode: VNode | null = null;
    public override renderArray: IImagePathSuggestion[] = [];
    public override activeItem: IImagePathSuggestion | null = null;

    constructor(muya: Muya, options = {}) {
        const name = 'mu-list-picker';
        const opts = Object.assign({}, defaultOptions, options);
        super(muya, name, opts);
        this.floatBox!.classList.add('mu-image-picker-wrapper');
        this.listen();
    }

    override listen() {
        super.listen();
        const { eventCenter } = this.muya;
        eventCenter.on('muya-image-picker', ({ reference, list, cb }: IImagePickerEvent) => {
            if (reference && list.length) {
                this.show(reference, cb);
                this.renderArray = list;
                this.activeItem = list[0];
                this.render();
            }
            else {
                this.hide();
            }
        });
    }

    render() {
        const { renderArray, _oldVNode: oldVNode, scrollElement, activeItem } = this;
        const children = renderArray.map((item, index) => {
            const { text, iconClass } = item;
            // Icons are font-icon classes. When the host omits `iconClass` we
            // simply render the text without an icon.
            const iconContent = iconClass
                ? [h('div.icon-wrapper', h(`span.${iconClass}`))]
                : [];
            const textEle = h('div.text', text);
            const selector = activeItem === item ? 'li.item.active' : 'li.item';

            return h(
                selector,
                {
                    // Index-based lookup — file names can contain quotes/brackets
                    // (unsafe in an attribute selector) and duplicate basenames
                    // would otherwise collide on a text-based attribute.
                    dataset: {
                        index: String(index),
                    },
                    on: {
                        click: () => {
                            this.selectItem(item);
                        },
                    },
                },
                [...iconContent, textEle],
            );
        });

        const vnode = h('ul', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(scrollElement!, vnode);

        this._oldVNode = vnode;
    }

    getItemElement(item: IImagePathSuggestion): HTMLElement | null {
        const index = this.renderArray.indexOf(item);
        if (index < 0)
            return null;

        return query<HTMLElement>(`[data-index="${index}"]`, this.floatBox!);
    }
}

export default ImagePathPicker;
