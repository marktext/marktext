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
import tableIcon from '../../assets/icons/table.svg'
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

export const quicInsertObj = {
  // 'diagram': [{
  //   title: 'Vega Chart',
  //   subTitle: 'Render flow chart by vega-lite.js.',
  //   label: 'vega-lite',
  //   icon: vegaIcon,
  //   color: 'rgb(224, 54, 54)'
  // }, {
  //   title: 'Flow Chart',
  //   subTitle: 'Render flow chart by flowchart.js.',
  //   label: 'flowchart',
  //   icon: flowchartIcon,
  //   color: 'rgb(224, 54, 54)'
  // }, {
  //   title: 'Sequence Diagram',
  //   subTitle: 'Render sequence diagram by js-sequence.',
  //   label: 'sequence',
  //   icon: sequenceIcon,
  //   color: 'rgb(224, 54, 54)'
  // }, {
  //   title: 'Mermaid',
  //   subTitle: 'Render Diagram by mermaid.',
  //   label: 'mermaid',
  //   icon: mermaidIcon,
  //   color: 'rgb(224, 54, 54)'
  // }],
  'basic block': [{
    title: 'Text',
    subTitle: 'Just start write plain text.',
    label: 'paragraph',
    icon: paragraphIcon,
    color: 'rgb(224, 54, 54)'
  }, {
    title: 'Horizontal Line',
    subTitle: 'A horizontal line inserted.',
    label: 'hr',
    icon: hrIcon,
    color: 'rgb(255, 83, 77)'
  }, {
    title: 'Front Matter',
    subTitle: 'Just like Front Matter in hexo.io.',
    label: 'front-matter',
    icon: frontMatterIcon,
    color: 'rgb(37, 198, 252)'
  }],
  'header': [{
    title: 'Header 1',
    subTitle: 'Header rendered by h1.',
    label: 'heading 1',
    icon: header1Icon,
    color: 'rgb(86, 163, 108)'
  }, {
    title: 'Header 2',
    subTitle: 'Header rendered by h2.',
    label: 'heading 2',
    icon: header2Icon,
    color: 'rgb(94, 133, 121)'
  }, {
    title: 'Header 3',
    subTitle: 'Header rendered by h3.',
    label: 'heading 3',
    icon: header3Icon,
    color: 'rgb(119, 195, 79)'
  }, {
    title: 'Header 4',
    subTitle: 'Header rendered by  h4.',
    label: 'heading 4',
    icon: header4Icon,
    color: 'rgb(46, 104, 170)'
  }, {
    title: 'Header 5',
    subTitle: 'Header rendered by h5.',
    label: 'heading 5',
    icon: header5Icon,
    color: 'rgb(126, 136, 79)'
  }, {
    title: 'Header 6',
    subTitle: 'Header rendered by h6.',
    label: 'heading 6',
    icon: header6Icon,
    color: 'rgb(29, 176, 184)'
  }],
  'advanced block': [{
    title: 'Table Block',
    subTitle: 'Create a table in your page.',
    label: 'table',
    icon: tableIcon,
    color: 'rgb(13, 23, 64)'
  }, {
    title: 'Mathematical Formula',
    subTitle: 'Formula are rendered by Katex.',
    label: 'mathblock',
    icon: mathblockIcon,
    color: 'rgb(252, 214, 146)'
  }, {
    title: 'HTML Block',
    subTitle: 'Insert block HTML into text.',
    label: 'html',
    icon: htmlIcon,
    color: 'rgb(13, 23, 64)'
  }, {
    title: 'Code Block',
    subTitle: 'Insert Code block into article.',
    label: 'pre',
    icon: codeIcon,
    color: 'rgb(164, 159, 147)'
  }, {
    title: 'Quote Block',
    subTitle: 'Capture a quote.',
    label: 'blockquote',
    icon: quoteIcon,
    color: 'rgb(31, 111, 181)'
  }],
  'list block': [{
    title: 'Order List',
    subTitle: 'Just numbered list.',
    label: 'ol-order',
    icon: orderListIcon,
    color: 'rgb(242, 159, 63)'
  }, {
    title: 'Bullet List',
    subTitle: 'Simple bullet list.',
    label: 'ul-bullet',
    icon: bulletListIcon,
    color: 'rgb(242, 117, 63)'
  }, {
    title: 'To-do List',
    subTitle: 'Track tasks with to-do list.',
    label: 'ul-task',
    icon: todoListIcon,
    color: 'rgb(222, 140, 124)'
  }]
}
