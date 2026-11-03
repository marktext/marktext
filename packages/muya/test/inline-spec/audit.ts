import type { Token } from '../../src/inline/model/types';
import type { IInlineExample } from './fixtures';
import type { IHtmlAttributePolicy, IHtmlFieldDifference } from './htmlFields';
import type { SemanticEvent } from './semantics';
import { createHash } from 'node:crypto';
import { tokenizer } from '../../src/inline/lexer';
import { generator } from '../../src/inline/serialization';
import { adaptFixture, examples } from './fixtures';
import { checkRawHtmlFields } from './htmlFields';
import { htmlSemantics, tokensToHtml } from './semantics';

export type Status = 'conforming' | 'known-difference' | 'extension-difference' | 'version-difference' | 'uncovered';
export interface IAuditResult extends IInlineExample {
    status: Status;
    reason: string;
    expected: SemanticEvent[];
    actual: SemanticEvent[];
    sources: string[];
    invariants: string[];
    htmlFields: IHtmlFieldDifference[];
    htmlAttributePolicies: IHtmlAttributePolicy[];
}
export interface IBaselineEntry {
    status: Exclude<Status, 'conforming'>;
    reason: string;
    fingerprint?: string;
}

export const options = {
    superSubScript: false,
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: false,
    inlineDiff: false,
};

const currentCommonMark = new Map(examples.filter(example => example.suite === 'commonmark')
    .map(example => [example.markdown, htmlSemantics(example.html)]));

const REASONS: Record<string, string> = {
    'Backslash escapes': 'Incomplete ASCII punctuation escaping or precedence against other inline constructs.',
    'Entity and numeric character references': 'Incomplete named/numeric entity decoding or entity treatment in link attributes.',
    'Code spans': 'Backtick-run matching, code whitespace normalization, or code/link precedence.',
    'Emphasis and strong emphasis': 'Delimiter boundaries differ from the normative punctuation/flanking rules.',
    'Links': 'Bracket matching, link nesting/precedence, multiline tails, or destination/title decoding.',
    'Images': 'Image label nesting, alt text, or destination/title parsing.',
    'Raw HTML': 'HTML tag/attribute grammar, closing tags, comments, or other raw HTML forms.',
    'Disallowed Raw HTML (extension)': 'GFM tag filtering is not implemented by the inline lexer.',
    'Hard line breaks': 'Hard-break boundary or whitespace semantics differ.',
    'Soft line breaks': 'Whitespace around a soft break is preserved in lexer text.',
    'Autolinks': 'Angle-bracket autolink recognition or URL/email boundaries differ.',
    'Autolinks (extension)': 'GFM extended autolink recognition, boundaries, or punctuation trimming differ.',
    'Strikethrough (extension)': 'Strikethrough delimiter recognition or nesting differs.',
    'Textual content': 'Text normalization or interaction with always-enabled extensions differs.',
    'Inlines': 'Inline nesting or construct precedence differs.',
};

function sourceInvariants(tokens: Token[], source: string): string[] {
    const failures: string[] = [];
    if (generator(tokens) !== source)
        failures.push('generator(tokens) does not reconstruct the input');

    const visit = (children: Token[], lower: number, upper: number) => {
        let previousEnd = lower;
        for (const token of children) {
            const { start, end } = token.range;
            if (start < previousEnd || start < lower || end < start || end > upper)
                failures.push(`${token.type}: invalid/nested source range ${start}..${end}`);
            if (token.raw !== source.slice(start, end))
                failures.push(`${token.type}: raw does not match source range ${start}..${end}`);
            if (token.parent !== children)
                failures.push(`${token.type}: parent does not own this token`);
            if ('children' in token && token.children)
                visit(token.children, start, end);
            previousEnd = end;
        }
    };
    visit(tokens, 0, source.length);
    return failures;
}

