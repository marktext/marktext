import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { Muya } from '../../index';
import type { ImageToken } from '../../inlineRenderer/types';
import type { IBaseOptions } from '../types';
import { EVENT_KEYS, isWin, URL_REG } from '../../config';
import { getUniqueId, isHTMLInputElement, isKeyboardEvent } from '../../utils';
import { query } from '../../utils/dom';

import { getImageInfo, getImageSrc } from '../../utils/image';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';
import './index.css';

/**
 * Image state interface containing source, alt text and title
 */
interface IState {
    /** Image source URL or file path */
    src: string;
    /** Image alternative text */
    alt: string;
    /** Image title */
    title: string;
}

/**
 * Image edit tool options
 */
type Options = {
    /** Custom image path picker function */
    imagePathPicker?: () => Promise<string>;
    /** Image upload action handler */
    imageAction?: (state: IState) => Promise<string>;
} & IBaseOptions;

/** Default float options for image edit tool */
const defaultOptions = {
    placement: 'bottom' as const,
    offsetOptions: {
        mainAxis: 0,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

/** File protocol prefix length for Windows */
const FILE_PROTOCOL_WIN_LENGTH = 8;
/** File protocol prefix length for other platforms */
const FILE_PROTOCOL_LENGTH = 7;

/**
 * Image edit tool for editing image source, alt text and title
 * Provides a float UI to edit image properties with optional file picker and upload support
 */
export class ImageEditTool extends BaseFloat {
    public override options: Options;
    static pluginName = 'imageSelector';

    /** Previous virtual node for patching */
    private _oldVNode: VNode | null = null;

    /** Current image information including token and ID */
    private _imageInfo: {
        token: ImageToken;
        imageId: string;
    } | null = null;

    /** The block containing the image */
    private _block: Format | null = null;

    /** Current editing state */
    private _state: IState = {
        alt: '',
        src: '',
        title: '',
    };

    /** Container element for the image selector */
    private _imageSelectorContainer: HTMLDivElement
        = document.createElement('div');

    /**
     * Create image edit tool instance
     * @param muya - Muya editor instance
     * @param options - Tool options including image picker and upload handler
     */
    constructor(muya: Muya, options: Options = { ...defaultOptions }) {
        const name = 'mu-image-selector';
        super(muya, name, Object.assign({}, defaultOptions, options));
        this.options = Object.assign({}, defaultOptions, options);
        this.container!.appendChild(this._imageSelectorContainer);
        this.floatBox!.classList.add('mu-image-selector-wrapper');
        this.listen();
    }

    /**
     * Listen to image selector events
     * Handles showing/hiding the tool and initializing state from image info
     */
    override listen() {
        super.listen();
        const { eventCenter } = this.muya;
        eventCenter.on('muya-image-selector', ({ block, reference, imageInfo }) => {
            if (!reference) {
                this.hide();
                return;
            }

            this._block = block;
            Object.assign(this._state, imageInfo.token.attrs);

            // Remove file protocol prefix for local file paths to enable autocomplete
            this._normalizeFileProtocol();

            this._imageInfo = imageInfo;
            this.show(reference);
            this._render();

            // Auto focus and select the src input for quick editing
            this._focusSrcInput();
        });
    }

    /**
     * Normalize file protocol in image source
     * Removes file:// or file:/// prefix for local paths
     */
    private _normalizeFileProtocol() {
        const { src } = this._state;
        if (!src || !/^file:\/\//.test(src))
            return;

        const protocolLen = isWin && /^file:\/\/\//.test(src)
            ? FILE_PROTOCOL_WIN_LENGTH
            : FILE_PROTOCOL_LENGTH;

        this._state.src = src.substring(protocolLen);
    }

    /**
     * Focus and select the src input element
     */
    private _focusSrcInput() {
        const input = this.container ? query<HTMLInputElement>('input.src', this.container) : null;
        if (input) {
            input.focus();
            input.select();
        }
    }

    /**
     * Handle input change for image source
     * @param event - Input event
     */
    private _handleSrcInput(event: Event) {
        if (!isHTMLInputElement(event.target))
            return;
        this._state.src = event.target.value;
    }

    /**
     * Handle Enter key press to confirm changes
     * @param event - Keyboard event
     */
    private _handleEnter(event: Event) {
        if (!isKeyboardEvent(event))
            return;

        event.stopPropagation();
        if (event.key === EVENT_KEYS.Enter)
            this._handleConfirm();
    }

    /**
     * Confirm and apply image changes
     */
    private _handleConfirm() {
        return this._replaceImageAsync(this._state);
    }

    /**
     * Replace image asynchronously
     * Handles two scenarios:
     * 1. Direct replacement: when src is a URL or no imageAction provided
     * 2. Upload flow: when src is a local path and imageAction is available
     * @param param - Image state object
     * @param param.alt - Image alt text
     * @param param.src - Image source (local path or URL)
     * @param param.title - Image title
     */
    private _replaceImageAsync = async ({ alt, src, title }: IState) => {
        // No source provided, just hide
        if (!src) {
            this.hide();
            return;
        }
        // Direct replacement: no upload needed
        if (!this.options.imageAction || URL_REG.test(src)) {
            this._replaceImageDirect(alt, src, title);
            return;
        }

        // Upload flow: show loading state, upload, then replace
        await this._replaceImageWithUpload(alt, src, title);
    };

    /**
     * Replace image directly without upload
     * Only replaces if values have changed
     */
    private _replaceImageDirect(alt: string, src: string, title: string) {
        const { alt: oldAlt, src: oldSrc, title: oldTitle } = this._imageInfo!.token.attrs;

        // Only update if something changed
        if (alt !== oldAlt || src !== oldSrc || title !== oldTitle) {
            this._block!.replaceImage(this._imageInfo!, { alt, src, title });
        }

        this.hide();
    }

    /**
     * Replace image with upload flow
     * Shows loading state, uploads the image, then replaces with uploaded URL
     */
    private async _replaceImageWithUpload(alt: string, src: string, title: string) {
        // Create unique ID for loading state
        const loadingId = `loading-${getUniqueId()}`;

        // Show loading state
        this._block!.replaceImage(this._imageInfo!, {
            alt: loadingId,
            src,
            title,
        });
        this.hide();

        // Upload image and get new URL
        const uploadedSrc = await this.options.imageAction!({ src, title, alt });

        // Store local path mapping if available
        const { src: localPath } = getImageSrc(src);
        if (localPath) {
            this.muya.editor.inlineRenderer.renderer.urlMap.set(uploadedSrc, localPath);
        }

        // Find and update the image element
        const imageWrapper = query<HTMLElement>(
            `span[data-id=${loadingId}]`,
            this.muya.domNode,
        );

        if (imageWrapper) {
            const imageInfo = getImageInfo(imageWrapper);
            this._block!.replaceImage(imageInfo, {
                alt,
                src: uploadedSrc,
                title,
            });
        }
    }

    /**
     * Handle click on "more" button to open file picker
     * Updates the src input with selected path
     */
    private async _handleMoreClick() {
        if (!this.options.imagePathPicker)
            return;

        const path = await this.options.imagePathPicker();
        this._state.src = path;
        this._render();
    }

    /**
     * Render the image edit tool UI
     * Creates virtual DOM with file picker button (optional), src input and confirm button
     */
    private _render() {
        const { _oldVNode: oldVNode, _imageSelectorContainer: imageSelectorContainer, _state: { src } } = this;
        const { i18n } = this.muya;

        // Optional file picker button
        const moreButton = this.options.imagePathPicker
            ? h(
                    'span.more',
                    {
                        on: {
                            click: () => this._handleMoreClick(),
                        },
                    },
                    h('span.more-inner'),
                )
            : null;

        // Image source input
        const srcInput = h('input.src', {
            props: {
                placeholder: i18n.t('Image src placeholder'),
                value: src,
            },
            on: {
                input: event => this._handleSrcInput(event),
                paste: event => this._handleSrcInput(event),
                keydown: event => this._handleEnter(event),
            },
        });

        // Confirm button
        const confirmButton = h(
            'span.confirm',
            {
                on: {
                    click: () => this._handleConfirm(),
                },
            },
            i18n.t('Confirm Text'),
        );

        const vnode = h('div.image-edit-tool', [
            moreButton,
            srcInput,
            confirmButton,
        ]);

        patch(oldVNode || imageSelectorContainer, vnode);
        this._oldVNode = vnode;
    }
}
