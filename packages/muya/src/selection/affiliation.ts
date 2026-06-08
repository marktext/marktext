// Block-affiliation derivation for the `selection-change` payload.
//
// PARITY (gap PG1): legacy `packages/muyajs` emitted `selectionChange` with an
// `affiliation` chain — the shared ancestor PARAGRAPH-type blocks of the
// selection endpoints — plus per-endpoint `.type` (the markdown block type,
// e.g. `span` for a content leaf) and `.functionType` (`codeContent`,
// `cellContent`, …). The desktop store (`createApplicationMenuState`) consumed
// those to light up the Paragraph-menu check marks, the Loose/Task-list
// toggles, table/code-fence detection, and to disable the Format menu inside
// code. `@muyajs/core` models the document as a block tree keyed by
// `blockName`, so this module re-derives the same shape from that tree.

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type { Nullable } from '../types';

/**
 * The legacy "markdown block type" vocabulary the desktop menu vocabulary is
 * keyed on (`MENU_ID_MAP` in `main/menu/actions/paragraph.ts`,
 * `PARAGRAPH_TYPES` in the renderer config). Only ancestors whose mapped type
 * is one of these belong in the affiliation chain.
 */
const PARAGRAPH_TYPES: ReadonlySet<string> = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'ul',
    'ol',
    'li',
    'figure',
]);

/**
 * Container `blockName` → legacy markdown block `type`. Heading blocks resolve
 * their level from `tagName` (`h1`…`h6`) so they are handled separately.
 */
const CONTAINER_TYPE_BY_NAME: Readonly<Record<string, string>> = {
    'paragraph': 'p',
    'block-quote': 'blockquote',
    'bullet-list': 'ul',
    'task-list': 'ul',
    'order-list': 'ol',
    'list-item': 'li',
    'task-list-item': 'li',
    'code-block': 'pre',
    'frontmatter': 'pre',
    'table': 'figure',
    'html-block': 'figure',
    'math-block': 'figure',
    'diagram': 'figure',
};

/**
 * Leaf-content `blockName` → legacy `functionType`. Mirrors the muyajs content
 * blocks (`codeContent`, `cellContent`, `languageInput`, `paragraphContent`).
 */
const FUNCTION_TYPE_BY_NAME: Readonly<Record<string, string>> = {
    'codeblock.content': 'codeContent',
    'table.cell.content': 'cellContent',
    'language-input': 'languageInput',
    'paragraph.content': 'paragraphContent',
    'atxheading.content': 'paragraphContent',
    'setextheading.content': 'paragraphContent',
};

/**
 * Container `blockName` → list-block `listType` discriminator (matches
 * muyajs's `listType`/`listItemType`).
 */
const LIST_TYPE_BY_NAME: Readonly<Record<string, string>> = {
    'bullet-list': 'bullet',
    'order-list': 'order',
    'task-list': 'task',
    'list-item': 'bullet',
    'task-list-item': 'task',
};

/**
 * One ancestor block in the affiliation chain. `type` is the legacy markdown
 * block type; the remaining fields carry the list-context the desktop menu
 * needs. Shape parity with muyajs's affiliation entries.
 */
export interface IAffiliationEntry {
    /** Legacy markdown block type: `p`, `h1`…`h6`, `ul`, `ol`, `li`, `pre`, `figure`, `blockquote`. */
    type: string;
    /** Engine block name (`bullet-list`, `code-block`, …) for callers that want the precise block. */
    blockName: string;
    /** Present on list / list-item ancestors: `bullet` | `order` | `task`. */
    listType?: string;
    /** Present on list-item ancestors: `bullet` | `task`. */
    listItemType?: string;
    /** Whether the list / list-item is rendered loose (blank-line separated). */
    isLooseListItem?: boolean;
}

/**
 * Per-endpoint block info for one selection end. `type` is always `span` for a
 * content leaf (parity with muyajs's content-block `type`); `functionType`
 * distinguishes code / table-cell / language-input content.
 */
