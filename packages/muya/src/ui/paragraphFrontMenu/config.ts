import type Parent from '../../block/base/parent';
import type {
    IQuickInsertMenuItem,
} from '../paragraphQuickInsertMenu/config';
import copyIcon from '../../assets/icons/copy/2.png';
import deleteIcon from '../../assets/icons/delete/2.png';
import newIcon from '../../assets/icons/paragraph/2.png';
import { isOsx } from '../../config';
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
        shortCut: `⇧${COMMAND_KEY}P`,
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

export type FrontMenuIcon = (typeof FRONT_MENU)[number];

export function canTurnIntoMenu(block: Parent) {
    const { blockName } = block;

    switch (blockName) {
        case 'paragraph': {
            const paragraphIsEmpty = /^\s*$/.test(block.firstContentInDescendant()!.text);
            if (paragraphIsEmpty)
                return ALL_MENU_CONFIG.filter(item => item.label !== 'frontmatter');

            const PARAGRAPH_TURN_INTO_REG
                = /paragraph|atx-heading|block-quote|order-list|bullet-list|task-list/;

            return ALL_MENU_CONFIG.filter(item =>
                PARAGRAPH_TURN_INTO_REG.test(item.label),
            );
        }

        case 'atx-heading': {
            return ALL_MENU_CONFIG.filter(item =>
                /atx-heading|paragraph/.test(item.label),
            );
        }

        case 'order-list':
            // fall through
        case 'bullet-list':
            // fall through
        case 'task-list': {
            return ALL_MENU_CONFIG.filter(item =>
                /order-list|bullet-list|task-list/.test(item.label),
            );
        }

        default:
            return [];
    }
}
