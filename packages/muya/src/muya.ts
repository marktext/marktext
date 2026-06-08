import type Content from './block/base/content';
import type Parent from './block/base/parent';
import type { Listener } from './event/types';
import type { ILocale } from './i18n/types';
import type { ITocItem } from './state/getTOC';
import type { TState } from './state/types';
import type { IMuyaOptions } from './types';
import Format from './block/base/format';
import { ScrollPage } from './block/scrollPage';
import emptyStates from './config/emptyStates';
import {
    CLASS_NAMES,
    MUYA_DEFAULT_OPTIONS,
} from './config/index';
import { Editor } from './editor/index';

import EventCenter from './event/index';
import I18n from './i18n/index';
import { getTOC } from './state/getTOC';
import { Ui } from './ui/ui';
import { deepClone } from './utils';
import './assets/styles/blockSyntax.css';
import './assets/styles/index.css';
import './assets/styles/inlineSyntax.css';
import './assets/styles/prismjs/light.theme.css';

// UI plugins (e.g. InlineFormatToolbar, EmojiSelector) follow a common
// shape: a class with a static `pluginName` and a constructor that takes
// `(muya: Muya, options: object)`. `Muya.use` records the constructor + an
// arbitrary options object; `init()` instantiates each plugin.
export interface IMuyaPluginConstructor {
    pluginName: string;
    new(muya: Muya, options: Record<string, unknown>): unknown;
}

interface IPlugin {
    plugin: IMuyaPluginConstructor;
    options: Record<string, unknown>;
}

export class Muya {
    static plugins: IPlugin[] = [];

    static use(plugin: IMuyaPluginConstructor, options: Record<string, unknown> = {}) {
        this.plugins.push({
            plugin,
            options,
        });
    }

    public readonly version = typeof window.MUYA_VERSION === 'undefined' ? 'dev' : window.MUYA_VERSION;
    public options: IMuyaOptions = MUYA_DEFAULT_OPTIONS;
    public eventCenter: EventCenter;
    public domNode: HTMLElement;
    public editor: Editor;
    public ui: Ui;
    public i18n: I18n;

    private _uiPlugins: Record<string, unknown> = {};

    constructor(element: HTMLElement, options?: Partial<IMuyaOptions>) {
        this.options = Object.assign({}, MUYA_DEFAULT_OPTIONS, options ?? {});
        this.eventCenter = new EventCenter();
        this.domNode = getContainer(element, this.options);
        // this.domNode[BLOCK_DOM_PROPERTY] = this;
        this.editor = new Editor(this);
        this.ui = new Ui(this);
        this.i18n = new I18n(this, this.options.locale);
        this._bindFocusBlurEvents();
    }

    // Backport of marktext 9eff8248: expose `focus` / `blur` lifecycle events
    // so external SDK consumers can react to editor focus changes. Routed
    // through attachDOMEvent so cleanup is automatic via detachAllDomEvents
    // in destroy().
    private _bindFocusBlurEvents() {
        this.eventCenter.attachDOMEvent(this.domNode, 'focus', () => {
            this.eventCenter.emit('focus');
        });
        this.eventCenter.attachDOMEvent(this.domNode, 'blur', () => {
            this.eventCenter.emit('blur');
        });
    }

    init() {
        this.editor.init();

        // UI plugins
        if (Muya.plugins.length) {
            for (const { plugin: Plugin, options: opts } of Muya.plugins)
                this._uiPlugins[Plugin.pluginName] = new Plugin(this, opts);
        }
    }

    locale(object: ILocale) {
        return this.i18n.locale(object);
    }

    /**
     * [on] on custom event
     */
    on(event: string, listener: Listener) {
        this.eventCenter.on(event, listener);
    }

    /**
     * [off] off custom event
     */
    off(event: string, listener: Listener) {
        this.eventCenter.off(event, listener);
    }

    /**
     * [once] subscribe event and listen once
     */
    once(event: string, listener: Listener) {
        this.eventCenter.once(event, listener);
    }

    getState() {
        return this.editor.jsonState.getState();
    }

