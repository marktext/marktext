import type Parent from '../../block/base/parent';
import type { Muya } from '../../index';
import type { IFrontmatterMeta } from '../../state/types';
import bulletListIcon from '../../assets/icons/bullet_list/2.png';
import vegaIcon from '../../assets/icons/chart/2.png';
import codeIcon from '../../assets/icons/code/2.png';
import flowchartIcon from '../../assets/icons/flowchart/2.png';
import frontMatterIcon from '../../assets/icons/front_matter/2.png';
import header1Icon from '../../assets/icons/heading_1/2.png';
import header2Icon from '../../assets/icons/heading_2/2.png';
import header3Icon from '../../assets/icons/heading_3/2.png';
import header4Icon from '../../assets/icons/heading_4/2.png';
import header5Icon from '../../assets/icons/heading_5/2.png';
import header6Icon from '../../assets/icons/heading_6/2.png';
import hrIcon from '../../assets/icons/horizontal_line/2.png';
import htmlIcon from '../../assets/icons/html/2.png';
import mathBlockIcon from '../../assets/icons/math/2.png';
import mermaidIcon from '../../assets/icons/mermaid/2.png';
import newTableIcon from '../../assets/icons/new_table/2.png';
import orderListIcon from '../../assets/icons/order_list/2.png';
import paragraphIcon from '../../assets/icons/paragraph/2.png';
import plantumlIcon from '../../assets/icons/plantuml/2.png';
import quoteIcon from '../../assets/icons/quote_block/2.png';
import sequenceIcon from '../../assets/icons/sequence/2.png';

import todoListIcon from '../../assets/icons/todolist/2.png';
import { ScrollPage } from '../../block/scrollPage';
import { isOsx } from '../../config';

import emptyStates from '../../config/emptyStates';
import { getCursorReference } from '../../selection';
import { isParagraphState } from '../../state/types';
import { deepClone, isKeyboardEvent } from '../../utils';
import logger from '../../utils/logger';

const debug = logger('quickInsert:');

/**
 * Derive the frontmatter `lang`/`style` from the user's `frontmatterType`
 * preference, mirroring legacy muyajs `handleFrontMatter`
 * (contentState/paragraphCtrl.js): `-` -> yaml `---`, `+` -> toml `+++`,
 * `;`/`{` -> json (`;;;`/`{}`). The serializer (`serializeFrontMatter`)
 * switches on `lang`, so getting `lang` right is what makes YAML/TOML emit
 * their fences instead of falling through to JSON braces.
 */
export function frontmatterMeta(frontmatterType: string): IFrontmatterMeta {
    switch (frontmatterType) {
        case '+':
            return { lang: 'toml', style: '+' };
        case ';':
            return { lang: 'json', style: ';' };
        case '{':
            return { lang: 'json', style: '{' };
        case '-':
        default:
            return { lang: 'yaml', style: '-' };
    }
}

/**
 * Prepend a front matter block at the very start of the document, mirroring
 * legacy muyajs `handleFrontMatter`. Front matter is only valid as the first
 * block, so this never replaces the block at the cursor. Idempotent: a no-op
 * when the document already starts with front matter, so it never duplicates
 * the block. Shared by `Muya.updateParagraph('front-matter')` and the
 * quick-insert menu's `frontmatter` entry so both follow identical semantics.
 */
export function insertFrontMatterAtStart(muya: Muya) {
    const { scrollPage } = muya.editor;
    if (!scrollPage)
        return;

    const firstBlock = scrollPage.firstChild as Parent | null;
    if (firstBlock?.blockName === 'frontmatter')
        return;

    const fmState = deepClone(emptyStates.frontmatter);
    Object.assign(fmState.meta, frontmatterMeta(muya.options.frontmatterType));

    const frontmatter = ScrollPage.loadBlock('frontmatter').create(muya, fmState);
    scrollPage.insertBefore(frontmatter, firstBlock);
    frontmatter.firstContentInDescendant()?.setCursor(0, 0, true);
}

const COMMAND_KEY = isOsx ? '⌘' : 'Ctrl';
const OPTION_KEY = isOsx ? '⌥' : 'Alt';
const SHIFT_KEY = isOsx ? '⇧' : 'Shift';

