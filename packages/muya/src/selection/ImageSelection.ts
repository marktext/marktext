import type Format from '../block/base/format';
import type { Muya } from '../muya';
import type { IImageInfo } from '../utils/image';
import type Selection from './index';
import type { IImageSelection } from './types';
import { BLOCK_DOM_PROPERTY, CLASS_NAMES } from '../config';
import { LINK_SELECTOR } from '../editor/linkMouseEvents';
import { isHTMLElement, isKeyboardEvent } from '../utils';
import { getImageInfo, getImageSrc } from '../utils/image';
import { findContentDOM } from './dom';

class ImageSelection {
    private _wrapper: HTMLElement | null = null;

    constructor(private _muya: Muya, private _selection: Selection) {}

    attach(): void {
        const { eventCenter, domNode } = this._muya;
        eventCenter.attachDOMEvent(domNode, 'mousedown', (event) => {
            if (event.target instanceof Element && !event.target.closest(`.${CLASS_NAMES.MU_INLINE_IMAGE}`))
                this._selection.clearImage();
        });
        eventCenter.attachDOMEvent(domNode, 'click', this._handleClick);
        eventCenter.attachDOMEvent(document, 'click', this._handleDocClick);
        eventCenter.attachDOMEvent(document, 'keydown', this._handleKeydown);
    }

    clear(): void {
        this._wrapper?.classList.remove(CLASS_NAMES.MU_INLINE_IMAGE_SELECTED);
        this._wrapper = null;
    }

    setSelection(selection: IImageSelection): void {
        this._wrapper = selection.context.domNode?.closest<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`) ?? null;
        this._wrapper?.classList.add(CLASS_NAMES.MU_INLINE_IMAGE_SELECTED);
    }

    private _handleDocClick = (event: Event): void => {
        const target = event.target;
        if (target instanceof Element && !this._muya.domNode.contains(target) && !target.closest('.mu-float-wrapper, .mu-transformer'))
            this._selection.clearImage();
    };

    private _handleClick = (event: Event): void => {
        const { target } = event;
        if (!isHTMLElement(target))
            return;
        const imageWrapper = target.closest<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
        if (imageWrapper)
            this._handleClickInlineImage(event, imageWrapper);
        else
            this._selection.clearImage();
    };

    private _handleKeydown = (event: Event): void => {
        if (this._muya.isReadOnly)
            return;
        if (!isKeyboardEvent(event))
            return;

        const { key } = event;
        const context = this._selection.getImageSelection()?.context;
        if (!context)
            return;
        const selected = { ...context.imageInfo, block: context.block };

        if (!selected.block.outMostBlock) {
            this._selection.clearImage();
            return;
        }

        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            event.preventDefault();
            const offset = key === 'ArrowLeft' ? selected.token.range.start : selected.token.range.end;
            selected.block.setCursor(offset, offset, true);
            return;
        }

        if (key === ' ') {
            event.preventDefault();
            this._previewSelectedImage(selected);
            return;
        }

        if (/^(?:Backspace|Delete|Enter)$/.test(key)) {
            event.preventDefault();
            const { block, ...imageInfo } = selected;
            block.deleteImage(imageInfo);
        }
    };

    private _previewSelectedImage(selected: IImageInfo & { block: Format }) {
        const { token, imageId } = selected;
        const tokenSrc = ('src' in token ? token.src : '') || token.attrs.src || '';
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

        this._selection.selectImage({ ...imageInfo, block: contentBlock });
        if (this._muya.isReadOnly)
            return;

        if (deleteContainer) {
            contentBlock.deleteImage(imageInfo);

            return;
        }

        if (isHTMLElement(target) && target.tagName === 'IMG') {
            // Modifier-clicking a linked image opens its link; suppress the competing preview (#3835).
            if (
                event instanceof MouseEvent
                && (event.metaKey || event.ctrlKey)
                && !imageWrapper.closest(LINK_SELECTOR)
            ) {
                const tokenSrc = ('src' in imageInfo.token ? imageInfo.token.src : '') || imageInfo.token.attrs.src || '';
                const src = getImageSrc(tokenSrc).src || target.getAttribute('src') || '';
                if (src) {
                    eventCenter.emit('format-click', {
                        event,
                        formatType: 'image',
                        data: src,
                    });
                }
            }

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
