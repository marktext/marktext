export type InlineProfile = 'paragraph' | 'atx-heading' | 'setext-heading' | 'table-cell' | 'thematic-break' | 'inline';

export interface IBlockProfile {
    readonly prefixRules: readonly ('header' | 'hr' | 'code_fence' | 'multiple_math')[];
    readonly referenceDefinitions: boolean;
}

const prefixes: IBlockProfile = {
    prefixRules: ['header', 'hr', 'code_fence', 'multiple_math'],
    referenceDefinitions: true,
};
const inline: IBlockProfile = { prefixRules: [], referenceDefinitions: false };

// Preserve editable prefix recognition while making each block's policy explicit.
export const BLOCK_PROFILES: Readonly<Record<InlineProfile, IBlockProfile>> = {
    'paragraph': prefixes,
    'atx-heading': prefixes,
    'thematic-break': prefixes,
    'setext-heading': inline,
    'table-cell': inline,
    'inline': inline,
};

export function profileForBlock(blockName: string): InlineProfile {
    switch (blockName) {
        case 'paragraph.content': return 'paragraph';
        case 'atxheading.content': return 'atx-heading';
        case 'setextheading.content': return 'setext-heading';
        case 'table.cell.content': return 'table-cell';
        case 'thematicbreak.content': return 'thematic-break';
        default: return 'inline';
    }
}
