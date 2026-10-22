import DeleteIcon from '../../assets/icons/delete/2.png';
import EditIcon from '../../assets/icons/edit.png';
import ViewIcon from '../../assets/icons/view/2.png';

export type TPreviewToolType = 'view' | 'edit' | 'delete';

export interface IPreviewToolIcon {
    type: TPreviewToolType;
    tooltip: string;
    icon: string;
    blocks?: ReadonlySet<string>;
    requiresRender?: boolean;
}

// A diagram's `diagram-preview` attachment and `diagram-container` child are
// hit before the `figure` by `elementsFromPoint`, so this has to be an exact
// match — a substring test would anchor the toolbar to the inner node.
export const PREVIEW_BLOCK_NAMES: ReadonlySet<string> = new Set([
    'html-block',
    'math-block',
    'diagram',
]);

const DIAGRAM_ONLY: ReadonlySet<string> = new Set(['diagram']);

const ICONS: IPreviewToolIcon[] = [
    {
        type: 'view',
        tooltip: 'View diagram',
        icon: ViewIcon,
        blocks: DIAGRAM_ONLY,
        requiresRender: true,
    },
    {
        type: 'edit',
        tooltip: 'Edit block',
        icon: EditIcon,
    },
    {
        type: 'delete',
        tooltip: 'Delete block',
        icon: DeleteIcon,
    },
];

export function previewToolBarItems(
    blockName: string,
    hasRenderedMedia: boolean,
): IPreviewToolIcon[] {
    return ICONS.filter(
        icon =>
            (icon.blocks?.has(blockName) ?? true)
            && (!icon.requiresRender || hasRenderedMedia),
    );
}
