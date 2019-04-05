import paragraphIcon from '../../assets/icons/paragraph.svg'
import htmlIcon from '../../assets/icons/html.svg'
import hrIcon from '../../assets/icons/horizontal_line.svg'
import frontMatterIcon from '../../assets/icons/front_matter.svg'
import header1Icon from '../../assets/icons/header_1.svg'
import header2Icon from '../../assets/icons/header_2.svg'
import header3Icon from '../../assets/icons/header_3.svg'
import header4Icon from '../../assets/icons/header_4.svg'
import header5Icon from '../../assets/icons/header_5.svg'
import header6Icon from '../../assets/icons/header_6.svg'
import newTableIcon from '../../assets/icons/new_table.svg'
import bulletListIcon from '../../assets/icons/bullet_list.svg'
import codeIcon from '../../assets/icons/code.svg'
import quoteIcon from '../../assets/icons/quote.svg'
import todoListIcon from '../../assets/icons/todolist.svg'
import mathblockIcon from '../../assets/icons/math.svg'
import orderListIcon from '../../assets/icons/order_list.svg'
// import flowchartIcon from '../../assets/icons/flowchart.svg'
// import sequenceIcon from '../../assets/icons/sequence.svg'
// import mermaidIcon from '../../assets/icons/mermaid.svg'
// import vegaIcon from '../../assets/icons/chart.svg'
import { isOsx } from '../../config'

const COMMAND_KEY = isOsx ? '⌘' : '⌃'

// Command (or Cmd) ⌘
// Shift ⇧
// Option (or Alt) ⌥
// Control (or Ctrl) ⌃
// Caps Lock ⇪
// Fn


// Command (or Cmd) ⌘
// Shift ⇧
// Option (or Alt) ⌥
// Control (or Ctrl) ⌃
// Caps Lock ⇪
// Fn


export const quicInsertObj = {
  // 'diagram': [{
  //   title: 'Vega Chart',
  //   subTitle: 'Render flow chart by vega-lite.js.',
  //   label: 'vega-lite',
  //   icon: vegaIcon
  // }, {
  //   title: 'Flow Chart',
  //   subTitle: 'Render flow chart by flowchart.js.',
  //   label: 'flowchart',
  //   icon: flowchartIcon
  // }, {
  //   title: 'Sequence Diagram',
  //   subTitle: 'Render sequence diagram by js-sequence.',
  //   label: 'sequence',
  //   icon: sequenceIcon
  // }, {
  //   title: 'Mermaid',
  //   subTitle: 'Render Diagram by mermaid.',
  //   label: 'mermaid',
  //   icon: mermaidIcon
  // }],
  'basic block': [{
    title: 'Paragraph',
    subTitle: 'Lorem Ipsum is simply dummy text',
    label: 'paragraph',
    shortCut: `${COMMAND_KEY}0`,
    icon: paragraphIcon
  }, {
    title: 'Horizontal Line',
    subTitle: '---',
    label: 'hr',
    shortCut: `⌥${COMMAND_KEY}-`,
    icon: hrIcon
  }, {
    title: 'Front Matter',
    subTitle: '--- Lorem Ipsum ---',
    label: 'front-matter',
    shortCut: `⌥${COMMAND_KEY}Y`,
    icon: frontMatterIcon
  }],
  'header': [{
    title: 'Header 1',
    subTitle: '# Lorem Ipsum is simply ...',
    label: 'heading 1',
    shortCut: `${COMMAND_KEY}1`,
    icon: header1Icon
  }, {
    title: 'Header 2',
    subTitle: '## Lorem Ipsum is simply ...',
    label: 'heading 2',
    shortCut: `${COMMAND_KEY}2`,
    icon: header2Icon
  }, {
    title: 'Header 3',
    subTitle: '### Lorem Ipsum is simply ...',
    label: 'heading 3',
    shortCut: `${COMMAND_KEY}3`,
    icon: header3Icon
  }, {
    title: 'Header 4',
    subTitle: '#### Lorem Ipsum is simply ...',
    label: 'heading 4',
    shortCut: `${COMMAND_KEY}4`,
    icon: header4Icon
  }, {
    title: 'Header 5',
    subTitle: '##### Lorem Ipsum is simply ...',
    label: 'heading 5',
    shortCut: `${COMMAND_KEY}5`,
    icon: header5Icon
  }, {
    title: 'Header 6',
    subTitle: '###### Lorem Ipsum is simply ...',
    label: 'heading 6',
    shortCut: `${COMMAND_KEY}6`,
    icon: header6Icon
  }],
  'advanced block': [{
    title: 'Table Block',
    subTitle: '|Lorem | Ipsum is simply |',
    label: 'table',
    shortCut: `${COMMAND_KEY}T`,
    icon: newTableIcon
  }, {
    title: 'Math Formula',
    subTitle: '$$ Lorem Ipsum is simply $$',
    label: 'mathblock',
    shortCut: `⌥${COMMAND_KEY}M`,
    icon: mathblockIcon
  }, {
    title: 'HTML Block',
    subTitle: '<div> Lorem Ipsum is simply </div>',
    label: 'html',
    shortCut: `⌥${COMMAND_KEY}J`,
    icon: htmlIcon
  }, {
    title: 'Code Block',
    subTitle: '```java Lorem Ipsum is simply ```',
    label: 'pre',
    shortCut: `⌥${COMMAND_KEY}C`,
    icon: codeIcon
  }, {
    title: 'Quote Block',
    subTitle: '>Lorem Ipsum is simply ...',
    label: 'blockquote',
    shortCut: `⌥${COMMAND_KEY}Q`,
    icon: quoteIcon
  }],
  'list block': [{
    title: 'Order List',
    subTitle: '1. Lorem Ipsum is simply ...',
    label: 'ol-order',
    shortCut: `⌥${COMMAND_KEY}O`,
    icon: orderListIcon
  }, {
    title: 'Bullet List',
    subTitle: '- Lorem Ipsum is simply ...',
    label: 'ul-bullet',
    shortCut: `⌥${COMMAND_KEY}U`,
    icon: bulletListIcon
  }, {
    title: 'To-do List',
    subTitle: '- [x] Lorem Ipsum is simply ...',
    label: 'ul-task',
    shortCut: `⌥${COMMAND_KEY}X`,
    icon: todoListIcon
  }]
}