export interface IEndpointBlockInfo {
    /** Engine block name of the content leaf, e.g. `codeblock.content`. */
    blockName: string;
    /** Legacy content-block type — always `span` for a content leaf. */
    type: string;
    /** Legacy `functionType`: `codeContent` | `cellContent` | `languageInput` | `paragraphContent`. */
    functionType?: string;
}

function _markdownTypeOf(block: TreeNode): string | undefined {
    if (block.blockName === 'atx-heading' || block.blockName === 'setext-heading')
        return block.tagName; // `h1`…`h6`

    return CONTAINER_TYPE_BY_NAME[block.blockName];
}

function _isLoose(block: Parent): boolean {
    // Lists carry `meta.loose`; a loose list item is one inside a loose list.
    const meta = (block as Parent & { meta?: { loose?: boolean } }).meta;

    return Boolean(meta?.loose);
}

function _buildEntry(block: Parent, type: string): IAffiliationEntry {
    const entry: IAffiliationEntry = { type, blockName: block.blockName };

    const listType = LIST_TYPE_BY_NAME[block.blockName];
    if (listType) {
        if (type === 'li')
            entry.listItemType = listType;
        else
            entry.listType = listType;
    }

    if (type === 'ul' || type === 'ol' || type === 'li')
        entry.isLooseListItem = _isLoose(block);

    return entry;
}

/**
 * Walk from a content leaf up to the outermost block, collecting the
 * paragraph-type ancestor blocks. Ordered outermost-first (top block → … →
 * leaf's container), matching muyajs where `affiliation[0]` is the enclosing
 * list and deeper entries follow.
 */
function _ancestorBlocks(leaf: Content | null): Parent[] {
    const blocks: Parent[] = [];
    let node: Nullable<Parent> = leaf?.parent;

    while (node) {
        if (PARAGRAPH_TYPES.has(_markdownTypeOf(node) ?? ''))
            blocks.unshift(node);

        if (node.isOutMostBlock)
            break;

        node = node.parent;
    }

    return blocks;
}

/**
 * Walk from a content leaf up to the outermost block, collecting the
 * paragraph-type ancestors into an affiliation chain (outermost-first).
 */
export function buildAffiliation(leaf: Content | null): IAffiliationEntry[] {
    return _ancestorBlocks(leaf).map(block =>
        _buildEntry(block, _markdownTypeOf(block)!),
    );
}

/**
 * Compute the shared-ancestor affiliation for a selection. When both endpoints
 * sit in the same block the anchor chain is returned; otherwise the chain is
 * trimmed to the ancestor block instances shared by both endpoints (parity
 * with muyajs's `startParents.filter(p => endParents.includes(p))`).
 */
export function buildSelectionAffiliation(
    anchorLeaf: Content | null,
    focusLeaf: Content | null,
): IAffiliationEntry[] {
    const anchorBlocks = _ancestorBlocks(anchorLeaf);
    const shared
        = anchorLeaf === focusLeaf
            ? anchorBlocks
            : _intersectBlocks(anchorBlocks, _ancestorBlocks(focusLeaf));

    return shared.map(block => _buildEntry(block, _markdownTypeOf(block)!));
}

function _intersectBlocks(anchorBlocks: Parent[], focusBlocks: Parent[]): Parent[] {
    const focusSet = new Set<Parent>(focusBlocks);

    return anchorBlocks.filter(block => focusSet.has(block));
}

/**
 * Describe one selection endpoint's content leaf in the legacy
 * `{ type, functionType }` shape.
 */
export function endpointBlockInfo(leaf: Content | null): IEndpointBlockInfo | null {
    if (!leaf)
        return null;

    return {
        blockName: leaf.blockName,
        type: leaf.tagName || 'span',
        functionType: FUNCTION_TYPE_BY_NAME[leaf.blockName],
    };
}
