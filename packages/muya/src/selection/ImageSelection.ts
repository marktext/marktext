import type Format from '../block/base/format';
import type { Muya } from '../muya';
import type Selection from './index';
import type { IImageSelectionData } from './types';
import { BLOCK_DOM_PROPERTY, CLASS_NAMES } from '../config';
import { LINK_SELECTOR } from '../editor/linkMouseEvents';
import { isHTMLElement, isKeyboardEvent } from '../utils';
import { getImageInfo, getImageSrc } from '../utils/image';
import { findContentDOM } from './dom';
import { SelectionType } from './types';

class ImageSelection {
    selected: IImageSelectionData | null = null;

    constructor(private _muya: Muya, private _selection: Selection) {}

    attach(): void {
        const { eventCenter, domNode } = this._muya;
        eventCenter.attachDOMEvent(domNode, 'click', this._handleClick);
        eventCenter.attachDOMEvent(document, 'click', this._handleDocClick);
        eventCenter.attachDOMEvent(document, 'keydown', this._handleKeydown);
    }

    clear(): void {
        this.selected = null;
    }

    private _handleDocClick = (): void => {
        this.selected = null;
    };

    private _handleClick = (event: Event): void => {
        const { target } = event;
        if (!isHTMLElement(target))
            return;
        const imageWrapper = target.closest<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
        this.selected = null;
        if (imageWrapper)
            this._handleClickInlineImage(event, imageWrapper);
    };

    private _handleKeydown = (event: Event): void => {
        if (!isKeyboardEvent(event))
            return;

        const { key } = event;
        const { selected } = this;
        if (!selected)
            return;

        if (key === ' ') {
            event.preventDefault();
            this._previewSelectedImage(selected);
            return;
        }

        if (/^(?:Backspace|Delete|Enter)$/.test(key)) {
            event.preventDefault();
            const { block, ...imageInfo } = selected;
            block.deleteImage(imageInfo);
            this._selection.activate(SelectionType.TEXT);
        }
    };

    private _previewSelectedImage(selected: IImageSelectionData) {
        const { token, imageId } = selected;
        const tokenSrc = token.src || token.attrs.src || '';
        const imgSrc
            = this._muya.domNode
                .querySelector<HTMLImageElement>(`#${imageId} img`)
                ?.getAttribute('src') ?? '';
        const src = getImageSrc(tokenSrc).src || imgSrc;

        if (src) {
            this._muya.eventCenter.emit('preview-image', {
                data: src,
            });
        }
    }

    private _handleClickInlineImage(event: Event, imageWrapper: HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        const { eventCenter } = this._muya;
        const imageInfo = getImageInfo(imageWrapper);
        const { target } = event;
        if (!(target instanceof Node))
            return;
        const deleteContainer = isHTMLElement(target)
            ? target.closest('.mu-image-icon-close')
            : null;
        const contentDom = findContentDOM(target);

        if (!contentDom)
            return;

        const contentBlock = contentDom[BLOCK_DOM_PROPERTY] as Format;

        if (deleteContainer) {
            contentBlock.deleteImage(imageInfo);

            return;
        }

        if (isHTMLElement(target) && target.tagName === 'IMG') {
            // A linked image (e.g. `[![alt](src)](href)`) renders its image
            // wrapper inside a link element. On modifier-click the link handler
            // (linkMouseEvents) opens the URL; don't also emit the image preview,
            // which would pop a viewer over the navigation (#3835). Reuse
            // linkMouseEvents' selector so every link variant is covered (plain,
            // reference, autolink, raw-HTML anchor), not just `mu-link`.
            if (
                event instanceof MouseEvent
                && (event.metaKey || event.ctrlKey)
                && !imageWrapper.closest(LINK_SELECTOR)
            ) {
                const tokenSrc = imageInfo.token.src || imageInfo.token.attrs.src || '';
                const src = getImageSrc(tokenSrc).src || target.getAttribute('src') || '';
                if (src) {
                    eventCenter.emit('format-click', {
                        event,
                        formatType: 'image',
                        data: src,
                    });
                }
            }

            const rect = imageWrapper
                .querySelector(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`)
                ?.getBoundingClientRect();
            const reference = {
                getBoundingClientRect: () => rect,
                width: imageWrapper.offsetWidth,
                height: imageWrapper.offsetHeight,
            };

            eventCenter.emit('muya-image-toolbar', {
                block: contentBlock,
                reference,
                imageInfo,
            });

            // Resolve the image container from the clicked wrapper directly.
            // Images that share the same src (and paragraph offset) render with
            // duplicate DOM ids, so a `document.querySelector('#id ...')` lookup
            // would resolve to the first occurrence and place the resize bar on
            // the wrong image.
            const imageContainer = imageWrapper.querySelector(
                `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
            );

            eventCenter.emit('muya-transformer', {
                block: contentBlock,
                reference: imageContainer,
                imageInfo,
            });

            this._selection.selectImage(Object.assign({}, imageInfo, { block: contentBlock }));

            return;
        }

        if (
            imageWrapper.classList.contains(CLASS_NAMES.MU_EMPTY_IMAGE)
            || imageWrapper.classList.contains(CLASS_NAMES.MU_IMAGE_FAIL)
        ) {
            const rect = imageWrapper.getBoundingClientRect();
            const reference = {
                getBoundingClientRect: () => rect,
                width: imageWrapper.offsetWidth,
                height: imageWrapper.offsetHeight,
            };
            eventCenter.emit('muya-image-selector', {
                block: contentBlock,
                reference,
                imageInfo,
            });
        }
    }
}

export default ImageSelection;
