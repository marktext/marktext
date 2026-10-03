import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { IMarkdownToStateOptions } from '../state/markdownToState';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import type { ITextBlockInfo, ITextBlockSelection } from './types';
import { MarkdownToState } from '../state/markdownToState';

// State leaves that own a `text` field. `language-input` is a content leaf too,
// but its string is `meta.lang`, which `markdownToState` does not emit — including
// it would break the headless/live invariant.
const TEXT_OWNER_NAMES = new Set([
    'paragraph',
    'atx-heading',
    'setext-heading',
    'thematic-break',
    'code-block',
    'html-block',
    'math-block',
    'frontmatter',
    'diagram',
    'table.cell',
]);

// Public type names from F-1.1. The listed blocks use these compact forms; every
// other registry name is kept as registered (`thematic-break`, `html-block`, …).
// A list or task item is a container — its words live in a child paragraph, and
// that paragraph is reported as `listitem` / `taskitem`.
const PUBLIC_TYPE: Record<string, string> = {
    'paragraph': 'paragraph',
    'atx-heading': 'atxheading',
    'setext-heading': 'setextheading',
    'code-block': 'codeblock',
    'table.cell': 'tablecell',
};

export interface ILiveTextBlock extends ITextBlockInfo {
    content: Content;
}

interface ITextBlockEditor {
    editor: {
        scrollPage: Nullable<Parent>;
        selection: {
            getSelection: () => {
                isCollapsed: boolean;
                isSelectionInSameBlock: boolean;
                anchor: { block: Content; offset: number };
                focus: { block: Content; offset: number };
            } | null;
        };
    };
}

export function markdownToTextBlocks(
    markdown: string,
    options?: Partial<IMarkdownToStateOptions>,
): ITextBlockInfo[] {
    return textBlocksFromState(new MarkdownToState(options).generate(markdown));
}

export function textBlocksFromState(states: TState[]): ITextBlockInfo[] {
    const out: ITextBlockInfo[] = [];

    const visit = (nodes: TState[], parentName: string | null) => {
        for (const node of nodes) {
            if (isTextLeaf(node)) {
                out.push({
                    index: out.length,
                    type: leafType(node.name, parentName),
                    text: node.text,
                });
            }
            else if (isContainer(node)) {
                visit(node.children, node.name);
            }
        }
    };

    visit(states, null);

    return out;
}

export function collectLiveTextBlocks(source: { editor: { scrollPage: Nullable<Parent> } }): ILiveTextBlock[] {
    const page = source.editor.scrollPage;

    if (!page)
        return [];

    const out: ILiveTextBlock[] = [];

    page.depthFirstTraverse((node) => {
        if (!node.isContent() || node.blockName === 'language-input')
            return;

        const type = owningTextBlockType(node);

        if (!type)
            return;

        out.push({
            index: out.length,
            type,
            text: node.text,
            content: node,
        });
    });

    return out;
}

export function selectionInTextBlock(source: ITextBlockEditor): ITextBlockSelection | null {
    const selection = source.editor.selection.getSelection();

    if (!selection || selection.isCollapsed || !selection.isSelectionInSameBlock)
        return null;

    const { anchor, focus } = selection;

    if (anchor.block !== focus.block)
        return null;

    const found = collectLiveTextBlocks(source).find(item => item.content === anchor.block);

    if (!found)
        return null;

    const start = Math.min(anchor.offset, focus.offset);
    const end = Math.max(anchor.offset, focus.offset);

    if (start === end)
        return null;

    return {
        index: found.index,
        start,
        end,
        text: anchor.block.text.slice(start, end),
    };
}

function owningTextBlockType(block: Content): string | null {
    let node = block.parent;

    while (node) {
        if (TEXT_OWNER_NAMES.has(node.blockName))
            return leafType(node.blockName, node.parent?.blockName ?? null);

        node = node.parent;
    }

    return null;
}

function leafType(stateName: string, parentName: string | null): string {
    if (stateName === 'paragraph' && parentName === 'list-item')
        return 'listitem';

    if (stateName === 'paragraph' && parentName === 'task-list-item')
        return 'taskitem';

    return PUBLIC_TYPE[stateName] ?? stateName;
}

function isTextLeaf(node: TState): node is TState & { name: string; text: string } {
    return 'text' in node && !('children' in node);
}

function isContainer(node: TState): node is TState & { children: TState[] } {
    return 'children' in node;
}
