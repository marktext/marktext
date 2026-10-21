import type { Muya } from '../muya';
import type { IFrontmatterMeta } from '../state/types';
import type Parent from './base/parent';
import emptyStates from '../config/emptyStates';
import { getCursorReference } from '../selection';
import { isParagraphState } from '../state/types';
import { deepClone } from '../utils';
import logger from '../utils/logger';
import { canConvertGithubAlert, convertGithubAlert } from './githubAlerts';
import { ScrollPage } from './scrollPage';

const debug = logger('quickInsert:');

// Frontmatter language and style must agree so the serializer emits the chosen delimiters.
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

// Front matter is valid only at document start. No-op when it is already present.
export function insertFrontMatterAtStart(muya: Muya): boolean {
    const { scrollPage } = muya.editor;
    if (!scrollPage)
        return false;

    const firstBlock = scrollPage.firstChild as Parent | null;
    if (firstBlock?.blockName === 'frontmatter')
        return false;

    const fmState = deepClone(emptyStates.frontmatter);
    Object.assign(fmState.meta, frontmatterMeta(muya.options.frontmatterType));

    const frontmatter = ScrollPage.loadBlock('frontmatter').create(muya, fmState);
    scrollPage.insertBefore(frontmatter, firstBlock);
    frontmatter.firstContentInDescendant()?.setCursor(0, 0, true);

    return true;
}

// Open the dimension picker at the caret, falling back to the target block.
// Its callback supplies zero-based row/column indices; ignore unavailable or detached targets.
export function showTablePicker(muya: Muya, block: Parent) {
    const { eventCenter } = muya;
    const reference = getCursorReference() ?? block.domNode;
    if (!reference || !block.outMostBlock)
        return;

    // The `/` query the grid was opened on, or '' for the front-menu's empty
    // paragraph.
    const triggerText = block.firstContentInDescendant()?.text ?? '';

    const handler = (row: number, column: number) => {
        // Ignore picks if typing or undo changed or detached the original trigger (#5355).
        const text = block.firstContentInDescendant()?.text ?? '';
        if (!block.outMostBlock || (text !== triggerText && text.trim() !== ''))
            return;

        // Replace the disposable /table or empty trigger paragraph.
        muya.createTable({ rows: row + 1, columns: column + 1 }, { replace: true, block });
    };

    eventCenter.emit('muya-table-picker', { row: -1, column: -1 }, reference, handler);
}

type TLeafReplacementLabel
    = | 'paragraph'
        | 'thematic-break'
        | 'math-block'
        | 'html-block'
        | 'code-block'
        | 'block-quote';

function buildLeafBlock(label: TLeafReplacementLabel, muya: Muya, text: string) {
    const cloned = deepClone(emptyStates[label]);
    if (cloned.name === 'paragraph') {
        cloned.text = text;
    }
    else if (cloned.name === 'block-quote') {
        const inner = cloned.children[0];
        if (isParagraphState(inner))
            inner.text = text;
    }

    return ScrollPage.loadBlock(label).create(muya, cloned);
}

function buildHeadingBlock(label: string, muya: Muya, text: string) {
    const headingState = deepClone(emptyStates['atx-heading']);

    const [blockName, level] = label.split(' ');
    headingState.meta.level = +level;
    // An ATX heading is a single line; a newline left in its text is dropped
    // with everything after it when the document is saved (#5366).
    headingState.text = `${'#'.repeat(+level)} ${text.replace(/\n/g, ' ')}`;

    return ScrollPage.loadBlock(blockName).create(muya, headingState);
}

function buildOrderListBlock(muya: Muya, text: string) {
    const { preferLooseListItem, orderListDelimiter } = muya.options;
    const orderState = deepClone(emptyStates['order-list']);
    orderState.meta.loose = preferLooseListItem;
    orderState.meta.delimiter = orderListDelimiter;
    const firstChild = orderState.children[0].children[0];
    if (text && isParagraphState(firstChild))
        firstChild.text = text;

    return ScrollPage.loadBlock('order-list').create(muya, orderState);
}

function buildListBlock(label: 'bullet-list' | 'task-list', muya: Muya, text: string) {
    const { preferLooseListItem, bulletListMarker } = muya.options;
    const listState = deepClone(emptyStates[label]);
    listState.meta.loose = preferLooseListItem;
    if ('marker' in listState.meta)
        listState.meta.marker = bulletListMarker;
    const firstChild = listState.children[0].children[0];
    if (text && isParagraphState(firstChild))
        firstChild.text = text;

    return ScrollPage.loadBlock(label).create(muya, listState);
}

