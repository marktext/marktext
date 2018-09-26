import backlashInToken from './backlashInToken'
import backlash from './backlash'
import header from './header'
import link from './link'
import htmlTag from './htmlTag'
import hr from './hr'
import tailHeader from './tailHeader'
import hardLineBreak from './hardLineBreak'
import codeFense from './codeFense'
import displayMath from './displayMath'
import inlineMath from './inlineMath'
import aLink from './aLink'
import autoLink from './autoLink'
import htmlImage from './htmlImage'
import image from './image'
import emoji from './emoji'
import inlineCode from './inlineCode'
import text from './text'
import del from './del'
import em from './em'
import strong from './strong'
import htmlEscape from './htmlEscape'
import multipleMath from './multipleMath'
import referenceDefinition from './referenceDefinition'
import referenceLink from './referenceLink'
import referenceImage from './referenceImage'

let inlineArray = [hr, codeFense, header, displayMath, multipleMath, referenceDefinition, backlash, strong, em, inlineCode, image, link, emoji, referenceLink, referenceImage, inlineMath, tailHeader, aLink, htmlImage, htmlTag, htmlEscape, backlashInToken, text]

/**
 * @param {*} options // config
 * @param {*} plugins // plugin from other path or node
 * @param {*} selectedInlineIds // only selected inline ids are includes in inlines
 * @returns
 */
function getInlines (options, plugins, selectedInlineIds) {
  if (plugins && plugins.length) {
    inlineArray.push(...plugins)
  }
  /* if (options.gfm) { */
  inlineArray.push(...[autoLink, del])
  /* }

  if (options.breaks) {
    inlineArray.push(breaksHardLineBreak)
  } else { */
  inlineArray.push(...[hardLineBreak])
  /*  } */

  let filterInlines = inlineArray
  const selectedInlineSetIds = new Set(selectedInlineIds)
  if (selectedInlineSetIds && selectedInlineSetIds.size) {
    filterInlines = inlineArray.filter(function (item) {
      return selectedInlineSetIds.has(item.meta.id)
    })
  }

  const inlines = new Map()
  const sortInlineArray = filterInlines.sort((a, b) => { return a.meta.sort - b.meta.sort })
  sortInlineArray.map(inline => {
    inlines.set(inline.meta.id, inline)
  })
  return inlines
}

function getBeginInlines (options, plugins, selectedInlineIds) {
  const inlines = getInlines(options, plugins, selectedInlineIds)
  const beginInlines = new Map([...inlines].filter(([k, v]) => v.meta.begin === true && !v.meta.token))
  // console.log('beginInlines. .', beginInlines)
  return beginInlines
}
function getNotBeginInlines (options, plugins, selectedInlineIds) {
  const inlines = getInlines(options, plugins, selectedInlineIds)
  const notBeginInlines = new Map([...inlines].filter(([k, v]) => v.meta.begin !== true && !v.meta.token))
  // console.log('notBeginInlines..', notBeginInlines)
  return notBeginInlines
}

function getValidateInlines (options, plugins, selectedInlineIds) {
  const inlines = getInlines(options, plugins, selectedInlineIds)
  const validateInlines = new Map([...inlines].filter(([k, v]) => v.meta.validate !== false))
  // console.log('validateInlines..', validateInlines)
  return validateInlines
}
export function getNestInlines (options, plugins, selectedInlineIds) {
  const inlines = getInlines(options, plugins, selectedInlineIds)
  const nestInlines = new Map([...inlines].filter(([k, v]) => v.meta.nest === true))
  // console.log('nestInlines..', nestInlines)
  return nestInlines
}
// TODO: we shoult init plugins when muya init
export const inlines = getInlines()
export const beginInlines = getBeginInlines()
export const nestInlines = getNestInlines()
export const validateInlines = getValidateInlines()
export const notBeginInlines = getNotBeginInlines()
