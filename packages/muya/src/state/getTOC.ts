import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import { tokenizer, tokensToInlineHtml, tokensToPlainText } from '../inlineRenderer/lexer';
import { getUniqueId } from '../utils';
import { generateGithubSlug } from '../utils/slug';

export interface ITocItem {
    content: string;
    contentHtml: string;
    lvl: number;
    slug: string;
    githubSlug: string;
}

interface IHeadingBlock extends Parent {
    meta: { level: number };
}

const slugCache = new WeakMap<Parent, string>();

export function stableSlug(block: Parent): string {
    let slug = slugCache.get(block);
    if (slug == null) {
        slug = getUniqueId();
        slugCache.set(block, slug);
    }
    return slug;
}

export function getTOC(muya: Muya): ITocItem[] {
    const { scrollPage } = muya.editor;
    if (!scrollPage)
        return [];

    const items: ITocItem[] = [];

    for (const node of scrollPage.children.iterator()) {
        const { blockName } = node;
        if (blockName !== 'atx-heading' && blockName !== 'setext-heading')
            continue;

        const block = node as IHeadingBlock;
        const head = block.children.head as Content | null;
        const text = head?.text ?? '';

        const source = blockName === 'setext-heading'
            ? text.trim()
            : text.replace(/^\s*#{1,6}\s+/, '').trim();

        // Tokenize the heading source once and derive both serializations from
        // it: `content` is the reader-facing plain text (inline markdown
        // stripped, for the slug, the document title and the exported TOC), and
        // `contentHtml` is that same text with emphasis / code / emoji rendered
        // for the outline panel (#3110). Sharing one token pass keeps the shown
        // text and the slug in step — `githubSlug` must match the anchor id the
        // HTML export injects from `heading.textContent`
        // (state/markdownToHtml.ts, #4811).
        const { superSubScript, footnote, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, highlightSyntax } = muya.options;
        const tokens = tokenizer(source, {
            hasBeginRules: false,
            options: { superSubScript, footnote, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, highlightSyntax },
        });

        const content = tokensToPlainText(tokens).trim();
        const contentHtml = tokensToInlineHtml(tokens).trim();

        items.push({
            content,
            contentHtml,
            lvl: block.meta.level,
            slug: stableSlug(block),
            githubSlug: generateGithubSlug(content),
        });
    }

    return items;
}
