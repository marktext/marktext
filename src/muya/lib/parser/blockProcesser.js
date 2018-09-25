import { getBeginBlocks, getNotBeginBlocks } from './blocks'

const defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  sanitizer: null,
  mangle: true,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  xhtml: false,
  disableInline: false
}

export function blockProcesserFac (src, parent, stateRender, options, beginBlocks, notBeginBlocks, top, bq) {
  console.log('src.. ', src)
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n')
    .replace(/^ +$/gm, '')

  let params = {
    options: options,
    beginBlocks: beginBlocks,
    notBeginBlocks: notBeginBlocks,
    parent: parent,
    stateRender: stateRender,
    src: src,
    top: top,
    bq: bq
  }
  let result
  // console.log('t params...', JSON.stringify(params.src, null, 2))
  for (let block of beginBlocks.values()) {
    // console.log('notBeginBlocks..', block)
    result = block.process(params)
    // console.log('result...', result)
    if (result.ok) break
  }
  while (params.src) {
    for (let block of notBeginBlocks.values()) {
      result = block.process(params)
      if (result.ok) {
        break
      }
    }
    if (result.ok) continue

    if (params.src) {
      throw new Error('Infinite loop on byte: ' + params.src.charCodeAt(0))
    }
  }
  // console.log('params.parent  . .', JSON.stringify(params.parent, null, 2))
  return params.parent
}

export default function blockProcesser (src, rootState, stateRender) {
  let opt = Object.assign({}, defaults)
  return blockProcesserFac(src, rootState, stateRender, opt, getBeginBlocks(opt), getNotBeginBlocks(opt), true, false)
}
