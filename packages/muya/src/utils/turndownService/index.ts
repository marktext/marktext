import type { Filter, Node } from 'turndown';
import * as turndownPluginGfm from 'joplin-turndown-plugin-gfm';
import TurndownService from 'turndown';
import { identity, isHTMLElement, isHTMLInputElement } from '../../utils';

const DEFAULT_KEEPS: Filter = ['u', 'mark', 'ruby', 'rt', 'sub', 'sup'];

function inlineStyleValue(node: Node, name: keyof CSSStyleDeclaration): string {
    return isHTMLElement(node) ? String(node.style[name]).trim().toLowerCase() : '';
}

function hasStrongFontWeight(node: Node): boolean {
    const fontWeight = inlineStyleValue(node, 'fontWeight');
    if (/^(?:bold|bolder)$/.test(fontWeight))
        return true;

    const numericWeight = Number.parseInt(fontWeight, 10);
    return Number.isFinite(numericWeight) && numericWeight >= 600;
}

function hasNonStrongFontWeight(node: Node): boolean {
    const fontWeight = inlineStyleValue(node, 'fontWeight');
    if (!fontWeight)
        return false;
    if (/^(?:normal|lighter)$/.test(fontWeight))
        return true;

    const numericWeight = Number.parseInt(fontWeight, 10);
    return Number.isFinite(numericWeight) && numericWeight < 600;
}

function hasItalicFontStyle(node: Node): boolean {
    return /^(?:italic|oblique)/.test(inlineStyleValue(node, 'fontStyle'));
}

function hasNormalFontStyle(node: Node): boolean {
    return inlineStyleValue(node, 'fontStyle') === 'normal';
}

function isStyledSpan(node: Node): boolean {
    return isHTMLElement(node) && node.nodeName === 'SPAN';
}

function isSemanticStrong(node: Node): boolean {
    return isHTMLElement(node) && /^(?:B|STRONG)$/.test(node.nodeName);
}

function isSemanticEmphasis(node: Node): boolean {
    return isHTMLElement(node) && /^(?:I|EM)$/.test(node.nodeName);
}

function hasSemanticAncestor(
    node: Node,
    isSemantic: (node: Node) => boolean,
    isDisabled: (node: Node) => boolean,
): boolean {
    let current = node.parentElement;
    while (current) {
        if (isSemantic(current) && !isDisabled(current))
            return true;
        current = current.parentElement;
    }

    return false;
}

function hasStrongSemanticAncestor(node: Node): boolean {
    return hasSemanticAncestor(node, isSemanticStrong, hasNonStrongFontWeight);
}

function hasEmphasisSemanticAncestor(node: Node): boolean {
    return hasSemanticAncestor(node, isSemanticEmphasis, hasNormalFontStyle);
}

function strongDelimiter(options: TurndownService.Options): string {
    return options.strongDelimiter ?? '**';
}

function emDelimiter(options: TurndownService.Options): string {
    return options.emDelimiter ?? '*';
}

function formatContent(
    content: string,
    options: TurndownService.Options,
    strong: boolean,
    emphasis: boolean,
): string {
    if (!content)
        return '';

    let result = content;
    if (emphasis) {
        const delimiter = emDelimiter(options);
        result = `${delimiter}${result}${delimiter}`;
    }
    if (strong) {
        const delimiter = strongDelimiter(options);
        result = `${delimiter}${result}${delimiter}`;
    }

    return result;
}

function getInlineStyleFormatting(node: Node) {
    return {
        strong: hasStrongFontWeight(node) && !hasStrongSemanticAncestor(node),
        emphasis: hasItalicFontStyle(node) && !hasEmphasisSemanticAncestor(node),
    };
}

function isTaskListCheckbox(node: unknown) {
    return (
        isHTMLInputElement(node)
        && node.type === 'checkbox'
        && (node.parentNode?.nodeName === 'P' || node.parentNode?.nodeName === 'LI')
    );
}

function normalizeTaskMarkerSpacing(content: string) {
    return content.replace(/^(\[[ x]\])[ \t\u00A0]+/i, (_, marker: string) => `${marker.toLowerCase()} `);
}

function containsOwnTaskListCheckbox(node: Node) {
    return isHTMLElement(node)
        && Array.from(node.querySelectorAll('input[type="checkbox"]'))
            .some(input => isTaskListCheckbox(input) && input.closest('li') === node);
}

