import type { Filter, Node } from 'turndown';
import * as turndownPluginGfm from 'joplin-turndown-plugin-gfm';
import TurndownService from 'turndown';
import { identity, isHTMLElement, isHTMLInputElement } from '../../utils';

const DEFAULT_KEEPS: Filter = ['u', 'mark', 'ruby', 'rt', 'sub', 'sup'];

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
            content = content
                .replace(/^\n+/, '') // remove leading newlines
                .replace(/\n+$/, '\n') // replace trailing newlines with just a single one
                .replace(/\n/g, '\n  '); // indent
            if (containsOwnTaskListCheckbox(node))
                content = normalizeTaskMarkerSpacing(content);

            let prefix = `${options.bulletListMarker} `;
            const parent = node.parentNode;
            if (isHTMLElement(parent) && parent.nodeName === 'OL') {
                const start = parent.getAttribute('start');
                const index = Array.prototype.indexOf.call(parent.children, node);
                prefix = `${start ? Number(start) + index : index + 1}. `;
            }

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