    getMarkdown() {
        return this.editor.jsonState.getMarkdown();
    }

    /**
     * Return a flat table of contents for the current document.
     *
     * Mirrors marktext's `tocCtrl.getTOC` (including the 9cb2cbe8 regex
     * fix). Only top-level atx / setext headings are surfaced; nested
     * headings inside blockquotes / list items are ignored, same as
     * marktext. `content` is the raw heading text (inline markdown not
     * parsed); `slug` is a stable per-block identifier; `githubSlug` is
     * the GitHub-style anchor derived from `content`.
     */
    getTOC(): ITocItem[] {
        return getTOC(this);
    }

    undo() {
        this.editor.history.undo();
    }

    redo() {
        this.editor.history.redo();
    }

    /**
     * Search value in current document.
     * @param {string} value
     * @param {object} opts
     */
    search(value: string, opts = {}) {
        return this.editor.searchModule.search(value, opts);
    }

    /**
     * Find preview or next value, and highlight it.
     * @param {string} action : previous or next.
     */
    find(action: 'previous' | 'next') {
        return this.editor.searchModule.find(action);
    }

    replace(replaceValue: string, opt = { isSingle: true, isRegexp: false }) {
        return this.editor.searchModule.replace(replaceValue, opt);
    }

    setContent(content: TState[] | string, autoFocus = false) {
        this.editor.setContent(content, autoFocus);
    }

    focus() {
        this.editor.focus();
    }

    /**
     * Toggle focus mode (mirrors marktext muyajs `setFocusMode`). When enabled,
     * every top-level block except the one holding the cursor is dimmed via the
     * `mu-focus-mode` class on the editor container; the dimming itself lives in
     * the stylesheet (`.mu-focus-mode .mu-container > * { opacity }`).
     */
    setFocusMode(focusMode: boolean) {
        if (focusMode)
            this.domNode.classList.add(CLASS_NAMES.MU_FOCUS_MODE);
        else
            this.domNode.classList.remove(CLASS_NAMES.MU_FOCUS_MODE);

        this.options.focusMode = focusMode;
    }

    selectAll() {
        this.editor.selection.selectAll();
    }

    /**
     * Toggle an inline format on the current selection.
     * @param type One of strong/em/u/del/inline_code/link/image/inline_math/
     * sub/sup/mark/clear (and html_tag aliases). No-op when the selection is
     * not inside a single formattable block.
     */
    format(type: string) {
        const { selection } = this.editor;
        const sel = selection.getSelection();
        if (!sel)
            return;

        const {
            anchor,
            focus,
            anchorBlock,
            anchorPath,
            focusBlock,
            focusPath,
            isSelectionInSameBlock,
        } = sel;

        if (!isSelectionInSameBlock || !(anchorBlock instanceof Format))
            return;

        // Restore the selection before applying the format, mirroring the
        // inline format toolbar — the menu/IPC round-trip can drop the live
        // DOM selection.
        selection.setSelection({
            anchor,
            focus,
            anchorBlock,
            anchorPath,
            focusBlock,
            focusPath,
        });

        anchorBlock.format(type);
    }

    /**
     * Return the current selection, or null when the editor has no selection.
     */
    getSelection() {
        return this.editor.selection.getSelection();
    }

    /**
     * Whether the editor (or one of its descendants) currently holds focus.
     */
    hasFocus() {
        const { activeElement } = document;

        return this.domNode === activeElement || this.domNode.contains(activeElement);
    }

    /**
     * Blur the editor (mirrors marktext muyajs `blur`). Always hides every
     * floating tool and blurs the contenteditable node.
     * @param isRemoveAllRange Remove all native selection ranges.
     * @param unSelect Clear the selected inline image so its toolbar/resize
     * bar do not linger after the editor is blurred.
     */
    blur(isRemoveAllRange = false, unSelect = false) {
        if (isRemoveAllRange)
            document.getSelection()?.removeAllRanges();

        if (unSelect)
            this.editor.selection.selectedImage = null;

        this.editor.activeContentBlock = null;
        this.ui.hideAllFloatTools();
        this.domNode.blur();
    }

