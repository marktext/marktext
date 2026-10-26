import type { TSelectableImageToken } from '../utils/image';
import type Clipboard from './index';
import { tokenizer } from '../inlineRenderer/lexer';
import { SelectionType } from '../selection/types';
import { escapeHTML, getUniqueId } from '../utils';
import { encodeImageSrc, getImageSrc } from '../utils/image';

export interface IClipboardImage {
    version: 1;
    markdown: string;
    src: string;
    documentId: string;
}

export interface IClipboardImageCopy {
    src: string;
    text: string;
    html: string;
    marker: string;
}

function imageToken(markdown: string): TSelectableImageToken | null {
    const tokens = tokenizer(markdown);
    const token = tokens[0];
    if (tokens.length !== 1 || token?.raw !== markdown)
        return null;
    return token.type === 'image' || (token.type === 'html_tag' && token.tag === 'img') ? token as TSelectableImageToken : null;
}

export function imageClipboardData(clipboard: Clipboard): IClipboardImageCopy | null {
    const selected = clipboard.selection.image;
    if (!selected || !selected.imageInfo.token.raw)
        return null;
    const { token } = selected.imageInfo;
    const src = getImageSrc(token.attrs.src ?? '').src;
    if (!src)
        return null;
    const data: IClipboardImage = {
        version: 1,
        markdown: token.raw,
        src,
        documentId: clipboard.muya.options.documentId?.() ?? '',
    };
    const marker = getUniqueId();
    const attrs = { ...token.attrs, src };
    const html = `<img ${Object.entries(attrs)
        .filter(([key, value]) => /^(?:src|alt|title|width|height|data-align)$/.test(key) && value != null)
        .map(([key, value]) => `${key}="${escapeHTML(String(value))}"`)
        .join(' ')} data-marktext-image="${escapeHTML(JSON.stringify(data))}" data-marktext-copy="${marker}">`;
    return { src, text: token.raw, html, marker };
}

export function readClipboardImage(html: string, text: string): IClipboardImage | null {
    if (!html.includes('data-marktext-image') || html.length > 2_000_000)
        return null;
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const image = doc.body.firstElementChild;
        if (doc.body.children.length !== 1 || image?.tagName !== 'IMG' || doc.body.textContent?.trim())
            return null;
        const data: unknown = JSON.parse(image.getAttribute('data-marktext-image') ?? '');
        if (!data || typeof data !== 'object')
            return null;
        const candidate = data as Partial<IClipboardImage>;
        if (candidate.version !== 1 || candidate.markdown !== text
            || typeof candidate.src !== 'string' || !/^(?:https?:|file:|data:image\/)/i.test(candidate.src)
            || image.getAttribute('src') !== candidate.src
            || typeof candidate.documentId !== 'string' || !imageToken(text)) {
            return null;
        }
        return candidate as IClipboardImage;
    }
    catch {
        return null;
    }
}

function withImageSource(markdown: string, src: string): string {
    const token = imageToken(markdown)!;
    if (token.type === 'image') {
        const title = token.title ? ` "${token.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : '';
        return `![${token.alt}${token.backlash.first}](${encodeImageSrc(src)}${title})`;
    }
    return `<img ${Object.entries({ ...token.attrs, src })
        .filter(([, value]) => value != null)
        .map(([key, value]) => `${key}="${escapeHTML(String(value))}"`)
        .join(' ')}>`;
}

export async function pasteClipboardImage(clipboard: Clipboard, image: IClipboardImage): Promise<void> {
    const { muya } = clipboard;
    const selected = clipboard.selection.image;
    const initialSelection = clipboard.selection.getTextSelection();
    const target = selected?.block ?? initialSelection?.anchor.block;
    if (!target || muya.isReadOnly)
        return;
    const selectionState = JSON.stringify(muya.getSelectionState());
    const revision = muya.editor.jsonState.revision;
    let markdown = image.markdown;
    if (image.documentId !== (muya.options.documentId?.() ?? '') && image.src.startsWith('file:')) {
        let src = image.src;
        try {
            src = await muya.options.clipboardImageAction?.(src) || src;
        }
        catch {
            // An absolute reference still works if copying/uploading the asset fails.
        }
        markdown = withImageSource(markdown, src);
    }
    if (muya.isReadOnly || !muya.isBlockInDocument(target)
        || muya.editor.jsonState.revision !== revision
        || JSON.stringify(muya.getSelectionState()) !== selectionState) {
        return;
    }
    muya.transact(() => {
        if (selected) {
            const { start, end } = selected.imageInfo.token.range;
            target.text = target.text.slice(0, start) + markdown + target.text.slice(end);
            target.update();
            clipboard.selection.setSelection({
                kind: SelectionType.IMAGE,
                path: target.path,
                range: { start, end: start + markdown.length },
                raw: markdown,
            });
            return;
        }
        if (!initialSelection?.isSelectionInSameBlock)
            clipboard.cutHandler();
        const block = clipboard.selection.getTextSelection()?.anchor.block;
        const cursor = block?.getCursor();
        if (!block || !cursor)
            return;
        const { start, end } = cursor;
        block.text = block.text.slice(0, start.offset) + markdown + block.text.slice(end.offset);
        const offset = start.offset + markdown.length;
        block.setCursor(offset, offset, true);
    });
}
