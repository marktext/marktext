const meta = {
  id: 'standardizer',
  type: 'preProcess',
  sort: 20,
  rule: /\r\n|\r/g
}

function process (src) {
  return src
    .replace(meta.rule, '    ')
}

export default { meta, process }
