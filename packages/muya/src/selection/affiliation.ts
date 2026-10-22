import type Content from '../block/base/content';

import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type { Nullable } from '../types';
import { canConvertGithubAlert } from '../block/githubAlerts';
import { githubAlertBlockType } from '../utils/githubAlerts';

// Only these legacy menu types participate in selection affiliation.
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
    'hr',
]);

const CONTAINER_TYPE_BY_NAME: Readonly<Record<string, string>> = {
    'paragraph': 'p',
    'block-quote': 'blockquote',
    'github-alert': 'blockquote',
    'bullet-list': 'ul',
    'task-list': 'ul',
    'order-list': 'ol',
    'list-item': 'li',
    'task-list-item': 'li',
    'code-block': 'pre',
    'frontmatter': 'pre',
    'table': 'figure',
    'html-block': 'pre',
    'math-block': 'pre',
    'diagram': 'figure',
    'thematic-break': 'hr',
};

const FUNCTION_TYPE_BY_NAME: Readonly<Record<string, string>> = {
    'codeblock.content': 'codeContent',
    'table.cell.content': 'cellContent',
    'language-input': 'languageInput',
    'paragraph.content': 'paragraphContent',
    'atxheading.content': 'paragraphContent',
    'setextheading.content': 'paragraphContent',
};

const LIST_TYPE_BY_NAME: Readonly<Record<string, string>> = {
    'bullet-list': 'bullet',
    'order-list': 'order',
    'task-list': 'task',
};

export interface IAffiliationEntry {
    /** Markdown block type: `p`, `h1`…`h6`, `ul`, `ol`, `li`, `pre`, `figure`, `blockquote`, `hr`. */
    type: string;
    blockName: string;
    alertType?: string;
    canGithubAlerts?: boolean;
    /** Present on list ancestors (`ul` / `ol`): `bullet` | `order` | `task`. */
    listType?: string;
    // Parent list discriminator: bullet, order or task.
    listItemType?: string;
    // Blank-line separation belongs to the list; item entries inherit it from their parent.
    isLooseListItem?: boolean;
}

export interface IEndpointBlockInfo {
    blockName: string;
    /** Content-block type — always `span` for a content leaf. */
    type: string;
    functionType?: string;
}

function _markdownTypeOf(block: TreeNode): string | undefined {
    if (block.blockName === 'atx-heading' || block.blockName === 'setext-heading')
        return block.tagName; // `h1`…`h6`

    return CONTAINER_TYPE_BY_NAME[block.blockName];
}

const LIST_BLOCK_NAMES: ReadonlySet<string> = new Set([
    'bullet-list',
    'order-list',
    'task-list',
]);

function _isLoose(block: Parent | null | undefined): boolean {
    // Lists carry `meta.loose`; list *items* do not, so loose-ness for an `li`
    // is read from its parent list block.
    const meta = (block as (Parent & { meta?: { loose?: boolean } }) | null)?.meta;

    return Boolean(meta?.loose);
}

function _parentListOf(item: Parent): Parent | null {
    let node: Nullable<Parent> = item.parent;
    while (node) {
        if (LIST_BLOCK_NAMES.has(node.blockName))
            return node;

        node = node.parent;
    }

    return null;
}

function _buildEntry(block: Parent, type: string): IAffiliationEntry {
    const entry: IAffiliationEntry = { type, blockName: block.blockName };
    if (block.muya.options.githubAlerts && block.parent?.isScrollPage) {
        entry.alertType = githubAlertBlockType(block) ?? undefined;
        entry.canGithubAlerts = canConvertGithubAlert(block, 'github-alert NOTE');
    }

    if (type === 'ul' || type === 'ol') {
        entry.listType = LIST_TYPE_BY_NAME[block.blockName];
        entry.isLooseListItem = _isLoose(block);
    }
    else if (type === 'li') {
        // Both bullet and ordered items share the `list-item` block, and the
        // loose flag lives on the parent list — derive both from there.
        const list = _parentListOf(block);
        entry.listItemType = list ? LIST_TYPE_BY_NAME[list.blockName] : undefined;
        entry.isLooseListItem = _isLoose(list);
    }

    return entry;
}

// Paragraph-type ancestors in outermost-first order.
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

export function buildAffiliation(leaf: Content | null): IAffiliationEntry[] {
    return _ancestorBlocks(leaf).map(block =>
        _buildEntry(block, _markdownTypeOf(block)!),
    );
}

// Return only ancestors shared by both selection endpoints.
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

export function endpointBlockInfo(leaf: Content | null): IEndpointBlockInfo | null {
    if (!leaf)
        return null;

    return {
        blockName: leaf.blockName,
        type: leaf.tagName || 'span',
        functionType: FUNCTION_TYPE_BY_NAME[leaf.blockName],
    };
}
