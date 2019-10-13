/**
 * [renderBlock render one block, no matter it is a container block or text block]
 */
export default function renderBlock (parent, block, activeBlocks, matches, useCache = false) {
  const method = Array.isArray(block.children) && block.children.length > 0
    ? 'renderContainerBlock'
    : 'renderLeafBlock'

  return this[method](parent, block, activeBlocks, matches, useCache)
}
