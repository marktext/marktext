import Frontmatter from './/extra/frontmatter';
import AtxHeading from './commonMark/atxHeading';
// container block
import BlockQuote from './commonMark/blockQuote';
import BulletList from './commonMark/bulletList';
import CodeBlock from './commonMark/codeBlock';
import Code from './commonMark/codeBlock/code';
import HeadingCopyLink from './commonMark/headingCopyLink';
import HTMLBlock from './commonMark/html';
import HTMLContainer from './commonMark/html/htmlContainer';
import HTMLPreview from './commonMark/html/htmlPreview';
import ListItem from './commonMark/listItem';
import OrderList from './commonMark/orderList';
// leaf block
import Paragraph from './commonMark/paragraph';
import SetextHeading from './commonMark/setextHeading';
import ThematicBreak from './commonMark/thematicBreak';
import AtxHeadingContent from './content/atxHeadingContent';
import CodeBlockContent from './content/codeBlockContent';
import LangInputContent from './content/langInputContent';
// content
import ParagraphContent from './content/paragraphContent';
import SetextHeadingContent from './content/setextHeadingContent';
import TableCellContent from './content/tableCell';
import ThematicBreakContent from './content/thematicBreakContent';
import DiagramBlock from './extra/diagram';
import DiagramContainer from './extra/diagram/diagramContainer';
import DiagramPreview from './extra/diagram/diagramPreview';
import Footnote from './extra/footnote';
import MathBlock from './extra/math';
import MathContainer from './extra/math/mathContainer';
import MathPreview from './extra/math/mathPreview';
import Table from './gfm/table';
import Cell from './gfm/table/cell';
import TableRow from './gfm/table/row';
import TableInner from './gfm/table/table';
import TaskList from './gfm/taskList';
// Attachment Block
import TaskListCheckbox from './gfm/taskListCheckbox';
import TaskListItem from './gfm/taskListItem';
import { ScrollPage } from './scrollPage';

export function registerBlocks() {
    // Register itself
    ScrollPage.register(ScrollPage);
    ScrollPage.register(Paragraph);
    ScrollPage.register(ParagraphContent);
    ScrollPage.register(AtxHeading);
    ScrollPage.register(AtxHeadingContent);
    ScrollPage.register(SetextHeading);
    ScrollPage.register(SetextHeadingContent);
    ScrollPage.register(HeadingCopyLink);
    ScrollPage.register(BlockQuote);
    ScrollPage.register(ThematicBreak);
    ScrollPage.register(ThematicBreakContent);
    ScrollPage.register(CodeBlock);
    ScrollPage.register(Code);
    ScrollPage.register(LangInputContent);
    ScrollPage.register(CodeBlockContent);
    ScrollPage.register(OrderList);
    ScrollPage.register(ListItem);
    ScrollPage.register(BulletList);
    ScrollPage.register(TaskList);
    ScrollPage.register(TaskListItem);
    ScrollPage.register(TaskListCheckbox);
    // Table
    ScrollPage.register(Table);
    ScrollPage.register(TableInner);
    ScrollPage.register(TableRow);
    ScrollPage.register(Cell);
    ScrollPage.register(TableCellContent);
    // HTML
    ScrollPage.register(HTMLBlock);
    ScrollPage.register(HTMLPreview);
    ScrollPage.register(HTMLContainer);
    // Math
    ScrollPage.register(MathBlock);
    ScrollPage.register(MathPreview);
    ScrollPage.register(MathContainer);
    // FrontMatter
    ScrollPage.register(Frontmatter);
    // Diagram
    ScrollPage.register(DiagramBlock);
    ScrollPage.register(DiagramContainer);
    ScrollPage.register(DiagramPreview);
    // Footnote
    ScrollPage.register(Footnote);
}
