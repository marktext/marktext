import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type { Nullable } from '../types';
import type Clipboard from './index';
import { CLASS_NAMES } from '../config';
import { SelectionType } from '../selection/types';
import { getUniqueId } from '../utils';
import { encodeImageSrc, getImageInfo } from '../utils/image';
import { readFileAsDataURL, resolveClipboardImagePath } from '../utils/paste';

// Replace the current range with image Markdown and return the inserted text.
// Escape the source so path delimiters survive Markdown parsing.
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

// Resolve a loading placeholder and place the caret after the final image.
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

// Apply the host's imageAction preference to a file path or data URL.
// Show a loading placeholder while the hook resolves; insert directly when no hook exists.
async function insertImageSrc(
    clipboard: Clipboard,
    anchorBlock: Content,
    src: string,
): Promise<void> {
    if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(anchorBlock))
        return;
    const { imageAction } = clipboard.muya.options;

    if (!imageAction) {
        insertImageText(anchorBlock, src);

        return;
    }

    const id = `loading-${getUniqueId()}`;
    const placeholderText = insertImageText(anchorBlock, src, id);

    let finalSrc = src;
    const resolved = await imageAction({ src, alt: '', title: '' });
    if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(anchorBlock))
        return;
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

// Insert a file path or data URL through imageAction. Fall back to the cached
// active block when a menu/IPC round-trip loses focus; no-op without a source or target.
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
 * Insert a pasted image when the clipboard carries one. An image consumes the
 * paste even if its target disappeared while resolving it; only a clipboard
 * without an image falls through to text/HTML paste.
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

// Replace [start, end) directly: a DOM selection clamps across atomic images
// and can leave part of a resized HTML image tag behind.
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

// Position controls only after loading gives the image a measurable box.
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

// Select immediately, but defer control positioning until the image has loaded.
// Image loading does not emit positioning events itself.
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
        if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(block))
            return;
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

// Apply imageAction to the replacement and leave it selected so controls follow it.
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
    if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(block))
        return;
    if (resolved)
        finalSrc = resolved;

    replacePlaceholderImage(block, placeholderText, finalSrc);
    reselectImageAt(clipboard, block, range.start);
}

// Return true when an image paste was handled, even if its target became invalid
// while resolving, so the paste cannot be redirected to a different selection.
export async function tryReplaceSelectedImage(
    clipboard: Clipboard,
    imageFile: Nullable<File>,
): Promise<boolean> {
    const selectedImage = clipboard.selection.image;
    if (selectedImage == null)
        return false;

    const original = selectedImage.block.text.slice(selectedImage.token.range.start, selectedImage.token.range.end);
    const src = await resolveImageSrc(clipboard, imageFile);
    if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(selectedImage.block)
        || selectedImage.block.text.slice(selectedImage.token.range.start, selectedImage.token.range.end) !== original) {
        return true;
    }
    if (src == null)
        return false;

    const { block, token } = selectedImage;
    clipboard.selection.activate(SelectionType.TEXT);
    await replaceImageAt(clipboard, block, token.range, src);

    return true;
}
