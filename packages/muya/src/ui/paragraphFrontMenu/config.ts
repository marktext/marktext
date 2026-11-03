import type Parent from '../../block/base/parent';
import type {
    IQuickInsertMenuItem,
} from '../paragraphQuickInsertMenu/config';
import copyIcon from '../../assets/icons/copy/2.png';
import deleteIcon from '../../assets/icons/delete/2.png';
import newIcon from '../../assets/icons/paragraph/2.png';
import { canTurnInto } from '../../block/blockTransforms';
import { CopyType } from '../../clipboard/types';
import { isOsx, isWin } from '../../config';
import {
    MENU_CONFIG,
} from '../paragraphQuickInsertMenu/config';

const ALL_MENU_CONFIG = MENU_CONFIG.reduce(
    (acc, section) => [...acc, ...section.children],
    [] as IQuickInsertMenuItem['children'],
);

const COMMAND_KEY = isOsx ? '⌘' : '⌃';

export const FRONT_MENU = [
    {
        icon: copyIcon,
        label: 'duplicate',
        text: 'Duplicate',
        shortCut: isOsx ? '⇧⌘E' : isWin ? 'Ctrl+Alt+D' : 'Ctrl+Shift+E',
    },
    {
        icon: newIcon,
        label: 'new',
        text: 'New Paragraph',
        shortCut: `⇧${COMMAND_KEY}N`,
    },
    {
        icon: deleteIcon,
        label: 'delete',
        text: 'Delete',
        shortCut: `⇧${COMMAND_KEY}D`,
    },
];

export const COPY_AS = { icon: copyIcon, label: 'copy-as', text: 'Copy as' };

export const COPY_AS_MENU = [
    { label: 'copy-as-markdown', text: 'Markdown', copyType: CopyType.COPY_AS_MARKDOWN },
    { label: 'copy-as-html', text: 'HTML', copyType: CopyType.COPY_AS_HTML },
    { label: 'copy-as-rich', text: 'Rich Text', copyType: CopyType.COPY_AS_RICH },
];

export type FrontMenuIcon = (typeof FRONT_MENU)[number];

export function canTurnIntoMenu(block: Parent) {
    return ALL_MENU_CONFIG.filter(item => canTurnInto(block, item.label));
}
