const meta = {
  id: 'space',
  type: 'preProcess',
  sort: 50,
  rule: /^ +$/gm
}

function process (src) {
  return src
    .replace(meta.rule, '\n')
}

export default { meta, process }
