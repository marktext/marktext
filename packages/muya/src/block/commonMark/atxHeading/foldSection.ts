export interface IFoldSibling {
    blockName: string;
    /** Heading level 1..6; undefined for non-heading blocks. */
    level?: number;
    folded?: boolean;
    /** Inclusive sibling index captured when folded; omitted for an unbounded section. */
    foldEnd?: number;
}

export interface IFoldableHeading {
    blockName: string;
    meta: { level: number };
    folded: boolean;
    toggleFold: (folded?: boolean) => void;
}

/** ATX and Setext headings share section boundaries regardless of fold support. */
export function headingLevel(node: unknown): number | undefined {
    if (typeof node !== 'object' || node === null || !('blockName' in node))
        return undefined;
    if (node.blockName !== 'atx-heading' && node.blockName !== 'setext-heading')
        return undefined;
    if (!('meta' in node) || typeof node.meta !== 'object' || node.meta === null)
        return undefined;
    return 'level' in node.meta && typeof node.meta.level === 'number'
        ? node.meta.level
        : undefined;
}

export function isFoldableHeading(node: unknown): node is IFoldableHeading {
    return typeof node === 'object'
        && node !== null
        && 'blockName' in node
        && node.blockName === 'atx-heading'
        && headingLevel(node) !== undefined
        && 'folded' in node
        && typeof node.folded === 'boolean'
        && 'toggleFold' in node
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
