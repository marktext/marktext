const listToTree = list => {
  const result = []
  let parent = null
  let child = null
  let tempLvl = 7 // any number great than 6

  for (const { lvl, content, slug } of list) {
    const item = {
      lvl, label: content, slug, children: []
    }
    if (lvl < tempLvl) {
      tempLvl = lvl
      result.push(item)
      parent = { children: result }
      child = item
    } else if (lvl === tempLvl) {
      parent.children.push(item)
      child = item
    } else if (lvl > tempLvl) {
      tempLvl = lvl
      child.children.push(item)
      parent = child
      child = item
    }
  }

  return result
}

export default listToTree
