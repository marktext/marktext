import { getPreProcesss } from './preProcesss'
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

export function preProcess (src, preProcesss) {
  let result
  for (let preProcess of preProcesss.values()) {
    // console.log('preProcess..', preProcess)
    result = preProcess.process(src)
    // console.log('result...', result)
  }
  return result
}

export function blockProcesserFac (src, parent, stateRender, options, beginBlocks, notBeginBlocks, top, bq) {
  // console.log('src.. ', src)

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
    // console.log('beginBlocks process..', block)
    result = block.process(params)
    // console.log('result...', result)
    if (result.ok) break
  }
  while (params.src) {
    for (let block of notBeginBlocks.values()) {
      result = block.process(params)

      if (result.ok) {
        // console.log('block.. ', block.meta.id, result.ok)
        break
      }
    }
    // console.log('params.src..', params.src)
    if (result.ok) continue

    if (params.src) {
      // console.log('params.src..', params.src)
      break
      // throw new Error('Infinite loop on byte: ' + params.src.charCodeAt(0))
    }
  }
  // console.log('params.parent  . .', JSON.stringify(params.parent, null, 2))
  return params.parent
}

export default function blockProcesser (src, rootState, stateRender) {
  let opt = Object.assign({}, defaults)
  let preProcesss = getPreProcesss(opt, [])
  let beginBlocks = getBeginBlocks(opt, [])
  let notBeginBlocks = getNotBeginBlocks(opt, [])
  // console.log('src..', src)
  src = preProcess(src, preProcesss)

  return blockProcesserFac(src, rootState, stateRender, opt, beginBlocks, notBeginBlocks, true, false)
}
