import { h } from '../snabbdom'

const NEW_LINE_EXP = /\n(?!$)/g

const renderLineNumberRows = codeContent => {
  const { text } = codeContent
  const match = text.match(NEW_LINE_EXP)
  let linesNum = match ? match.length + 1 : 1
  if (text.endsWith('\n')) {
    linesNum++
  }
  const data = {
    attrs: {
      'aria-hidden': true
    }
  }
  const children = [...new Array(linesNum)].map(() => h('span'))

  return h('span.line-numbers-rows', data, children)
}

export default renderLineNumberRows
