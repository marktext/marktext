import type Content from '../block/base/content';
import type { Nullable } from '../types';
import type Clipboard from './index';
import { getUniqueId } from '../utils';
import { readFileAsDataURL, resolveClipboardImagePath } from '../utils/paste';

/**
 * Splice `![alt](src)` into the anchor block at the current selection and
 * return the exact text inserted.
 *
 * Inline images in muya are plain markdown text (`![](src)`) on a content
 * block; rendering turns the token into an image. We replace any
 * collapsed/expanded range and place the cursor after it. The src is
 * escaped the same way as {@link Format.replaceImage} so spaces and `#`
 * survive in the path.
 */
function insertImageText(anchorBlock: Content, src: string, alt = ''): string {
    const cursor = anchorBlock.getCursor();
    if (!cursor)
        return '';

    const { start, end } = cursor;
    const { text: content } = anchorBlock;
    const escapedSrc = src
        .replace(/ /g, encodeURI(' '))
        .replace(/#/g, encodeURIComponent('#'));
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

    const escapedSrc = src
        .replace(/ /g, encodeURI(' '))
        .replace(/#/g, encodeURIComponent('#'));
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

/**
 * Insert a pasted image when the clipboard carries one. Tries a resolved
 * clipboard FILE path first (via the `clipboardFilePath` hook), then
 * an in-memory bitmap File (read as a base64 `data:` URL). Returns
 * `true` when an image was inserted so the caller skips the text/HTML
 * paste, `false` to fall through.
 */
export async function tryPasteImage(
    clipboard: Clipboard,
    anchorBlock: Content,
    imageFile: Nullable<File>,
): Promise<boolean> {
    const imagePath = await resolveClipboardImagePath(
        clipboard.muya.options.clipboardFilePath,
    );
    if (imagePath) {
        await insertImageSrc(clipboard, anchorBlock, imagePath);
        return true;
    }

    if (imageFile) {
        const dataUrl = await readFileAsDataURL(imageFile);
        if (dataUrl) {
            await insertImageSrc(clipboard, anchorBlock, dataUrl);
            return true;
        }
    }

    return false;
}
