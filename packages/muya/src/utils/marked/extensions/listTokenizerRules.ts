import type { Lexer } from 'marked';

type TListItemStart = (line: string, contentColumn: number) => boolean;

// Marked calls only `.test` on this rule. Keep that version-dependent contract
// here, alongside the decimal marker grammar used by `listItemRegex`.
class ListItemStart extends RegExp {
    constructor(private _contentColumn: number, private _startsItem: TListItemStart) {
        super('');
    }

    override test(line: string) {
        return this._startsItem(line, this._contentColumn);
    }
}

export function listRulesOf(lexer: Lexer) {
    return lexer.options.tokenizer!.rules.other;
}

/** Adapt only this lexer's built-in lists; other Marked instances keep their rules. */
export function configureListTokenizer(lexer: Lexer, startsItem: TListItemStart): void {
    const tokenizer = lexer.options.tokenizer!;
    const { rules } = tokenizer;
    tokenizer.rules = {
        ...rules,
        other: {
            ...rules.other,
            nextBulletRegex: (contentColumn: number) => new ListItemStart(contentColumn, startsItem),
            // Pandoc continues a decimal list with `#.` items.
            listItemRegex: (bullet: string) => rules.other.listItemRegex(bullet.replace('\\d{1,9}', '(?:\\d{1,9}|#)')),
        },
    };
}
