import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type { Nullable } from '../types';
import type Clipboard from './index';
import { CLASS_NAMES } from '../config';
import { SelectionType } from '../selection/types';
import { getUniqueId } from '../utils';
import { encodeImageSrc, getImageInfo } from '../utils/image';
import { readFileAsDataURL, resolveClipboardImagePath } from '../utils/paste';

/**
 * Splice `![alt](src)` into the anchor block at the current selection and
 * return the exact text inserted.
 *
 * Inline images in muya are plain markdown text (`![](src)`) on a content
 * block; rendering turns the token into an image. We replace any
 * collapsed/expanded range and place the cursor after it. The src is
 * escaped via {@link encodeImageSrc} so spaces, `#`, and parentheses
 * survive in the path.
 */
function insertImageText(anchorBlock: Content, src: string, alt = ''): string {
    const cursor = anchorBlock.getCursor();
    if (!cursor)
        return '';

    const { start, end } = cursor;
    const { text: content } = anchorBlock;
    const escapedSrc = encodeImageSrc(src);
    const imageText = `![${alt}](${escapedSrc})`;

    anchorBlock.text
        = content.substring(0, start.offset)
            + imageText
            + content.substring(end.offset);

    const offset = start.offset + imageText.length;
    anchorBlock.setCursor(offset, offset, true);

    return imageText;
}

/**
 * Replace the `loading-<id>` placeholder image previously inserted by
 * {@link insertImageText} with the final `![](src)`, once `imageAction`
 * resolved. The cursor is seated right after the swapped image.
 */
function replacePlaceholderImage(
    anchorBlock: Content,
    placeholderText: string,
    src: string,
): void {
    const index = anchorBlock.text.indexOf(placeholderText);
    if (index === -1)
        return;

    const escapedSrc = encodeImageSrc(src);
    const imageText = `![](${escapedSrc})`;

    anchorBlock.text
        = anchorBlock.text.substring(0, index)
            + imageText
            + anchorBlock.text.substring(index + placeholderText.length);

    const offset = index + imageText.length;
    anchorBlock.setCursor(offset, offset, true);
}

/**
 * Insert a pasted image at the cursor, routing it through the embedder's
 * `imageAction` so the user's insert preference (copy-to-assets / upload /
 * keep-path) applies and a portable src is written. `src` is either a
 * resolved clipboard file path or a `data:` URL for an in-memory bitmap.
 *
 * A `loading-<id>` placeholder image is spliced in synchronously (with the
 * incoming `src` as a temporary preview) BEFORE awaiting `imageAction`, then
 * replaced with the resolved src once it settles, so the user sees a
 * placeholder while the upload/copy runs. When no
 * `imageAction` is configured the placeholder's src is the final one.
 */
async function insertImageSrc(
    clipboard: Clipboard,
    anchorBlock: Content,
    src: string,
): Promise<void> {
    const { imageAction } = clipboard.muya.options;

    // No async insert preference: write the final image directly, no
    // placeholder (there is nothing to wait for).
    if (!imageAction) {
        insertImageText(anchorBlock, src);

        return;
    }

    const id = `loading-${getUniqueId()}`;
    const placeholderText = insertImageText(anchorBlock, src, id);

    let finalSrc = src;
    const resolved = await imageAction({ src, alt: '', title: '' });
    if (resolved)
        finalSrc = resolved;

    replacePlaceholderImage(anchorBlock, placeholderText, finalSrc);
}

// Resolve a pasted image to an `src`: a clipboard FILE path (via the
// `clipboardFilePath` hook) first, then an in-memory bitmap File read as a
// base64 `data:` URL. Returns null when the clipboard carries no image.
async function resolveImageSrc(
    clipboard: Clipboard,
    imageFile: Nullable<File>,
): Promise<Nullable<string>> {
    const imagePath = await resolveClipboardImagePath(
        clipboard.muya.options.clipboardFilePath,
    );
    if (imagePath)
        return imagePath;

    if (imageFile)
        return readFileAsDataURL(imageFile);

    return null;
}

/**
 * Insert an image at the current cursor from an explicit `src`, routing it
 * through `imageAction` like a normal image paste. Used by the desktop macOS
 * screenshot flow: Chromium removed `document.execCommand('paste')`, so the
 * captured screenshot can no longer ride a synthetic paste event — the main
 * process saves the bitmap to a PNG and hands the path here instead.
 *
 * The anchor is the live selection's block, falling back to the persisted
 * active content block (the editor loses DOM focus during the menu/IPC
 * round-trip). No-ops when `src` is empty or no anchor block is available.
 */
export async function pasteImageSrc(
    clipboard: Clipboard,
    src: string,
): Promise<void> {
    if (!src)
        return;

    const anchorBlock
        = clipboard.selection.getSelection()?.anchor.block
            ?? clipboard.muya.editor.activeContentBlock;
    if (!anchorBlock)
        return;

    await insertImageSrc(clipboard, anchorBlock, src);
}

/**
 * Insert a pasted image when the clipboard carries one. Returns `true` when an
 * image was inserted so the caller skips the text/HTML paste, `false` to fall
 * through.
 */
export async function tryPasteImage(
    clipboard: Clipboard,
    anchorBlock: Content,
    imageFile: Nullable<File>,
): Promise<boolean> {
    const src = await resolveImageSrc(clipboard, imageFile);
    if (src == null)
        return false;

    await insertImageSrc(clipboard, anchorBlock, src);

    return true;
}

