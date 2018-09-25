export default function blockTokenizer (src, options, beginBlocks, notBeginBlocks, top, bq) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n')
    .replace(/^ +$/gm, '')

  let params = {
    options: options,
    beginBlocks: beginBlocks,
    notBeginBlocks: notBeginBlocks,
    tokens: [],
    src: src,
    top: top,
    bq: bq
  }
  params.tokens.links = {}
  let result
  // console.log('t params...', JSON.stringify(params.src, null, 2))
  for (let block of beginBlocks.values()) {
    // console.log('notBeginBlocks..', block)
    result = block.parse(params)
    // console.log('result...', result)
    if (result.ok) break
  }
  while (params.src) {
    // console.log('t params...', JSON.stringify(params.src, null, 2))
    for (let block of notBeginBlocks.values()) {
      // console.log('notBeginBlocks..', block)
      result = block.parse(params)
      // console.log('result...', result)
      if (result.ok) break
    }
    if (result.ok) continue

    if (params.src) {
      throw new Error('Infinite loop on byte: ' + params.src.charCodeAt(0))
    }
  }
  console.log('params.tokens. .', JSON.stringify(params.tokens, null, 2))
  return params.tokens
}
