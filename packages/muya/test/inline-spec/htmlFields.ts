import type { Token as HtmlToken } from 'parse5';
import type { HTMLTagToken, ITokenRange, Token } from '../../src/inline/model/types';
import { Tokenizer } from 'parse5';
import { WHITELIST_ATTRIBUTES } from '../../src/inline/parser/htmlAttributes';

interface IRawHtmlFields {
    tag: string;
    attrs: Map<string, string>;
}

export interface IHtmlFieldDifference {
    range: ITokenRange;
    field: string;
    expected: string | null;
    actual: string | null;
}

export interface IHtmlAttributePolicy {
    range: ITokenRange;
    attribute: string;
    policy: 'attribute-whitelist' | 'dimension-normalization' | 'image-default';
    sourceValue: string | null;
    parsedValue: string | null;
}

export interface IHtmlFieldChecks {
    differences: IHtmlFieldDifference[];
    policies: IHtmlAttributePolicy[];
}

const RETAINED_ATTRIBUTES = new Set(WHITELIST_ATTRIBUTES);
const IMAGE_DEFAULTS = new Set(['title', 'src', 'alt']);

function rawHtmlFields(raw: string): IRawHtmlFields | undefined {
    let fields: IRawHtmlFields | undefined;
    const tag = (token: HtmlToken.TagToken) => {
        if (token.location?.startOffset === 0)
            fields ??= { tag: token.tagName, attrs: new Map(token.attrs.map(attr => [attr.name, attr.value])) };
    };
    const tokenizer = new Tokenizer({ sourceCodeLocationInfo: true }, {
        onStartTag: tag,
        onEndTag: tag,
        onComment(token) {
            if (token.location?.startOffset === 0)
                fields ??= { tag: '<!---->', attrs: new Map() };
        },
        onCharacter() {},
        onWhitespaceCharacter() {},
        onNullCharacter() {},
        onDoctype() {},
        onEof() {},
    });
    tokenizer.write(raw, true);
    return fields;
}

function attributePolicy(tag: string, name: string, sourceValue: string | undefined, parsedValue: string | null | undefined): IHtmlAttributePolicy['policy'] | undefined {
    if (!RETAINED_ATTRIBUTES.has(name))
        return 'attribute-whitelist';
    if (name === 'width' || name === 'height')
        return 'dimension-normalization';
    if (tag === 'img' && IMAGE_DEFAULTS.has(name) && sourceValue === undefined && parsedValue === '')
        return 'image-default';
}

function checkHtmlFields(token: HTMLTagToken, checks: IHtmlFieldChecks): void {
    // Parse the source independently: serializing raw/openTag again cannot validate the lexer's parsed fields.
    const expected = rawHtmlFields(token.raw);
    if (expected?.tag !== token.tag.toLowerCase()) {
        checks.differences.push({ range: token.range, field: 'tag', expected: expected?.tag ?? null, actual: token.tag });
    }
    if (!expected)
        return;

    const names = new Set([...expected.attrs.keys(), ...Object.keys(token.attrs)]);
    for (const name of [...names].sort()) {
        const sourceValue = expected.attrs.get(name);
        const parsedValue = token.attrs[name];
        const policy = attributePolicy(expected.tag, name, sourceValue, parsedValue);
        if (policy) {
            checks.policies.push({ range: token.range, attribute: name, policy, sourceValue: sourceValue ?? null, parsedValue: parsedValue ?? null });
        }
        else if ((sourceValue ?? null) !== (parsedValue ?? null)) {
            checks.differences.push({ range: token.range, field: `attrs.${name}`, expected: sourceValue ?? null, actual: parsedValue ?? null });
        }
    }
}

export function checkRawHtmlFields(tokens: Token[]): IHtmlFieldChecks {
    const checks: IHtmlFieldChecks = { differences: [], policies: [] };
    const visit = (tokens: Token[]) => {
        for (const token of tokens) {
            if (token.type === 'html_tag')
                checkHtmlFields(token, checks);
            if ('children' in token && token.children)
                visit(token.children);
        }
    };
    visit(tokens);
    return checks;
}