// Command (or Cmd) ⌘
// Shift ⇧
// Option (or Alt) ⌥
// Control (or Ctrl) ⌃
// Caps Lock ⇪
// Fn

export interface IQuickInsertMenuItem {
    name: string;
    children: {
        title: string;
        subTitle: string;
        label: string;
        icon: string;
        score?: number;
        i18nTitle?: string;
        shortCut?: string;
        shortKeyMap?: {
            altKey: boolean;
            shiftKey: boolean;
            metaKey: boolean;
            code: string;
        };
    }[];
}

export const MENU_CONFIG: IQuickInsertMenuItem[] = [
    {
        name: 'basic blocks',
        children: [
            {
                title: 'Paragraph',
                subTitle: 'Lorem Ipsum text',
                label: 'paragraph',
                shortCut: `${COMMAND_KEY}+0`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit0',
                },
                icon: paragraphIcon,
            },
            {
                title: 'Horizontal Line',
                subTitle: '---',
                label: 'thematic-break',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+-`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Minus',
                },
                icon: hrIcon,
            },
            {
                title: 'Front Matter',
                subTitle: '--- Lorem Ipsum ---',
                label: 'frontmatter',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+Y`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyY',
                },
                icon: frontMatterIcon,
            },
        ],
    },
    {
        name: 'headers',
        children: [
            {
                title: 'Header 1',
                subTitle: '# Lorem Ipsum...',
                label: 'atx-heading 1',
                shortCut: `${COMMAND_KEY}+1`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit1',
                },
                icon: header1Icon,
            },
            {
                title: 'Header 2',
                subTitle: '## Lorem Ipsum...',
                label: 'atx-heading 2',
                shortCut: `${COMMAND_KEY}+2`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit2',
                },
                icon: header2Icon,
            },
            {
                title: 'Header 3',
                subTitle: '### Lorem Ipsum...',
                label: 'atx-heading 3',
                shortCut: `${COMMAND_KEY}+3`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit3',
                },
                icon: header3Icon,
            },
            {
                title: 'Header 4',
                subTitle: '#### Lorem Ipsum...',
                label: 'atx-heading 4',
                shortCut: `${COMMAND_KEY}+4`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit4',
                },
                icon: header4Icon,
            },
            {
                title: 'Header 5',
                subTitle: '##### Lorem Ipsum...',
                label: 'atx-heading 5',
                shortCut: `${COMMAND_KEY}+5`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit5',
                },
                icon: header5Icon,
            },
            {
                title: 'Header 6',
                subTitle: '###### Lorem Ipsum...',
                label: 'atx-heading 6',
                shortCut: `${COMMAND_KEY}+6`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: false,
                    metaKey: true,
                    code: 'Digit6',
                },
                icon: header6Icon,
            },
        ],
    },
    {
        name: 'advanced blocks',
        children: [
            {
                title: 'Table Block',
                subTitle: '|Lorem | Ipsum |',
                label: 'table',
                // no
                shortCut: `${SHIFT_KEY}+${COMMAND_KEY}+T`,
                shortKeyMap: {
                    altKey: false,
                    shiftKey: true,
                    metaKey: true,
                    code: 'KeyT',
                },
                icon: newTableIcon,
            },
            {
                title: 'Display Math',
                subTitle: '$$ Lorem Ipsum $$',
                label: 'math-block',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+M`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyM',
                },
                icon: mathBlockIcon,
            },
            {
                title: 'HTML Block',
                subTitle: '<div> Lorem Ipsum </div>',
                label: 'html-block',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+J`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyJ',
                },
                icon: htmlIcon,
            },
            {
                title: 'Code Block',
                subTitle: '```java Lorem Ipsum ```',
                label: 'code-block',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+C`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyC',
                },
                icon: codeIcon,
            },
            {
                title: 'Quote Block',
                subTitle: '>Lorem Ipsum ...',
                label: 'block-quote',
                // no
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+Q`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyQ',
                },
                icon: quoteIcon,
            },
        ],
    },
    {
        name: 'list blocks',
        children: [
            {
                title: 'Order List',
                subTitle: '1. Lorem Ipsum ...',
                label: 'order-list',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+O`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyO',
                },
                icon: orderListIcon,
            },
            {
                title: 'Bullet List',
                subTitle: '- Lorem Ipsum ...',
                label: 'bullet-list',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+U`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyU',
                },
                icon: bulletListIcon,
            },
            {
                title: 'To-do List',
                subTitle: '- [x] Lorem Ipsum ...',
                label: 'task-list',
                shortCut: `${OPTION_KEY}+${COMMAND_KEY}+X`,
                shortKeyMap: {
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                    code: 'KeyX',
                },
                icon: todoListIcon,
            },
        ],
    },
    {
        name: 'diagrams',
        children: [
            {
                title: 'Vega Chart',
                subTitle: 'By vega-lite.js',
                label: 'diagram vega-lite',
                icon: vegaIcon,
            },
            {
                title: 'Mermaid',
                subTitle: 'By mermaid',
                label: 'diagram mermaid',
                icon: mermaidIcon,
            },
            {
                title: 'Plantuml',
                subTitle: 'By plantuml',
                label: 'diagram plantuml',
                icon: plantumlIcon,
            },
            {
                title: 'Flowchart',
                subTitle: 'By flowchart.js',
                label: 'diagram flowchart',
                icon: flowchartIcon,
            },
            {
                title: 'Sequence',
                subTitle: 'By js-sequence-diagrams',
                label: 'diagram sequence',
                icon: sequenceIcon,
            },
        ],
    },
];

