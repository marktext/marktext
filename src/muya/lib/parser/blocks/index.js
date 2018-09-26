
import hr from './hr'
import newLine from './newLine'
import text from './text'
import frontMatter from './frontMatter'
import gfmHeading from './gfmHeading'
import heading from './heading'
import lHeading from './lHeading'
import paragraph from './paragraph'
import blockQuote from './blockQuote'
import code from './code'
import gfmFences from './gfmFences'
import gfmParagraph from './gfmParagraph'
import npTable from './npTable'
import table from './table'
import html from './html'
import multipleMath from './multipleMath'
import list from './list'
import def from './def'

let blockArray = [def, list, html, multipleMath, code, gfmFences, hr, newLine, blockQuote, text,
  frontMatter, heading, lHeading]
/**
 *
 *
 * @export
 * @param {*} options // config
 * @param {*} plugins // plugin from other path or node
 * @param {*} selectedBlockKeys // only selected block ids are includes in blocks
 * @returns
 */
// TODO: we shoult get blocks when muya init
export function getBlocks (options, plugins = [], selectedBlockIds = []) {
  if (plugins && plugins.length) {
    blockArray.push(...plugins)
  }

  if (options.gfm) {
    blockArray.push(gfmFences)
    blockArray.push(gfmParagraph)
    blockArray.push(gfmHeading)
  } else {
    blockArray.push(paragraph)
    blockArray.push(heading)
  }

  if (options.tables) {
    blockArray.push(npTable)
    blockArray.push(table)
  }
  // console.log('blockArray  ..', blockArray)
  // console.log('selectedBlockIds  ..', selectedBlockIds)
  let filterBlocks = blockArray
  const selectedBlockIdsSet = new Set(selectedBlockIds)
  // console.log('selectedBlockIdsSet  ..', selectedBlockIdsSet)
  if (selectedBlockIdsSet && selectedBlockIdsSet.size) {
    filterBlocks = blockArray.filter(function (item) {
      //  console.log('item.meta.id  ..', item.meta.id)
      //  console.log('selectedBlockIdsSet.id  ..', selectedBlockIdsSet.has(item.meta.id))
      return selectedBlockIdsSet.has(item.meta.id)
    })
  }

  const blocks = new Map()
  const sortblockArray = filterBlocks.sort((a, b) => { return a.meta.sort - b.meta.sort })
  sortblockArray.map(block => {
    blocks.set(block.meta.id, block)
  })
  return blocks
}
/**
 *
 *
 * @export
 * @param {*} options
 * @param {*} plugins // plugin from other path or node
 * @returns
 */
export function getBeginBlocks (options, plugins, selectedBlockIds) {
  const blocks = getBlocks(options, plugins, selectedBlockIds)
  // console.log('blocks  ..', blocks)
  const beginBlocks = new Map([...blocks].filter(([k, v]) => v.meta.begin === true))
  // console.log('beginBlocks  ..', beginBlocks)
  return beginBlocks
}
/**
 *
 *
 * @export
 * @param {*} options
 * @param {*} plugins // plugin from other path or node
 * @returns
 */
export function getNotBeginBlocks (options, plugins, selectedBlockIds) {
  const blocks = getBlocks(options, plugins, selectedBlockIds)
  const notBeginBlocks = new Map([...blocks].filter(([k, v]) => v.meta.begin !== true))
  // console.log('notBeginBlocks..', notBeginBlocks)
  return notBeginBlocks
}
