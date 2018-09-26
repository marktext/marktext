const meta = {
  id: 'tab',
  type: 'preProcess',
  sort: 30,
  rule: /\t/g
}

function process (src) {
  return src
    .replace(meta.rule, '    ')
}

export default { meta, process }
