import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import { getUniqueId } from '../utils';
import { generateGithubSlug } from '../utils/slug';

export interface ITocItem {
    content: string;
    lvl: number;
    slug: string;
    githubSlug: string;
}

interface IHeadingBlock extends Parent {
    meta: { level: number };
}

// Stable per-block slug. marktext exposed `block.key` for the same purpose
// (a DOM-id-friendly anchor that survives across `getTOC()` calls). The new
// block tree has no `.key`, so we lazily assign one and cache by block
// instance — same heading → same slug, even across repeated invocations.
// Different muya instances build different blocks, so there is no risk of
// cross-instance collision.
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

    // Walk the linked list directly instead of `forEach`, which materialises
    // every top-level block into an array via `[...iterator()]` (see
    // `LinkedList.forEach`). For large documents the intermediate array is
    // pure waste.
    for (const node of scrollPage.children.iterator()) {
        const { blockName } = node;
        if (blockName !== 'atx-heading' && blockName !== 'setext-heading')
            continue;

        const block = node as IHeadingBlock;
        const head = block.children.head as Content | null;
        const text = head?.text ?? '';

        // 9cb2cbe8: `\s` instead of literal ASCII space so unicode
        // whitespace / tabs before or between the `#` markers also strip
        // cleanly.
        const content = blockName === 'setext-heading'
            ? text.trim()
            : text.replace(/^\s*#{1,6}\s+/, '').trim();

        items.push({
            content,
            lvl: block.meta.level,
            slug: stableSlug(block),
            githubSlug: generateGithubSlug(content),
        });
    }

    return items;
}
