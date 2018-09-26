
import standardizer from './standardizer'
/* import escape from './escape' */
import space from './space'
import tab from './tab'
import unicode from './unicode'
import cleaner from './cleaner'

let preProcessArray = [standardizer, /* escape, */ space, tab, unicode, cleaner]
/**
 *
 *
 * @export
 * @param {*} options // config
 * @param {*} plugins // plugin from other path or node
 * @param {*} selectedPreProcessKeys // only selected preProcess ids are includes in preProcesss
 * @returns
 */
// TODO: we should do this when muya init
export function getPreProcesss (options, plugins = [], selectedPreProcessIds = []) {
  if (plugins && plugins.length) {
    preProcessArray.push(...plugins)
  }
  let filterPreProcesss = preProcessArray
  const selectedPreProcessIdsSet = new Set(selectedPreProcessIds)
  // console.log('selectedPreProcessIdsSet  ..', selectedPreProcessIdsSet)
  if (selectedPreProcessIdsSet && selectedPreProcessIdsSet.size) {
    filterPreProcesss = preProcessArray.filter(function (item) {
      //  console.log('item.meta.id  ..', item.meta.id)
      //  console.log('selectedPreProcessIdsSet.id  ..', selectedPreProcessIdsSet.has(item.meta.id))
      return selectedPreProcessIdsSet.has(item.meta.id)
    })
  }

  const preProcesss = new Map()
  const sortPreProcessArray = filterPreProcesss.sort((a, b) => { return a.meta.sort - b.meta.sort })
  sortPreProcessArray.map(preProcess => {
    preProcesss.set(preProcess.meta.id, preProcess)
  })
  // console.log('preProcesss  ..', preProcesss)
  return preProcesss
}