export function usePluginsAddRules(turndownService: TurndownService) {
    // Use the gfm plugin
    const { strikethrough, tables } = turndownPluginGfm;
    turndownService.use(strikethrough);
    turndownService.use(tables);

    // We need a extra strikethrough rule because the strikethrough rule in gfm is single `~`.
    turndownService.addRule('strikethrough', {
        filter: ['del', 's'], // <strike> is not support by the web standard, so I remove the use `strike` in filter...
        replacement(content: string) {
            return `~~${content}~~`;
        },
    });

    turndownService.addRule('nonStrongSemantic', {
        filter(node: Node) {
            return isSemanticStrong(node) && hasNonStrongFontWeight(node);
        },
        replacement(content: string, node: Node, options: TurndownService.Options) {
            return formatContent(content, options, false, hasItalicFontStyle(node));
        },
    });

    turndownService.addRule('nonEmphasisSemantic', {
        filter(node: Node) {
            return isSemanticEmphasis(node) && hasNormalFontStyle(node);
        },
        replacement(content: string, node: Node, options: TurndownService.Options) {
            return formatContent(content, options, hasStrongFontWeight(node), false);
        },
    });

    turndownService.addRule('cssInlineStyle', {
        filter(node: Node) {
            if (!isStyledSpan(node))
                return false;

            const formatting = getInlineStyleFormatting(node);
            return formatting.strong || formatting.emphasis;
        },
        replacement(content: string, node: Node, options: TurndownService.Options) {
            const formatting = getInlineStyleFormatting(node);
            return formatContent(
                content,
                options,
                formatting.strong,
                formatting.emphasis,
            );
        },
    });

    turndownService.addRule('heading', {
        filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

        replacement(content, node, options) {
            const hLevel = Number(node.nodeName.charAt(1));

            if (
                (options.headingStyle === 'setext' || /\n/.test(content))
                && hLevel < 3
            ) {
                const markerLength = Math.max(
                    ...content.split('\n').map(l => l.length),
                );
                const underline = (hLevel === 1 ? '=' : '-').repeat(markerLength);

                return `\n\n${content}\n${underline}\n\n`;
            }
            else {
                return (
                    `\n\n${
                        '#'.repeat(hLevel)
                    } ${
                        content.replace(/\n+/, '')
                    }\n\n`
                );
            }
        },
    });

    turndownService.addRule('taskListItems', {
        filter(node) {
            return isTaskListCheckbox(node);
        },
        replacement(_content, node) {
            return `${isHTMLInputElement(node) && node.checked ? '[x]' : '[ ]'} `;
        },
    });

    turndownService.addRule('paragraph', {
        filter: 'p',

        replacement(content: string, node: Node) {
            const isTaskListItemParagraph
                = node instanceof HTMLElement
                    && node.firstElementChild?.tagName === 'INPUT';
            return isTaskListItemParagraph
                ? `${content.replace(/\]\s+\n/, '] ')}\n\n`
                : `\n\n${content}\n\n`;
        },
    });

    turndownService.addRule('listItem', {
        filter: 'li',

        replacement(
            content: string,
            node: Node,
            options: { bulletListMarker?: string },
        ) {
            let prefix = `${options.bulletListMarker} `;
            const parent = node.parentNode;
            if (isHTMLElement(parent) && parent.nodeName === 'OL') {
                const start = parent.getAttribute('start');
                const index = Array.prototype.indexOf.call(parent.children, node);
                prefix = `${start ? Number(start) + index : index + 1}. `;
            }

            const continuationIndent = ' '.repeat(prefix.length);
            content = content
                .replace(/^\n+/, '') // remove leading newlines
                .replace(/\n+$/, '\n') // replace trailing newlines with just a single one
                .replace(/\n/g, `\n${continuationIndent}`); // indent
            if (containsOwnTaskListCheckbox(node))
                content = normalizeTaskMarkerSpacing(content);

            return (
                prefix
                + content
                + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
            );
        },
    });

    // Handle multiple math lines
    turndownService.addRule('multiplemath', {
        filter(node: Node) {
            return (
                node instanceof HTMLElement
                && node.nodeName === 'PRE'
                && node.classList.contains('multiple-math')
            );
        },
        replacement(content: string) {
            return `$$\n${content}\n$$`;
        },
    });

    turndownService.escape = identity;
    turndownService.keep(DEFAULT_KEEPS);
}

export default TurndownService;