function buildDiagramBlock(label: string, muya: Muya) {
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

    return ScrollPage.loadBlock(name).create(muya, diagramState);
}

// Menus and insertion paths must reject math blocks when their serialized $$ syntax is disabled (#5446).
export function canInsertLabel(label: string, muya: Muya): boolean {
    if (label.startsWith('github-alert '))
        return muya.options.githubAlerts;
    return label !== 'math-block' || muya.options.texMathDollars;
}

export function buildReplacementBlock(label: string, muya: Muya, text: string) {
    if (!canInsertLabel(label, muya))
        return null;

    if (label.startsWith('atx-heading '))
        return buildHeadingBlock(label, muya, text);
    if (label.startsWith('diagram '))
        return buildDiagramBlock(label, muya);

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
        case 'block-quote':
            return buildLeafBlock(label, muya, text);

        case 'order-list':
            return buildOrderListBlock(muya, text);

        case 'bullet-list':
            // fall through
        case 'task-list':
            return buildListBlock(label, muya, text);

        default:
            debug.log('Unknown label in quick insert');
            return null;
    }
}

export function replaceBlockByLabel({ block, muya, label, text = '' }: {
    block: Parent;
    muya: Muya;
    label: string;
    text?: string;
}) {
    if (label.startsWith('github-alert ') || (['block-quote', 'github-alert'].includes(block.blockName) && muya.options.githubAlerts && (label === 'paragraph' || label === 'block-quote'))) {
        convertGithubAlert(block, label, text);
        return;
    }

    // Front matter must be prepended, never substituted for a block in the document body.
    if (label === 'frontmatter') {
        // Prepending leaves the / query behind; clear it only when front matter was actually inserted.
        if (insertFrontMatterAtStart(muya)) {
            const triggerContent = block.firstContentInDescendant();
            if (triggerContent) {
                triggerContent.text = '';
                triggerContent.update();
            }
        }
        return;
    }

    if (label === 'table') {
        showTablePicker(muya, block);
        return;
    }

    const newBlock = buildReplacementBlock(label, muya, text);
    if (!newBlock)
        return;

    block.replaceWith(newBlock);
    finishInsertedBlock(newBlock, muya, label);
}

// A thematic break needs a trailing paragraph so the user can continue typing.
function finishInsertedBlock(newBlock: Parent, muya: Muya, label: string) {
    if (label === 'thematic-break') {
        const nextParagraphBlock = ScrollPage.loadBlock('paragraph').create(
            muya,
            deepClone(emptyStates.paragraph),
        );
        newBlock.parent!.insertAfter(nextParagraphBlock, newBlock);
        nextParagraphBlock.firstContentInDescendant()?.setCursor(0, 0, true);
        return;
    }

    placeCaretInNewBlock(newBlock, label);
}

// HTML-block carets start between the opening and closing tags.
function placeCaretInNewBlock(newBlock: Parent, label: string) {
    const cursorBlock = newBlock.firstContentInDescendant();
    if (!cursorBlock)
        return;

    const offset = label === 'html-block' ? 6 : cursorBlock.text.length;
    cursorBlock.setCursor(offset, offset, true);
}

export function insertBlockBelowByLabel({ block, muya, label }: {
    block: Parent;
    muya: Muya;
    label: string;
}) {
    const newBlock = buildReplacementBlock(label, muya, '');
    if (!newBlock)
        return;
    block.parent!.insertAfter(newBlock, block);
    finishInsertedBlock(newBlock, muya, label);
}

// Whether `block` can be turned into `label` in place (the front-menu's
// turn-into set). The label-matching regexes are the single source of truth and
// must stay in sync with `MENU_CONFIG`'s labels and `PARAGRAPH_LABEL_MAP`.
export function canTurnInto(block: Parent, label: string): boolean {
    const { blockName } = block;
    if (label.startsWith('github-alert ') || (['block-quote', 'github-alert'].includes(blockName) && block.muya.options.githubAlerts))
        return canConvertGithubAlert(block, label);

    if (!canInsertLabel(label, block.muya))
        return false;

    switch (blockName) {
        case 'paragraph': {
            const paragraphIsEmpty = /^\s*$/.test(block.firstContentInDescendant()!.text);
            if (paragraphIsEmpty)
                return label !== 'frontmatter';

            return /paragraph|atx-heading|block-quote|order-list|bullet-list|task-list/.test(label);
        }

        case 'atx-heading':
            return /atx-heading|paragraph/.test(label);

        case 'order-list':
            // fall through
        case 'bullet-list':
            // fall through
        case 'task-list':
            return /order-list|bullet-list|task-list/.test(label);

        default:
            return false;
    }
}
