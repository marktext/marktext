import type { Nullable } from '../../../types';

export interface IFoldSibling {
    blockName: string;
    /** Heading level 1..6; undefined for non-heading blocks. */
    level?: number;
    folded?: boolean;
    /** Inclusive sibling index captured when folded; omitted for an unbounded section. */
    foldEnd?: number;
}

export interface IHeadingNode {
    blockName: string;
    meta?: { level?: number };
    folded?: boolean;
    toggleFold?: (folded?: boolean) => void;
}

export interface IFoldableHeading extends IHeadingNode {
    blockName: 'atx-heading';
    meta: { level: number };
    folded: boolean;
    toggleFold: (folded?: boolean) => void;
}

/** ATX and Setext headings share section boundaries regardless of fold support. */
export function headingLevel(node: Nullable<IHeadingNode>): number | undefined {
    return node?.blockName === 'atx-heading' || node?.blockName === 'setext-heading'
        ? node.meta?.level
        : undefined;
}

export function isFoldableHeading(node: Nullable<IHeadingNode>): node is IFoldableHeading {
    return node?.blockName === 'atx-heading'
        && typeof node.meta?.level === 'number'
        && typeof node.folded === 'boolean'
        && typeof node.toggleFold === 'function';
}

/** A folded heading hides following siblings until the next equal or higher heading. */
export function hiddenByFoldedSections(sectionBlocks: IFoldSibling[]): boolean[] {
    const regions: { level: number; end: number }[] = [];
    const hidden: boolean[] = [];

    for (const [index, block] of sectionBlocks.entries()) {
        const level = block.blockName === 'atx-heading' || block.blockName === 'setext-heading'
            ? block.level
            : undefined;
        while (regions.length) {
            const region = regions[regions.length - 1];
            if (index <= region.end && (level === undefined || level > region.level))
                break;
            regions.pop();
        }
        hidden.push(regions.length > 0);
        if (block.folded && level !== undefined)
            regions.push({ level, end: block.foldEnd ?? Number.POSITIVE_INFINITY });
    }

    return hidden;
}

export interface IFoldKeyChord {
    key: string;
    code: string;
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
}

/** Physical key codes also match layouts where Shift+[ produces another character. */
export function isFoldShortcut(event: IFoldKeyChord): boolean {
    return (event.key === '[' || event.code === 'BracketLeft')
        && event.shiftKey
        && (event.metaKey || event.ctrlKey)
        && !event.altKey;
}
