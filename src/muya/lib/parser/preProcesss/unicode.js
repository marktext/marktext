const meta = {
  id: 'unicode',
  type: 'preProcess',
  sort: 60,
  rules: {
    space: /\u00a0/g,
    return: /\u2424/g
  }
}

function process (src) {
  return src
    .replace(meta.rules.space, '')
    .replace(meta.rules.return, '\n')
}

export default { meta, process }