function equal(a: SemanticEvent[], b: SemanticEvent[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function audit(example: IInlineExample): IAuditResult {
    const expected = htmlSemantics(example.html);
    const result: IAuditResult = { ...example, expected, actual: [], sources: [], invariants: [], htmlFields: [], htmlAttributePolicies: [], status: 'uncovered', reason: '' };
    const fixture = adaptFixture(example);
    if ('uncovered' in fixture) {
        result.reason = fixture.uncovered;
        return result;
    }

    const expectedBlocks = expected.filter(event => event.type === 'open' && /^(?:p|h[1-6])$/.test(event.tag))
        .map(event => event.type === 'open' ? event.tag : '');
    if (JSON.stringify(expectedBlocks) !== JSON.stringify(fixture.blocks.map(block => block.tag))) {
        result.reason = 'Block adapter and official HTML disagree on paragraph/heading boundaries.';
        return result;
    }

    let actualHtml = '';
    let literalHtml = '';
    for (const { source, tag } of fixture.blocks) {
        result.sources.push(source);
        const tokens = tokenizer(source, { profile: 'inline', labels: fixture.labels, options });
        result.invariants.push(...sourceInvariants(tokens, source));
        const fields = checkRawHtmlFields(tokens);
        result.htmlFields.push(...fields.differences);
        result.htmlAttributePolicies.push(...fields.policies);
        actualHtml += `<${tag}>${tokensToHtml(tokens, fixture.labels)}</${tag}>`;
        literalHtml += `<${tag}>${tokensToHtml(tokens, fixture.labels, true)}</${tag}>`;
    }
    result.actual = htmlSemantics(actualHtml);
    const fieldsConform = result.htmlFields.length === 0;
    if (fieldsConform && equal(result.actual, expected)) {
        result.status = 'conforming';
    }
    else if (fieldsConform && example.suite === 'gfm' && equal(result.actual, currentCommonMark.get(example.markdown) ?? [])) {
        result.status = 'version-difference';
        result.reason = 'The same Markdown matches CommonMark 0.31.2; the GFM 0.29-gfm fixture expects older semantics.';
    }
    else if (fieldsConform && equal(htmlSemantics(literalHtml), expected)) {
        result.status = 'extension-difference';
        result.reason = 'The lexer always enables GFM bare autolinks/strikethrough and emoji; treating only those tokens literally matches the spec.';
    }
    else {
        result.status = 'known-difference';
        result.reason = !fieldsConform
            ? 'Raw HTML parsed tag/retained attribute fields disagree with their source; filtering policies are recorded separately.'
            : /(?:^|\n) {0,3}\[[^\n]+\]:/.test(example.markdown)
                ? 'Reference collection/label normalization, nested reference recognition, or reference attributes differ.'
                : REASONS[example.section];
    }
    return result;
}

export function fingerprint(result: IAuditResult): string {
    return createHash('sha256').update(JSON.stringify({
        sources: result.sources,
        expected: result.expected,
        actual: result.actual,
        ...(result.htmlFields.length ? { htmlFields: result.htmlFields } : {}),
    })).digest('hex');
}

export function baselineEntry(result: IAuditResult): IBaselineEntry | undefined {
    if (result.status === 'conforming')
        return;
    if (result.status === 'uncovered')
        return { status: result.status, reason: result.reason };
    return { status: result.status, reason: result.reason, fingerprint: fingerprint(result) };
}

export function summarize(results: IAuditResult[]) {
    const groups = new Map<string, Record<Status, number> & { suite: string; section: string; total: number }>();
    for (const result of results) {
        const key = `${result.suite}: ${result.section}`;
        const row = groups.get(key) ?? {
            'suite': result.suite,
            'section': result.section,
            'total': 0,
            'conforming': 0,
            'known-difference': 0,
            'extension-difference': 0,
            'version-difference': 0,
            'uncovered': 0,
        };
        row.total++;
        row[result.status]++;
        groups.set(key, row);
    }
    return [...groups.values()];
}
