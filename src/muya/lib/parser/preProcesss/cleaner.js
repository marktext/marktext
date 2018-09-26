const meta = {
  id: 'cleaner',
  type: 'preProcess',
  sort: 40,
  rule: /^\n+|\n+$/
}

function process (src) {
  return src
    .replace(meta.rule, '\n')
}

export default { meta, process }
