import type { ITurnoverOptions } from './types';
import { CLASS_NAMES, DEFAULT_TURNDOWN_CONFIG } from '../config';
import TurndownService, { usePluginsAddRules } from '../utils/turndownService';

// Just because turndown change `\n`(soft line break) to space, So we add `span.ag-soft-line-break` to workaround.
function turnSoftBreakToSpan(html: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
        `<x-mt id="turn-root">${html}</x-mt>`,
        'text/html',
    );
    const root = doc.querySelector('#turn-root');
    const travel = (childNodes: NodeListOf<ChildNode>) => {
        for (const node of childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.parentElement?.tagName !== 'CODE') {
                let startLen = 0;
                let endLen = 0;
                const text
                    = node.nodeValue
                        ?? ''
                            .replace(/^(\n+)/, (_, p) => {
                                startLen = p.length;

                                return '';
                            })
                            .replace(/(\n+)$/, (_, p) => {
                                endLen = p.length;

                                return '';
                            });
                if (/\n/.test(text)) {
                    const tokens = text.split('\n');
                    const params = [];
                    let i = 0;
                    const len = tokens.length;

                    for (; i < len; i++) {
                        let text = tokens[i];
                        if (i === 0 && startLen !== 0)
                            text = '\n'.repeat(startLen) + text;
                        else if (i === len - 1 && endLen !== 0)
                            text = text + '\n'.repeat(endLen);

                        params.push(document.createTextNode(text));
                        if (i !== len - 1) {
                            const softBreak = document.createElement('span');
                            softBreak.classList.add(CLASS_NAMES.MU_SOFT_LINE_BREAK);
                            params.push(softBreak);
                        }
                    }
                    node.replaceWith(...params);
                }
            }
            else if (node.nodeType === Node.ELEMENT_NODE) {
                travel(node.childNodes);
            }
        }
    };
    travel(root!.childNodes);

    return root!.innerHTML.trim();
}

export default class HtmlToMarkdown {
    private _options: ITurnoverOptions;

    constructor(options = {}) {
        this._options = Object.assign(
            {},
            DEFAULT_TURNDOWN_CONFIG as ITurnoverOptions,
            options,
        );
    }

    generate(html: string): string {
        // turn html to markdown
        const turndownService = new TurndownService(this._options);
        usePluginsAddRules(turndownService);

        // fix #752, but I don't know why the &nbsp; vanished.
        html = html.replace(/<span>&nbsp;<\/span>/g, String.fromCharCode(160));

        html = turnSoftBreakToSpan(html);
        const markdown = turndownService.turndown(html);

        return markdown;
    }
}
