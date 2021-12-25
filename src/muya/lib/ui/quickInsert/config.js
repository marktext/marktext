import paragraphIcon from '../../assets/pngicon/paragraph/2.png'
import htmlIcon from '../../assets/pngicon/html/2.png'
import hrIcon from '../../assets/pngicon/horizontal_line/2.png'
import frontMatterIcon from '../../assets/pngicon/front_matter/2.png'
import header1Icon from '../../assets/pngicon/heading_1/2.png'
import header2Icon from '../../assets/pngicon/heading_2/2.png'
import header3Icon from '../../assets/pngicon/heading_3/2.png'
import header4Icon from '../../assets/pngicon/heading_4/2.png'
import header5Icon from '../../assets/pngicon/heading_5/2.png'
import header6Icon from '../../assets/pngicon/heading_6/2.png'
import newTableIcon from '../../assets/pngicon/new_table/2.png'
import bulletListIcon from '../../assets/pngicon/bullet_list/2.png'
import codeIcon from '../../assets/pngicon/code/2.png'
import quoteIcon from '../../assets/pngicon/quote_block/2.png'
import todoListIcon from '../../assets/pngicon/todolist/2.png'
import mathblockIcon from '../../assets/pngicon/math/2.png'
import orderListIcon from '../../assets/pngicon/order_list/2.png'
import flowchartIcon from '../../assets/pngicon/flowchart/2.png'
import sequenceIcon from '../../assets/pngicon/sequence/2.png'
import mermaidIcon from '../../assets/pngicon/mermaid/2.png'
import vegaIcon from '../../assets/pngicon/chart/2.png'
import { isOsx } from '../../config'
import i18n from '../../i18n'

const COMMAND_KEY = isOsx ? '⌘' : 'Ctrl'
const OPTION_KEY = isOsx ? '⌥' : 'Alt'
const SHIFT_KEY = isOsx ? '⇧' : 'Shift'

// Command (or Cmd) ⌘
// Shift ⇧
// Option (or Alt) ⌥
// Control (or Ctrl) ⌃
// Caps Lock ⇪
// Fn

export const quickInsertObj = () => {
  return {
    'basic block': [{
      title: i18n.t('menu.paragraph._title_simple'),
      subTitle: 'Lorem Ipsum is simply dummy text',
      label: 'paragraph',
      shortCut: `${COMMAND_KEY}+0`,
      icon: paragraphIcon
    }, {
      title: i18n.t('menu.paragraph.horizontalLine'),
      subTitle: '---',
      label: 'hr',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+-`,
      icon: hrIcon
    }, {
      title: i18n.t('menu.paragraph.frontMatter'),
      subTitle: '--- Lorem Ipsum ---',
      label: 'front-matter',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+Y`,
      icon: frontMatterIcon
    }],
    header: [{
      title: i18n.t('menu.paragraph.heading1'),
      subTitle: '# Lorem Ipsum is simply ...',
      label: 'heading 1',
      shortCut: `${COMMAND_KEY}+1`,
      icon: header1Icon
    }, {
      title: i18n.t('menu.paragraph.heading2'),
      subTitle: '## Lorem Ipsum is simply ...',
      label: 'heading 2',
      shortCut: `${COMMAND_KEY}+2`,
      icon: header2Icon
    }, {
      title: i18n.t('menu.paragraph.heading3'),
      subTitle: '### Lorem Ipsum is simply ...',
      label: 'heading 3',
      shortCut: `${COMMAND_KEY}+3`,
      icon: header3Icon
    }, {
      title: i18n.t('menu.paragraph.heading4'),
      subTitle: '#### Lorem Ipsum is simply ...',
      label: 'heading 4',
      shortCut: `${COMMAND_KEY}+4`,
      icon: header4Icon
    }, {
      title: i18n.t('menu.paragraph.heading5'),
      subTitle: '##### Lorem Ipsum is simply ...',
      label: 'heading 5',
      shortCut: `${COMMAND_KEY}+5`,
      icon: header5Icon
    }, {
      title: i18n.t('menu.paragraph.heading6'),
      subTitle: '###### Lorem Ipsum is simply ...',
      label: 'heading 6',
      shortCut: `${COMMAND_KEY}+6`,
      icon: header6Icon
    }],
    'advanced block': [{
      title: i18n.t('menu.paragraph.table'),
      subTitle: '|Lorem | Ipsum is simply |',
      label: 'table',
      shortCut: `${SHIFT_KEY}+${COMMAND_KEY}+T`,
      icon: newTableIcon
    }, {
      title: i18n.t('menu.paragraph.mathBlock'),
      subTitle: '$$ Lorem Ipsum is simply $$',
      label: 'mathblock',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+M`,
      icon: mathblockIcon
    }, {
      title: i18n.t('menu.paragraph.htmlBlock'),
      subTitle: '<div> Lorem Ipsum is simply </div>',
      label: 'html',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+J`,
      icon: htmlIcon
    }, {
      title: i18n.t('menu.paragraph.codeFences'),
      subTitle: '```java Lorem Ipsum is simply ```',
      label: 'pre',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+C`,
      icon: codeIcon
    }, {
      title: i18n.t('menu.paragraph.blockquote'),
      subTitle: '>Lorem Ipsum is simply ...',
      label: 'blockquote',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+Q`,
      icon: quoteIcon
    }],
    'list block': [{
      title: i18n.t('menu.paragraph.orderList'),
      subTitle: '1. Lorem Ipsum is simply ...',
      label: 'ol-order',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+O`,
      icon: orderListIcon
    }, {
      title: i18n.t('menu.paragraph.bulletList'),
      subTitle: '- Lorem Ipsum is simply ...',
      label: 'ul-bullet',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+U`,
      icon: bulletListIcon
    }, {
      title: i18n.t('menu.paragraph.taskList'),
      subTitle: '- [x] Lorem Ipsum is simply ...',
      label: 'ul-task',
      shortCut: `${OPTION_KEY}+${COMMAND_KEY}+X`,
      icon: todoListIcon
    }],
    diagram: [{
      title: i18n.t('menu.paragraph.vega'),
      subTitle: i18n.t('menu.paragraph._descriptions.vega'),
      label: 'vega-lite',
      icon: vegaIcon
    }, {
      title: i18n.t('menu.paragraph.flowChart'),
      subTitle: i18n.t('menu.paragraph._descriptions.flowChart'),
      label: 'flowchart',
      icon: flowchartIcon
    }, {
      title: i18n.t('menu.paragraph.seqDiagram'),
      subTitle: i18n.t('menu.paragraph._descriptions.seqDiagram'),
      label: 'sequence',
      icon: sequenceIcon
    }, {
      title: i18n.t('menu.paragraph.mermaid'),
      subTitle: i18n.t('menu.paragraph._descriptions.mermaid'),
      label: 'mermaid',
      icon: mermaidIcon
    }]
  }
}
