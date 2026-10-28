import type { Lexer, Tokens } from 'marked';

const TASK_PREFIX = /^\[([ x])\](?:[ \t]+|(?=\n|$))/i;

function stripTaskPrefix(text: string) {
    return text.replace(TASK_PREFIX, '').replace(/^\n/, '');
}

/**
 * Populate custom lists with Marked-compatible paragraphs and checkboxes, before
 * the token stream branches into editor state, HTML export or clipboard HTML.
 */
export default function tokenizeListItems(lexer: Lexer, list: Tokens.List): void {
    for (const item of list.items) {
        lexer.state.top = false;
        item.tokens = lexer.blockTokens(item.text, []);
        if (item.tokens.some(token => token.type === 'space' && /\n.*\n/.test(token.raw)))
            list.loose = true;
    }

    for (const item of list.items) {
        item.loose = list.loose;
        if (list.loose) {
            item.tokens = item.tokens.map(token => token.type === 'text'
                ? { ...token, type: 'paragraph', tokens: token.tokens ?? [] }
                : token);
        }

        const task = lexer.options.gfm && TASK_PREFIX.exec(item.text);
        const first = item.tokens[0];
        if (!task || !first || (first.type !== 'text' && first.type !== 'paragraph'))
            continue;

        item.task = true;
        item.checked = task[1].toLowerCase() === 'x';
        item.text = stripTaskPrefix(item.text);
        first.text = stripTaskPrefix(first.text);
        first.raw = stripTaskPrefix(first.raw);
        // Inline parsing runs later; update the source belonging to this token,
        // rather than a matching string that could belong to another list item.
        const inline = lexer.inlineQueue.find(entry => entry.tokens === first.tokens);
        if (inline)
            inline.src = stripTaskPrefix(inline.src);

        const checkbox: Tokens.Checkbox = { type: 'checkbox', raw: `[${task[1]}] `, checked: item.checked };
        if (list.loose) {
            first.tokens ??= [];
            first.tokens.unshift(checkbox);
        }
        else {
            item.tokens.unshift(checkbox);
        }
    }
}
