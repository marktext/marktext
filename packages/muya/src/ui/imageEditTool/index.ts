import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { Muya } from '../../index';
import type { ImageToken } from '../../inlineRenderer/types';
import type { IImagePathSuggestion } from '../imagePicker';
import type { IBaseOptions } from '../types';
import { EVENT_KEYS, isWin, URL_REG } from '../../config';
import { getUniqueId, isHTMLInputElement, isKeyboardEvent } from '../../utils';

import { query } from '../../utils/dom';
import { getImageInfo, getImageSrc } from '../../utils/image';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';
import { ImagePathPicker } from '../imagePicker';
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
    /** Custom image path picker function (one-shot native file dialog) */
    imagePathPicker?: () => Promise<string>;
    /**
     * Local image path autocomplete hook. Given the current src input value,
     * returns a list of path suggestions to show in the floating
     * {@link ImagePathPicker}, typically backed by a filesystem directory
     * listing.
     */
    imagePathAutoComplete?: (src: string) => Promise<IImagePathSuggestion[]>;
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

    /** Monotonic counter used to drop out-of-order imagePathAutoComplete responses */
    private _autoCompleteSeq = 0;

    /** Current editing state */
    private _state: IState = {
        alt: '',
        src: '',
        title: '',
    };

    /** Active tab: file picker ("select") or link/path input ("link") */
    private _tab: 'select' | 'link' = 'link';

    /** Whether the link tab shows the alt and title inputs as well as src */
    private _isFullMode = false;

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
            // Force the value — when reopening the tool snabbdom may skip the
            // value prop (the user dirtied the DOM input between renders).
            input.value = this._state.src;
            input.focus();
            input.select();
        }
    }

    /**
     * Handle input change for an editable image field (src / alt / title).
     * @param event - Input event
     * @param type - Which image field the input edits
     */
    private _inputHandler(event: Event, type: keyof IState) {
        if (!isHTMLInputElement(event.target))
            return;
        this._state[type] = event.target.value;
    }

    /**
     * Switch the active tab and re-render.
     * @param tab - Tab to activate
     */
    private _tabClick(tab: 'select' | 'link') {
        this._tab = tab;
        this._render();
    }

    /**
     * Toggle between simple (src only) and full (alt + src + title) mode.
     */
    private _toggleMode() {
        this._isFullMode = !this._isFullMode;
        this._render();
    }

    /**
     * Handle keydown on the alt / title inputs — Enter confirms the change.
     * @param event - Keyboard event
     */
    private _handleKeyDown(event: Event) {
        if (!isKeyboardEvent(event))
            return;
        if (event.key === EVENT_KEYS.Enter) {
            event.stopPropagation();
            this._handleConfirm();
        }
    }

    /**
     * Locate the floating image-path picker if it is currently open.
     * Plugins are registered privately on Muya, so we resolve the instance via
     * the shared `ui.shownFloat` registry (the same pattern tableColumnToolbar
     * uses to find the format picker). Returns null when the picker plugin is
     * not registered or not currently shown.
     */
    private _getOpenImagePathPicker(): ImagePathPicker | null {
        for (const tool of this.muya.ui.shownFloat) {
            if (tool instanceof ImagePathPicker && tool.status)
                return tool;
        }
        return null;
    }

    /**
     * Handle keydown on the src input.
     * When the autocomplete picker is open, arrow keys / Tab / Enter drive the
     * picker (navigate + choose) instead of confirming. Otherwise Enter
     * confirms the change.
     * @param event - Keyboard event
     */
    private _handleSrcKeyDown(event: Event) {
        if (!isKeyboardEvent(event))
            return;

        const picker = this._getOpenImagePathPicker();
        if (!picker) {
            if (event.key === EVENT_KEYS.Enter) {
                event.stopPropagation();
                this._handleConfirm();
            }
            return;
        }

        switch (event.key) {
            case EVENT_KEYS.ArrowUp:
                event.preventDefault();
                // Stop the editor's BaseScrollFloat keydown handler (bound on
                // muya.domNode) from also stepping the picker — otherwise the
                // active item advances twice per keypress.
                event.stopPropagation();
                picker.step('previous');
                break;

            case EVENT_KEYS.ArrowDown:
            case EVENT_KEYS.Tab:
                event.preventDefault();
                event.stopPropagation();
                picker.step('next');
                break;

            case EVENT_KEYS.Enter:
                event.preventDefault();
                event.stopPropagation();
                if (picker.activeItem)
                    picker.selectItem(picker.activeItem);
                break;

            default:
                break;
        }
    }

    /**
     * Handle keyup on the src input.
     * Re-queries the `imagePathAutoComplete` hook (debounced via the browser's
     * natural keystroke cadence) and dispatches `muya-image-picker` so the
     * floating picker refreshes its suggestions. Navigation keys are ignored so
     * they don't re-trigger a fetch while the user is moving through the list.
     * @param event - Keyboard event
     */
    private async _handleSrcKeyUp(event: Event) {
        if (!isKeyboardEvent(event) || !this.options.imagePathAutoComplete)
            return;

        const { key } = event;
        if (
            key === EVENT_KEYS.ArrowUp
            || key === EVENT_KEYS.ArrowDown
            || key === EVENT_KEYS.Tab
            || (key === EVENT_KEYS.Enter
                && !this._state.src.endsWith('/')
                && !this._state.src.endsWith('\\'))
        ) {
            return;
        }

        const { eventCenter } = this.muya;
        const value = this._state.src;
        const reference = this.container
            ? query<HTMLInputElement>('input.src', this.container)
            : null;

        // Write the chosen suggestion back into the src input. The new value is
        // the directory portion of the current path plus the chosen basename.
        const cb = (item: IImagePathSuggestion) => {
            if (!reference)
                return;

            const { text } = item;
            // Derive the directory prefix from the CURRENT input value — the
            // user may have kept typing after the suggestions were fetched, so
            // the value captured on keyup can be stale.
            const current = reference.value;
            let basePath = '';
            const pathSep = current.match(/(?:\/|\\)[^/\\]*$/);
            if (pathSep && pathSep[0])
                basePath = current.substring(0, pathSep.index! + 1);

            const newValue = basePath + text;
            const len = newValue.length;
            reference.value = newValue;
            this._state.src = newValue;
            reference.focus();
            reference.setSelectionRange(len, len);
        };

        // Guard against out-of-order resolution: if the user types again before
        // a slower earlier request resolves, drop the stale response.
        const seq = ++this._autoCompleteSeq;
        const list = value ? await this.options.imagePathAutoComplete(value) : [];
        if (seq !== this._autoCompleteSeq)
            return;
        eventCenter.emit('muya-image-picker', { reference, list, cb });
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
     * Hide the tool and dismiss the autocomplete picker alongside it so a
     * confirm/close never leaves a dangling suggestions dropdown.
     */
    override hide() {
        const picker = this._getOpenImagePathPicker();
        if (picker)
            picker.hide();
        super.hide();
    }

    /**
     * Handle click on the "Choose Image" button in the select tab.
     * Opens the one-shot native file picker and applies the chosen path
     * directly (matching the legacy ImageSelector select-tab behavior).
     */
    private async _handleSelectButtonClick() {
        if (!this.options.imagePathPicker) {
            console.warn('You need to add a imagePathPicker option');
            return;
        }

        const path = await this.options.imagePathPicker();
        const { alt, title } = this._state;
        return this._replaceImageAsync({ alt, title, src: path });
    }

    /**
     * Render the tab header (Select / Embed link).
     */
    private _renderHeader(): VNode {
        const { i18n } = this.muya;
        const tabs: { label: string; value: 'select' | 'link' }[] = [
            { label: i18n.t('Select'), value: 'select' },
            { label: i18n.t('Embed link'), value: 'link' },
        ];

        const children = tabs.map((tab) => {
            const selector = this._tab === tab.value ? 'li.active' : 'li';
            return h(selector, [
                h(
                    'span',
                    { on: { click: () => this._tabClick(tab.value) } },
                    tab.label,
                ),
            ]);
        });

        return h('ul.header', children);
    }

    /**
     * Render the "Select" tab body: a Choose Image button and a tip.
     */
    private _renderSelectBody(): VNode[] {
        const { i18n } = this.muya;
        return [
            h(
                'button.role-button.select',
                { on: { click: () => this._handleSelectButtonClick() } },
                i18n.t('Choose Image'),
            ),
            h('span.description', i18n.t('Choose image from your computer.')),
        ];
    }

    /**
     * Render the "Embed link" tab body: the input container (src, plus alt and
     * title in full mode), the Embed button and the simple/full mode hint.
     */
    private _renderLinkBody(): VNode[] {
        const { i18n } = this.muya;
        const { alt, src, title } = this._state;

        const altInput = h('input.alt', {
            props: { placeholder: i18n.t('Alt text'), value: alt },
            on: {
                input: (event: Event) => this._inputHandler(event, 'alt'),
                paste: (event: Event) => this._inputHandler(event, 'alt'),
                keydown: (event: Event) => this._handleKeyDown(event),
            },
        });
        const srcInput = h('input.src', {
            props: { placeholder: i18n.t('Image link or local path'), value: src },
            on: {
                input: (event: Event) => this._inputHandler(event, 'src'),
                paste: (event: Event) => this._inputHandler(event, 'src'),
                keydown: (event: Event) => this._handleSrcKeyDown(event),
                keyup: (event: Event) => this._handleSrcKeyUp(event),
            },
        });
        const titleInput = h('input.title', {
            props: { placeholder: i18n.t('Image title'), value: title },
            on: {
                input: (event: Event) => this._inputHandler(event, 'title'),
                paste: (event: Event) => this._inputHandler(event, 'title'),
                keydown: (event: Event) => this._handleKeyDown(event),
            },
        });

        const inputWrapper = this._isFullMode
            ? h('div.input-container', [altInput, srcInput, titleInput])
            : h('div.input-container', [srcInput]);

        const embedButton = h(
            'button.role-button.link',
            { on: { click: () => this._handleConfirm() } },
            i18n.t('Embed Image'),
        );

        const bottomDes = h('span.description', [
            h('span', `${i18n.t('Paste web image or local image path. Use')} `),
            h(
                'a',
                { on: { click: () => this._toggleMode() } },
                `${this._isFullMode ? i18n.t('simple mode') : i18n.t('full mode')}.`,
            ),
        ]);

        return [inputWrapper, embedButton, bottomDes];
    }

    /**
     * Render the image edit tool UI as a tabbed selector matching the legacy
     * ImageSelector: a header (Select / Embed link) and the active tab body.
     */
    private _render() {
        const { _oldVNode: oldVNode, _imageSelectorContainer: imageSelectorContainer } = this;

        const body = this._tab === 'select'
            ? this._renderSelectBody()
            : this._renderLinkBody();

        const vnode = h('div', [
            this._renderHeader(),
            h('div.image-select-body', body),
        ]);

        patch(oldVNode || imageSelectorContainer, vnode);
        this._oldVNode = vnode;
    }
}
