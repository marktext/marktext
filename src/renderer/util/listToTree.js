class Node {
  constructor (item) {
    const { parent, lvl, content, slug } = item
    this.parent = parent
    this.lvl = lvl
    this.label = content
    this.slug = slug
    this.children = []
  }

  // Add child node.
  addChild (node) {
    this.children.push(node)
  }
}

const findParent = (item, lastNode, rootNode) => {
  if (!lastNode) {
    return rootNode
  }
  const { lvl: lastLvl } = lastNode
  const { lvl } = item

  if (lvl < lastLvl) {
    return findParent(item, lastNode.parent, rootNode)
  } else if (lvl === lastLvl) {
    return lastNode.parent
  } else {
    return lastNode
  }
}

const listToTree = list => {
  const rootNode = new Node({ parent: null, lvl: null, content: null, slug: null })
  let lastNode = null

  for (const item of list) {
    const parent = findParent(item, lastNode, rootNode)

    const node = new Node({ parent, ...item })
    parent.addChild(node)
    lastNode = node
  }

  return rootNode.children
}

export default listToTree