export function getLabelFromEvent(event: Event) {
    if (!isKeyboardEvent(event))
        return null;
    const ALL_MENU_CONFIG = MENU_CONFIG.reduce(
        (acc, section) => [...acc, ...section.children],
        [] as IQuickInsertMenuItem['children'],
    );

    const result = ALL_MENU_CONFIG.find((menu) => {
        const { code, metaKey, shiftKey, altKey } = event;
        const { shortKeyMap = {} as IQuickInsertMenuItem['children'][number]['shortKeyMap'] } = menu;

        return (
            code === shortKeyMap?.code
            && metaKey === shortKeyMap.metaKey
            && shiftKey === shortKeyMap.shiftKey
            && altKey === shortKeyMap.altKey
        );
    });

    if (result)
        return result.label;
}

/**
 * Show the in-editor table grid picker, porting legacy muyajs
 * `paragraphCtrl.showTablePicker`. The in-editor "table" insert (the `/`
 * quick-insert menu and the paragraph front-menu) must offer a hover-grid
 * dimension picker rather than dropping a fixed-size table — the picker UI
 * (`TableChessboard`) subscribes to `muya-table-picker` and invokes the
 * dispatched callback with the zero-based `(row, column)` the user picked, so
 * the table is created at `row + 1 × column + 1` to match legacy semantics.
 *
 * The float anchors to the caret (`getCursorReference`); when the cursor has
 * no coords (e.g. the front-menu took focus) it falls back to the block's DOM
 * node. No-op if neither is available.
 */
export function showTablePicker(muya: Muya, block: Parent) {
    const { eventCenter } = muya;
    const reference = getCursorReference() ?? block.domNode;
    if (!reference)
        return;

    const handler = (row: number, column: number) => {
        muya.createTable({ rows: row + 1, columns: column + 1 });
    };

    eventCenter.emit('muya-table-picker', { row: -1, column: -1 }, reference, handler);
}

