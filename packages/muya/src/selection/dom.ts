// utils used in selection/index.js
import type Content from '../block/base/content';
import type { IAnchorFocusInfo } from './types';
import { CLASS_NAMES } from '../config';
import { isElement, lineBounds } from '../utils';
import { getBlock } from '../utils/dom';

export function isContentDOM(element: HTMLElement) {
    return (
        element
        && element.tagName === 'SPAN'
        && element.classList.contains('mu-content')
    );
}

export function findContentDOM(node: Node | null | undefined) {
    if (!node)
        return null;

    do {
        if (node instanceof HTMLElement && isContentDOM(node))
            return node;

        node = node.parentNode;
    } while (node);

    return null;
}

export function resolveEndpoint(node: Node, offset: number): IAnchorFocusInfo | null {
    const contentDOM = findContentDOM(node);
    if (!contentDOM)
        return null;

    const block = getBlock(contentDOM);
    if (!block?.isContent() || !block.outMostBlock)
        return null;

    return {
        offset: getOffsetOfParagraph(node, contentDOM) + offset,
        block,
        path: block.path,
    };
}

function caretAt(doc: Document, x: number, y: number): { node: Node; offset: number } | null {
    const position = doc.caretPositionFromPoint?.(x, y);
    if (position)
        return { node: position.offsetNode, offset: position.offset };

    const range = doc.caretRangeFromPoint?.(x, y);

    return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

export function lineAtPoint(
    doc: Document,
    x: number,
    y: number,
): { block: Content; start: number; end: number } | null {
    const caret = caretAt(doc, x, y);
    const clicked = caret && resolveEndpoint(caret.node, caret.offset);
    if (!clicked)
        return null;

    const { block, offset } = clicked;
    const [start, end] = lineBounds(block.text, offset);

    return { block, start, end };
}

export function compareParagraphsOrder(paragraph1: HTMLElement, paragraph2: HTMLElement) {
    return (
        paragraph1.compareDocumentPosition(paragraph2)
        & Node.DOCUMENT_POSITION_FOLLOWING
    );
}

export function getTextContent(node: Node, blackList: string[] = []) {
    if (node.nodeType === Node.TEXT_NODE || blackList.length === 0)
        return node.textContent!;

    let text = '';
    if (
        isElement(node)
        && blackList.some(
            className => node.classList && node.classList.contains(className),
        )
    ) {
        return text;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
    }
    else if (
        isElement(node)
        && node.classList.contains(`${CLASS_NAMES.MU_INLINE_IMAGE}`)
    ) {
    // handle inline image
        const raw = node.getAttribute('data-raw');
        const imageContainer = node.querySelector(
            `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
        );
        const hasImg = imageContainer!.querySelector('img');
        const childNodes = imageContainer!.childNodes;
        if (childNodes.length && hasImg) {
            for (const child of childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE && child.nodeName === 'IMG')
                    text += raw;
                else if (child.nodeType === Node.TEXT_NODE)
                    text += child.textContent;
            }
        }
        else {
            text += raw;
        }
    }
    else {
        const childNodes = node.childNodes;

        for (const n of childNodes)
            text += getTextContent(n, blackList);
    }

    return text;
}

export function getOffsetOfParagraph(node: Node, paragraph: HTMLElement): number {
    let offset = 0;
    let preSibling: Node | null = node;

    if (node === paragraph)
        return offset;

    do {
        preSibling = preSibling.previousSibling;
        if (preSibling) {
            offset += getTextContent(preSibling, [
                CLASS_NAMES.MU_MATH_RENDER,
                CLASS_NAMES.MU_RUBY_RENDER,
            ]).length;
        }
    } while (preSibling);

    return node === paragraph || node.parentNode === paragraph
        ? offset
        : offset + getOffsetOfParagraph(node.parentNode!, paragraph);
}

export function getNodeAndOffset(
    node: Node,
    offset: number,
): { node: Node; offset: number } {
    if (node.nodeType === Node.TEXT_NODE) {
        return {
            node,
            offset,
        };
    }

    const childNodes = node.childNodes;
    const len = childNodes.length;
    let i;
    let count = 0;

    for (i = 0; i < len; i++) {
        const child = childNodes[i];
        const textContent = getTextContent(child, [
            CLASS_NAMES.MU_MATH_RENDER,
            CLASS_NAMES.MU_RUBY_RENDER,
        ]);
        const textLength = textContent.length;

        // Fix #1460 - put the cursor at the next text node or element if it can be put at the last of /^\n$/ or the next text node/element.
        if (
            /^\n$/.test(textContent) && i !== len - 1
                ? count + textLength > offset
                : count + textLength >= offset
        ) {
            if (
                isElement(child)
                && child.classList
                && child.classList.contains(`${CLASS_NAMES.MU_INLINE_IMAGE}`)
            ) {
                const imageContainer = child.querySelector(
                    `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
                )!;
                const hasImg = imageContainer.querySelector('img');

                if (!hasImg) {
                    return {
                        node: child,
                        offset: 0,
                    };
                }

                if (count + textLength === offset) {
                    if (child.nextElementSibling) {
                        return {
                            node: child.nextElementSibling,
                            offset: 0,
                        };
                    }
                    else {
                        return {
                            node: imageContainer,
                            offset: 1,
                        };
                    }
                }
                else if (count === offset && count === 0) {
                    return {
                        node: imageContainer,
                        offset: 0,
                    };
                }
                else {
                    return {
                        node: child,
                        offset: 0,
                    };
                }
            }
            else {
                return getNodeAndOffset(child, offset - count);
            }
        }
        else {
            count += textLength;
        }
    }

    return { node, offset };
}

export function getLegalOffset(node: Node, offset: number): number {
    if (!node || typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0)
        return 0;

    const max = node.nodeType === Node.TEXT_NODE
        ? (node as Text).length
        : node.childNodes.length;

    return Math.min(offset, max);
}
