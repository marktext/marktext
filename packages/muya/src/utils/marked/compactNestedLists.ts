import type { MarkedExtension } from 'marked';
import { Renderer } from 'marked';

export default function compactNestedLists(): MarkedExtension {
    let listDepth = 0;

    return {
        renderer: {
            list(token) {
                const newline = listDepth > 0 ? '' : '\n';
                const tag = token.ordered ? 'ol' : 'ul';
                const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
                let body = '';
                listDepth++;
                try {
                    for (const item of token.items)
                        body += this.listitem(item);
                }
                finally {
                    listDepth--;
                }
                return `<${tag}${start}>${newline}${body}</${tag}>${newline}`;
            },
            listitem(item) {
                const html = Renderer.prototype.listitem.call(this, item);
                // Remove only the wrapper's final newline, never whitespace from item content or raw HTML.
                return listDepth > 1 ? html.replace(/\n$/, '') : html;
            },
        },
    };
}
