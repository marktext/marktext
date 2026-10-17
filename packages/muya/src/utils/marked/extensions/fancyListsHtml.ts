import type { MarkedExtension, Tokens } from 'marked';
import type { ListDelimiter, ListStyle } from '../../listMarker';
import type { ListToken } from '../types';
import { Lexer } from 'marked';
import { toListDelimiter } from '../../listMarker';
import fancyListsExtension, { endListItemsAtFancyMarkers } from './fancyLists';

const TYPE_ATTRIBUTE: Record<ListStyle, string> = {
    'decimal': '1',
    'lower-alpha': 'a',
    'upper-alpha': 'A',
    'lower-roman': 'i',
    'upper-roman': 'I',
};

// `type` cannot show `)` or `(1)`, and selectors match `type` values
// case-insensitively, so export CSS styles the list by this class instead.
const CLASS_SUFFIX: Record<ListDelimiter, string> = {
    '.': '',
    ')': '-paren',
    '()': '-parens',
};

// marked's own tokenizer reads decimal `1.` and `1)` lists without recording
// the delimiter.
function decimalDelimiter(list: Tokens.List): ListDelimiter {
    return toListDelimiter(/^ *\d+([.)])/.exec(list.items[0].raw)?.[1] ?? '.');
}

/** Pandoc fancy lists for marked's HTML renderer: `<ol type="I" class="…">`. */
export default function fancyListsHtmlExtension(): MarkedExtension {
    return {
        ...fancyListsExtension(),
        hooks: {
            provideLexer() {
                return (src, options) => {
                    const lexer = new Lexer(options);
                    endListItemsAtFancyMarkers(lexer);

                    return lexer.lex(src);
                };
            },
        },
        renderer: {
            list(token) {
                if (!token.ordered)
                    return false;
                const { style = 'decimal', delimiter = decimalDelimiter(token) } = token as ListToken;
                const start = token.start === 1 ? '' : ` start="${token.start}"`;
                const body = token.items.map(item => this.listitem(item)).join('');

                return `<ol type="${TYPE_ATTRIBUTE[style]}"${start} class="fancy-list-${style}${CLASS_SUFFIX[delimiter]}">\n${body}</ol>\n`;
            },
        },
    };
}
