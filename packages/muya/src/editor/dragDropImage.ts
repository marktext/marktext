import type Format from '../block/base/format';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import { ScrollPage } from '../block/scrollPage';
import { IMAGE_EXT_REG, URL_REG } from '../config';
import { findContentDOM } from '../selection/dom';
import { getUniqueId } from '../utils';
import { getBlock, query } from '../utils/dom';
import { checkImageContentType, getImageInfo, getImageSrc } from '../utils/image';
import logger from '../utils/logger';

const debug = logger('editor:dragDropImage:');

// Port of marktext `src/muya/lib/eventHandler/dragDrop.js` +
// `contentState/dragDropCtrl.js`. The legacy engine bound
// dragover/drop/dragleave/dragstart on the editor container and inserted a
// dropped image — either a web-link image (`text/uri-list`) or a local image
// FILE — as a new `![](src)` paragraph block. The TS rewrite shipped without
// any DnD handler (#4406 parity gap PG4); this module restores it.
//
// Two drop paths, mirroring the legacy controller:
//   - web-link image (`text/uri-list`)  → verify it is an image, then insert
//                                          `![](url)` verbatim.
//   - local image FILE (`dataTransfer.files`) → resolve the file to a path via
//     the embedder `getPathForFile` hook, insert a `![loading-id](path)`
//     placeholder, persist it through the `imageAction` option (copy-to-assets
//     / upload), then swap in the returned src.
//
// Cleanup: every listener is attached via `eventCenter.attachDOMEvent`, so
// `muya.destroy()` → `eventCenter.detachAllDomEvents()` removes them.

const GHOST_ID = 'mu-dragover-ghost';
const GHOST_HEIGHT = 3;

interface IDropTarget {
    anchor: Parent;
    position: 'up' | 'down';
}

function hideGhost(): void {
    const ghost = document.querySelector(`#${GHOST_ID}`);
    ghost && ghost.remove();
}

// Above-or-below decision relative to the anchor block's vertical midpoint.
function verticalPosition(event: DragEvent, rect: DOMRect): 'up' | 'down' {
    return event.clientY > rect.top + rect.height / 2 ? 'down' : 'up';
}

// A single dragged image FILE: exactly one item, of an image MIME type.
function isImageFileDrag(dataTransfer: DataTransfer): boolean {
    return (
        dataTransfer.items.length === 1
        && dataTransfer.items[0].type.includes('image')
    );
}

// The "image dragged from a browser" signature: a `text/uri-list` item that
// also carries `text/html` but NOT `text/plain`. Mirrors legacy muyajs
// (`dragDropCtrl.js` dragoverHandler) so that dragging a plain hyperlink — which
// carries `text/uri-list` + `text/plain` — is left to the browser instead of
// being intercepted and swallowed.
function isWebImageDrag(dataTransfer: DataTransfer): boolean {
    const items = Array.from(dataTransfer.items);
    const hasUri = items.some(i => i.type === 'text/uri-list');
    const hasHtml = items.some(i => i.type === 'text/html');
    const hasText = items.some(i => i.type === 'text/plain');

    return hasUri && hasHtml && !hasText;
}

// Resolve the drop target to an outermost block + insert position. Returns
// `null` when the pointer is not over an editor content block.
function resolveDropTarget(event: DragEvent): IDropTarget | null {
    const contentDom = findContentDOM(event.target as Node | null);
    if (!contentDom)
        return null;

    const block = getBlock(contentDom);
    const anchor = block?.outMostBlock;
    if (!anchor || !anchor.domNode)
        return null;

    const rect = anchor.domNode.getBoundingClientRect();

    return { anchor, position: verticalPosition(event, rect) };
}

// Draw the horizontal drop indicator at the anchor block's top/bottom edge.
function drawGhost(target: IDropTarget): void {
    const rect = target.anchor.domNode!.getBoundingClientRect();
    let ghost = document.querySelector<HTMLElement>(`#${GHOST_ID}`);
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = GHOST_ID;
        document.body.appendChild(ghost);
    }

    Object.assign(ghost.style, {
        width: `${rect.width}px`,
        left: `${rect.left}px`,
        top:
            target.position === 'up'
                ? `${rect.top - GHOST_HEIGHT}px`
                : `${rect.top + rect.height}px`,
    });
}

// Insert a `![alt](src)` image as a new paragraph block above/below the
// target anchor, place the cursor inside it, and return the new block.
function insertImageParagraph(
    muya: Muya,
    target: IDropTarget,
    text: string,
): Parent {
    const state = { name: 'paragraph', text };
    const imageBlock = ScrollPage.loadBlock('paragraph').create(muya, state);
    const { anchor, position } = target;

    if (position === 'up')
        anchor.parent!.insertBefore(imageBlock, anchor);
    else
        anchor.parent!.insertAfter(imageBlock, anchor);

    imageBlock.firstContentInDescendant()?.setCursor(0, 0, true);

    return imageBlock;
}

