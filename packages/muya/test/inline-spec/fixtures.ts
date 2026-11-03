import type { Tokens } from 'marked';
import type { IReferenceDefinition, Labels } from '../../src/inline/model/types';
import type { ISpecExample } from '../spec/runner';
// @ts-expect-error commonmark-spec has no TypeScript declaration.
import cms from 'commonmark-spec';
import { Marked } from 'marked';
import { getReferenceDefinition } from '../../src/inline/referenceDefinitions';
import referenceDefinitionTabs from '../../src/utils/marked/extensions/referenceDefinitionTabs';
import gfmExamples from '../spec/fixtures/gfm-spec-0.29-gfm.json';

export type Suite = 'commonmark' | 'gfm';
export interface IInlineExample extends ISpecExample {
    suite: Suite;
    id: string;
}
export interface IInlineBlock {
    tag: string;
    source: string;
}
export type AdaptedFixture = { blocks: IInlineBlock[]; labels: Labels } | { uncovered: string };

const INLINE_SECTIONS = new Set([
    'Inlines',
    'Backslash escapes',
    'Entity and numeric character references',
    'Code spans',
    'Emphasis and strong emphasis',
    'Links',
    'Images',
    'Autolinks',
    'Raw HTML',
    'Hard line breaks',
    'Soft line breaks',
    'Textual content',
    'Strikethrough (extension)',
    'Autolinks (extension)',
    'Disallowed Raw HTML (extension)',
]);

export const examples: IInlineExample[] = [
    ...(cms.tests as ISpecExample[]).map(example => ({ ...example, suite: 'commonmark' as const })),
    ...gfmExamples.map(example => ({ ...example, suite: 'gfm' as const })),
].filter(example => INLINE_SECTIONS.has(example.section)).map(example => ({
    ...example,
    // These fixtures retain spec.txt's visible tab notation; official spec.json uses U+0009.
    markdown: example.markdown.replace(/→/g, '\t'),
    html: example.html.replace(/→/g, '\t'),
    id: `${example.suite}:${example.number}`,
}));

export function adaptFixture(example: IInlineExample): AdaptedFixture {
    // Only block tokenization is used. Marked's inline tokens and resolved links are never the oracle.
    const marked = new Marked({ gfm: example.suite === 'gfm' }, referenceDefinitionTabs());
    const tokens = new marked.Lexer(marked.defaults).blockTokens(example.markdown);
    const unsupported = tokens.filter(token => !['paragraph', 'heading', 'def', 'space'].includes(token.type));
    if (unsupported.length)
        return { uncovered: `Block adapter does not support: ${[...new Set(unsupported.map(token => token.type))].join(', ')}` };

    const blocks: IInlineBlock[] = [];
    const labels = new Map<string, IReferenceDefinition>();
    for (const token of tokens) {
        if (token.type === 'paragraph') {
            blocks.push({ tag: 'p', source: (token as Tokens.Paragraph).text });
        }
        else if (token.type === 'heading') {
            const heading = token as Tokens.Heading;
            blocks.push({ tag: `h${heading.depth}`, source: heading.text });
        }
        else if (token.type === 'def') {
            const { label, info } = getReferenceDefinition({ text: token.raw.replace(/\n+$/, '') });
            if (label && info && !labels.has(label))
                labels.set(label, info);
        }
    }
    return { blocks, labels };
}
