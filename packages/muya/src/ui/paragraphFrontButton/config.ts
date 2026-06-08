import type Parent from '../../block/base/parent';
import type AtxHeading from '../../block/commonMark/atxHeading';
import type SetextHeading from '../../block/commonMark/setextHeading';
import type DiagramBlock from '../../block/extra/diagram';
import bulletListIcon from '../../assets/icons/bullet_list/2.png';
import vegaIcon from '../../assets/icons/chart/2.png';
import codeIcon from '../../assets/icons/code/2.png';
import flowchartIcon from '../../assets/icons/flowchart/2.png';
import footnoteIcon from '../../assets/icons/footnote/2.png';
import frontMatterIcon from '../../assets/icons/front_matter/2.png';
import header1Icon from '../../assets/icons/heading_1/2.png';
import header2Icon from '../../assets/icons/heading_2/2.png';
import header3Icon from '../../assets/icons/heading_3/2.png';
import header4Icon from '../../assets/icons/heading_4/2.png';
import header5Icon from '../../assets/icons/heading_5/2.png';
import header6Icon from '../../assets/icons/heading_6/2.png';
import thematicBreakIcon from '../../assets/icons/horizontal_line/2.png';
import htmlIcon from '../../assets/icons/html/2.png';
import mathBlockIcon from '../../assets/icons/math/2.png';
import mermaidIcon from '../../assets/icons/mermaid/2.png';
import tableIcon from '../../assets/icons/new_table/2.png';
import orderListIcon from '../../assets/icons/order_list/2.png';
import paragraphIcon from '../../assets/icons/paragraph/2.png';
import plantumlIcon from '../../assets/icons/plantuml/2.png';
import quoteIcon from '../../assets/icons/quote_block/2.png';
import sequenceIcon from '../../assets/icons/sequence/2.png';
import taskListIcon from '../../assets/icons/todolist/2.png';

const HEADING_ICONS = [
    header1Icon,
    header2Icon,
    header3Icon,
    header4Icon,
    header5Icon,
    header6Icon,
];

const DIAGRAM_ICONS = {
    'plantuml': plantumlIcon,
    'mermaid': mermaidIcon,
    'vega-lite': vegaIcon,
    'flowchart': flowchartIcon,
    'sequence': sequenceIcon,
};

export function getIcon(block: Parent) {
    const { blockName } = block;
    switch (blockName) {
        case 'frontmatter':
            return frontMatterIcon;

        case 'paragraph':
            return paragraphIcon;

        case 'block-quote':
            return quoteIcon;

        case 'bullet-list':
            return bulletListIcon;

        case 'order-list':
            return orderListIcon;

        case 'task-list':
            return taskListIcon;

        case 'code-block':
            return codeIcon;

        case 'atx-heading':
            return HEADING_ICONS[(block as AtxHeading).meta.level - 1];

        case 'setext-heading':
            return HEADING_ICONS[(block as SetextHeading).meta.level - 1];

        case 'thematic-break':
            return thematicBreakIcon;

        case 'table':
            return tableIcon;

        case 'html-block':
            return htmlIcon;

        case 'math-block':
            return mathBlockIcon;

        case 'diagram':
            return DIAGRAM_ICONS[(block as DiagramBlock).meta.type];

        case 'footnote':
            return footnoteIcon;

        default:
            return paragraphIcon;
    }
}