    /**
     * Hide every floating tool/menu (toolbars, pickers, front button, …).
     */
    hideAllFloatTools() {
        this.ui.hideAllFloatTools();
    }

    /**
     * Copy the current document as Markdown to the clipboard.
     */
    copyAsMarkdown() {
        this.editor.clipboard.copyAsMarkdown();
    }

    /**
     * Copy the current selection as rendered HTML to the clipboard.
     */
    copyAsHtml() {
        this.editor.clipboard.copyAsHtml();
    }

    /**
     * Paste the clipboard content as plain text at the current cursor.
     */
    pasteAsPlainText() {
        this.editor.clipboard.pasteAsPlainText();
    }

    /**
     * The outer-most block at the current cursor — the target for block-level
     * operations. Uses the persisted active content block (which survives the
     * menu/IPC round-trip), falling back to the selection anchor.
     */
    private _outmostBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;

        return content?.outMostBlock ?? null;
    }

    /**
     * Duplicate the block at the current cursor, placing the cursor in the
     * copy. No-op when there is no current block.
     */
    duplicate() {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        const state = deepClone(block.getState());
        const dupBlock = ScrollPage.loadBlock(state.name).create(this, state);
        block.parent!.insertAfter(dupBlock, block);
        dupBlock.lastContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Insert an empty paragraph relative to the block at the current cursor.
     * @param location Insert `before` or `after` the current block (default `after`).
     * @param text Initial text of the new paragraph.
     */
    insertParagraph(location: 'before' | 'after' = 'after', text = '') {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        const state = deepClone(emptyStates.paragraph);
        state.text = text;
        const newBlock = ScrollPage.loadBlock('paragraph').create(this, state);
        if (location === 'before')
            block.parent!.insertBefore(newBlock, block);
        else
            block.parent!.insertAfter(newBlock, block);

        newBlock.lastContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Delete the block at the current cursor, moving the cursor to an adjacent
     * block, or to a fresh empty paragraph when it was the only block.
     */
    deleteParagraph() {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        let cursorBlock: Content | null = null;
        if (block.prev) {
            cursorBlock = block.prev.lastContentInDescendant();
        }
        else if (block.next) {
            cursorBlock = block.next.firstContentInDescendant();
        }
        else {
            const newBlock = ScrollPage.loadBlock('paragraph').create(
                this,
                deepClone(emptyStates.paragraph),
            );
            block.parent!.insertAfter(newBlock, block);
            cursorBlock = newBlock.lastContentInDescendant();
        }

        block.remove();
        cursorBlock?.setCursor(0, 0, true);
    }

    destroy() {
        this.eventCenter.detachAllDomEvents();
        this.eventCenter.unsubscribeAll();
        // this.domNode[BLOCK_DOM_PROPERTY] = null;
        if (this.domNode.remove)
            this.domNode.remove();

        // Hide all float tools.
        if (this.ui)
            this.ui.hideAllFloatTools();
    }
}

/**
 * [ensureContainerDiv ensure container element is div]
 */
function getContainer(originContainer: HTMLElement, options: IMuyaOptions) {
    const { spellcheckEnabled, hideQuickInsertHint, focusMode } = options;
    const newContainer = document.createElement('div');
    const attrs = originContainer.attributes;
    // Copy attrs from origin container to new container
    Array.from(attrs).forEach((attr: { name: string; value: string }) => {
        newContainer.setAttribute(attr.name, attr.value);
    });

    if (!hideQuickInsertHint)
        newContainer.classList.add(CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT);

    // Apply focus mode at construction when initially enabled; `setFocusMode`
    // toggles it thereafter.
    if (focusMode)
        newContainer.classList.add(CLASS_NAMES.MU_FOCUS_MODE);

    newContainer.classList.add(CLASS_NAMES.MU_EDITOR);

    newContainer.setAttribute('contenteditable', 'true');
    newContainer.setAttribute('autocorrect', 'false');
    newContainer.setAttribute('autocomplete', 'off');
    newContainer.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
    originContainer.replaceWith(newContainer);

    return newContainer;
}