/**
 * Splice `![alt](src)` over the character range `[start, end)` of `block`,
 * replacing whatever inline image text lived there — a markdown `![]()` OR a
 * resized html `<img ...>`. Splicing by the token's range directly (instead of
 * selecting the image and reading the DOM cursor back) is what muyajs does: a
 * DOM text-selection spanning the atomic `contenteditable=false` image clamps
 * to a single position, which would replace only the leading `<` and orphan the
 * rest of the tag.
 */
function spliceImageText(
    block: Content,
    range: { start: number; end: number },
    src: string,
    alt = '',
): string {
    const escapedSrc = encodeImageSrc(src);
    const imageText = `![${alt}](${escapedSrc})`;

    block.text
        = block.text.substring(0, range.start)
            + imageText
            + block.text.substring(range.end);

    const offset = range.start + imageText.length;
    block.setCursor(offset, offset, true);

    return imageText;
}

// Find the rendered wrapper of the image whose token starts at `startOffset`
// (same lookup the inline-image click path uses). The block was re-rendered
// synchronously by the `setCursor(..., true)` in `spliceImageText` /
// `replacePlaceholderImage`, so the wrapper is already in the DOM.
function findImageWrapper(block: Format, startOffset: number): Nullable<HTMLElement> {
    const { domNode } = block;
    if (domNode == null)
        return null;

    const images = domNode.querySelectorAll<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
    let wrapper: Nullable<HTMLElement> = images[images.length - 1] ?? null;
    for (const image of images) {
        if (getImageInfo(image).token.range.start === startOffset) {
            wrapper = image;
            break;
        }
    }

    return wrapper;
}

// Float the image toolbar + resize bar over `wrapper`, mirroring the loaded-image
// branch of `ImageSelection._handleClickInlineImage`. The controls anchor to the
// image container's box, so this must run only once the image has loaded.
function positionImageControls(clipboard: Clipboard, block: Format, wrapper: HTMLElement): void {
    const imageContainer = wrapper.querySelector(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`);
    if (imageContainer == null)
        return;

    const imageInfo = getImageInfo(wrapper);
    const rect = imageContainer.getBoundingClientRect();
    const reference = {
        getBoundingClientRect: () => rect,
        width: wrapper.offsetWidth,
        height: wrapper.offsetHeight,
    };
    const { eventCenter } = clipboard.muya;
    eventCenter.emit('muya-image-toolbar', { block, reference, imageInfo });
    eventCenter.emit('muya-transformer', { block, reference: imageContainer, imageInfo });
}

// Re-select the replaced image and float its controls over it. The image is
// selected synchronously so it stays the active selection; the toolbar / resize
// bar are positioned only once the image has loaded — they anchor to the loaded
// image box, which is 0-sized (and has no `<img>`) until `loadImageAsync` fills
// it in, which never re-emits the positioning events on its own.
function reselectImageAt(clipboard: Clipboard, block: Format, startOffset: number): void {
    const wrapper = findImageWrapper(block, startOffset);
    if (wrapper == null)
        return;

    clipboard.muya.editor.selection.selectImage(
        Object.assign({}, getImageInfo(wrapper), { block }),
    );
    block.update();

    if (typeof requestAnimationFrame !== 'function')
        return;

    let attempts = 60;
    const positionWhenLoaded = (): void => {
        const current = findImageWrapper(block, startOffset);
        if (current?.querySelector('img')) {
            positionImageControls(clipboard, block, current);

            return;
        }
        if (--attempts > 0)
            requestAnimationFrame(positionWhenLoaded);
    };
    requestAnimationFrame(positionWhenLoaded);
}

// Replace the image spanning `range` with the pasted `src`, routing through the
// embedder's `imageAction` (with a `loading-<id>` placeholder) the same way
// {@link insertImageSrc} does for a fresh insert. The new image is left selected
// so the floating image controls follow it.
async function replaceImageAt(
    clipboard: Clipboard,
    block: Format,
    range: { start: number; end: number },
    src: string,
): Promise<void> {
    const { imageAction } = clipboard.muya.options;

    if (!imageAction) {
        spliceImageText(block, range, src);
        reselectImageAt(clipboard, block, range.start);

        return;
    }

    const id = `loading-${getUniqueId()}`;
    const placeholderText = spliceImageText(block, range, src, id);

    let finalSrc = src;
    const resolved = await imageAction({ src, alt: '', title: '' });
    if (resolved)
        finalSrc = resolved;

    replacePlaceholderImage(block, placeholderText, finalSrc);
    reselectImageAt(clipboard, block, range.start);
}

/**
 * Pasting an image while an inline image is selected replaces that image
 * (muyajs `pasteImage` selectedImage branch) instead of inserting a new one.
 * Returns `true` when it replaced the selected image.
 */
export async function tryReplaceSelectedImage(
    clipboard: Clipboard,
    imageFile: Nullable<File>,
): Promise<boolean> {
    const selectedImage = clipboard.selection.image;
    if (selectedImage == null)
        return false;

    const src = await resolveImageSrc(clipboard, imageFile);
    if (src == null)
        return false;

    // Replace by the image token's character range directly — never via a DOM
    // text selection, which clamps across the atomic image and mangles the tag.
    const { block, token } = selectedImage;
    clipboard.selection.activate(SelectionType.TEXT);
    await replaceImageAt(clipboard, block, token.range, src);

    return true;
}
