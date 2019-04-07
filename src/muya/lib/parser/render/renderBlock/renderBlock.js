/**
 * [renderBlock render one block, no matter it is a container block or text block]
 */
export default function renderBlock (block, cursor, activeBlocks, selectedBlock, matches, useCache = false) {
  const method = block.children.length > 0
    ? 'renderContainerBlock'
    : 'renderLeafBlock'

  return this[method](block, cursor, activeBlocks, selectedBlock, matches, useCache)
}