export function replaceBlockByLabel({ block, muya, label, text = '' }: {
    block: Parent;
    muya: Muya;
    label: string;
    text?: string;
}) {
    const {
        preferLooseListItem,
        bulletListMarker,
        orderListDelimiter,
    } = muya.options;
    let newBlock = null;
    let state = null;
    let cursorBlock = null;

    // Front matter is only valid as the document's first block, so the
    // quick-insert "Front Matter" entry must NOT replace the cursor block in
    // place (which destroyed its content and produced invalid mid-document
    // front matter). Prepend at document start and bail before the in-place
    // `block.replaceWith` below — sharing the idempotent doc-start logic with
    // `Muya.updateParagraph('front-matter')`.
    if (label === 'frontmatter') {
        insertFrontMatterAtStart(muya);
        return;
    }

    // The in-editor "table" insert shows a hover-grid dimension picker
    // (legacy muyajs `showTablePicker`) instead of dropping a fixed-size
    // table. The picker's callback creates the table at the chosen size, so
    // bail before the in-place empty-table replacement below.
    if (label === 'table') {
        showTablePicker(muya, block);
        return;
    }

    switch (label) {
        case 'paragraph':
            // fall through
        case 'thematic-break':
            // fall through
        case 'math-block':
            // fall through
        case 'html-block':
            // fall through
        case 'code-block':
            // fall through
        case 'block-quote': {
            const cloned = deepClone(emptyStates[label]);
            if (cloned.name === 'paragraph') {
                cloned.text = text;
            }
            else if (cloned.name === 'block-quote') {
                const inner = cloned.children[0];
                if (isParagraphState(inner))
                    inner.text = text;
            }
            state = cloned;
            newBlock = ScrollPage.loadBlock(label).create(muya, state);
            break;
        }

        case 'atx-heading 1':
            // fall through
        case 'atx-heading 2':
            // fall through
        case 'atx-heading 3':
            // fall through
        case 'atx-heading 4':
            // fall through
        case 'atx-heading 5':
            // fall through
        case 'atx-heading 6': {
            const headingState = deepClone(emptyStates['atx-heading']);

            const [blockName, level] = label.split(' ');
            headingState.meta.level = +level;
            headingState.text = `${'#'.repeat(+level)} ${text}`;
            state = headingState;
            newBlock = ScrollPage.loadBlock(blockName).create(muya, state);
            break;
        }

        case 'order-list': {
            const orderState = deepClone(emptyStates[label]);
            orderState.meta.loose = preferLooseListItem;
            orderState.meta.delimiter = orderListDelimiter;
            const firstChild = orderState.children[0].children[0];
            if (text && isParagraphState(firstChild))
                firstChild.text = text;

            state = orderState;
            newBlock = ScrollPage.loadBlock(label).create(muya, state);
            break;
        }

        case 'bullet-list':
            // fall through
        case 'task-list': {
            const listState = deepClone(emptyStates[label]);
            listState.meta.loose = preferLooseListItem;
            listState.meta.marker = bulletListMarker;
            const firstChild = listState.children[0].children[0];
            if (text && isParagraphState(firstChild))
                firstChild.text = text;

            state = listState;
            newBlock = ScrollPage.loadBlock(label).create(muya, state);
            break;
        }

        case 'diagram vega-lite':
            // fall through
        case 'diagram mermaid':
            // fall through
        case 'diagram plantuml':
            // fall through
        case 'diagram flowchart':
            // fall through
        case 'diagram sequence': {
            const diagramState = deepClone(emptyStates.diagram);

            const [name, type] = label.split(' ');
            if (
                type === 'mermaid'
                || type === 'plantuml'
                || type === 'vega-lite'
                || type === 'flowchart'
                || type === 'sequence'
            ) {
                diagramState.meta.type = type;
                diagramState.meta.lang = type === 'vega-lite' ? 'json' : 'yaml';
            }
            state = diagramState;
            newBlock = ScrollPage.loadBlock(name).create(muya, state);
            break;
        }

        default:
            debug.log('Unknown label in quick insert');
            break;
    }

    block.replaceWith(newBlock);
    if (label === 'thematic-break') {
        const nextParagraphBlock = ScrollPage.loadBlock('paragraph').create(
            muya,
            deepClone(emptyStates.paragraph),
        );
        newBlock.parent.insertAfter(nextParagraphBlock, newBlock);
        cursorBlock = nextParagraphBlock.firstContentInDescendant();
        cursorBlock.setCursor(0, 0, true);
    }
    else {
        cursorBlock = newBlock.firstContentInDescendant();
        // Set the cursor between <div>\n\n</div> when create html-block
        const offset = label === 'html-block' ? 6 : cursorBlock.text.length;
        cursorBlock.setCursor(offset, offset, true);
    }
}