// Drop path 1 — a web-link image carried as `text/uri-list`. Verify the URL
// resolves to an image (by extension, or by content-type sniff), then insert
// `![](url)` verbatim.
function handleWebLinkImage(
    muya: Muya,
    event: DragEvent,
    target: IDropTarget,
): boolean {
    const items = Array.from(event.dataTransfer?.items ?? []);
    const uriItem = items.find(
        item => item.kind === 'string' && item.type === 'text/uri-list',
    );
    if (!uriItem)
        return false;

    uriItem.getAsString(async (url) => {
        if (!URL_REG.test(url))
            return;

        const isImage
            = IMAGE_EXT_REG.test(url) || (await checkImageContentType(url));
        if (!isImage)
            return;

        insertImageParagraph(muya, target, `![](${url})`);
    });

    return true;
}

// Replace a `![loading-id](path)` placeholder with the persisted src returned
// by `imageAction`. Mirrors the imageEditTool upload flow.
async function persistDroppedImage(
    muya: Muya,
    path: string,
    name: string,
    loadingId: string,
): Promise<void> {
    const { imageAction } = muya.options;
    if (!imageAction)
        return;

    try {
        const newSrc = await imageAction({ src: path, alt: name, title: '' });
        const { src } = getImageSrc(path);
        if (src)
            muya.editor.inlineRenderer.renderer.urlMap.set(newSrc, src);

        const imageWrapper = query<HTMLElement>(
            `span[data-id=${loadingId}]`,
            muya.domNode,
        );
        if (imageWrapper) {
            const imageInfo = getImageInfo(imageWrapper);
            const block = getBlock(
                findContentDOM(imageWrapper),
            ) as Format | undefined;
            block?.replaceImage(imageInfo, { alt: name, src: newSrc });
        }
    }
    catch (error) {
        debug.warn(`Unexpected error on image action: ${String(error)}`);
    }
}

// Drop path 2 — a local image FILE. Resolve it to a path via the embedder
// `getPathForFile` hook, then insert it.
//
// When an `imageAction` hook is configured we insert a `![loading-id](path)`
// placeholder and let `persistDroppedImage` swap in the persisted src once the
// hook resolves (copy-to-assets / upload). Without the hook there is nothing to
// persist to, so we insert a clean `![name](path)` with the raw path verbatim —
// matching the documented `imageAction` contract and the imageEditTool's
// direct-replacement behaviour (a permanent `loading-*` alt would otherwise be
// left behind).
function handleFileImage(
    muya: Muya,
    event: DragEvent,
    target: IDropTarget,
): boolean {
    const files = Array.from(event.dataTransfer?.files ?? []);
    const image = files.find(file => /image/.test(file.type));
    if (!image)
        return false;

    const path = muya.options.getPathForFile?.(image);
    if (!path)
        return false;

    const { name } = image;

    if (!muya.options.imageAction) {
        insertImageParagraph(muya, target, `![${name}](${path})`);
        return true;
    }

    const loadingId = `loading-${getUniqueId()}`;
    insertImageParagraph(muya, target, `![${loadingId}](${path})`);

    void persistDroppedImage(muya, path, name, loadingId);

    return true;
}

export function attachDragDropImageHandlers(muya: Muya): void {
    const { eventCenter, domNode } = muya;

    // Prevent the browser from starting its own image drag inside the editor;
    // it would otherwise open the dragged image as a navigation.
    const dragStartHandler = (event: Event) => {
        if ((event.target as HTMLElement)?.tagName === 'IMG')
            event.preventDefault();
    };

    const dragOverHandler = (event: Event) => {
        const dragEvent = event as DragEvent;
        const { dataTransfer } = dragEvent;
        if (!dataTransfer)
            return;

        // Only intercept a single image file or a likely web-image drag; leave
        // everything else (plain hyperlinks, tab reordering, text) to the
        // browser so we never suppress an unrelated default drop.
        if (!isImageFileDrag(dataTransfer) && !isWebImageDrag(dataTransfer))
            return;

        const target = resolveDropTarget(dragEvent);
        if (!target) {
            hideGhost();
            return;
        }

        event.preventDefault();
        dataTransfer.dropEffect = 'copy';
        drawGhost(target);
    };

    const dropHandler = (event: Event) => {
        const dragEvent = event as DragEvent;
        const { dataTransfer } = dragEvent;
        if (!dataTransfer)
            return;

        hideGhost();
        const target = resolveDropTarget(dragEvent);
        if (!target)
            return;

        // Try the file path first (a dropped image file also exposes a
        // synthetic `text/uri-list`, but the file branch is the intended one).
        // Only fall through to the web-link branch for the likely-web-image
        // signature, so a plain hyperlink drop is left to the browser rather
        // than suppressed by `preventDefault()`.
        let inserted = handleFileImage(muya, dragEvent, target);
        if (!inserted && isWebImageDrag(dataTransfer))
            inserted = handleWebLinkImage(muya, dragEvent, target);

        if (inserted)
            event.preventDefault();
    };

    const dragLeaveHandler = () => hideGhost();

    eventCenter.attachDOMEvent(domNode, 'dragstart', dragStartHandler);
    eventCenter.attachDOMEvent(domNode, 'dragover', dragOverHandler);
    eventCenter.attachDOMEvent(domNode, 'drop', dropHandler);
    // Legacy muyajs bound `dragleave` on `window` to clear the ghost when the
    // pointer leaves the page; `document` bubbles the same event and is within
    // `attachDOMEvent`'s accepted target union.
    eventCenter.attachDOMEvent(document, 'dragleave', dragLeaveHandler);
}
