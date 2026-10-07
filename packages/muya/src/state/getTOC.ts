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

    // Headings are tokenized outside a rendered block, so the reference
    // definitions a heading may link to (`[text][ref]`) have to be collected
    // here instead of from the block's own inline renderer.
    const labels = muya.editor.inlineRenderer.collectReferenceDefinitions();

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

        // One token pass feeds both serializations so the outline's shown text
        // and its slug stay in step; `githubSlug` has to match the anchor id the
        // HTML export injects from `heading.textContent`.
        const { superSubScript, footnote, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, highlightSyntax } = muya.options;
        const tokens = tokenizer(source, {
            hasBeginRules: false,
            labels,
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
