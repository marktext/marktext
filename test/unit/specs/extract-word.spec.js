import { extractWord } from '../../../src/muya/lib/marktext/spellchecker.js'

const basicCheck = 'Lorem ipsum dolor'
const basicText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce pharetra turpis in ante viverra, sit amet euismod tortor rutrum. Sed eu libero velit. Aliquam erat volutpat. Sed ullamcorper ultricies auctor. Vestibulum vitae odio eleifend, finibus justo a, vestibulum orci.'
const basicMdText = '**Lorem** ipsum ~~dolor~~ sit <sub>amet</sub>, ----- **** **虥諰諨** consectetur adipiscing elit.'
const nonAscii = '虥諰 鯦鯢鯡 媓幁惁 墏, 邆錉霋 鱐鱍鱕 銪 鈌鈅, 韎餀 骱 噮噦噞 虥諰諨 樆樦潏 蝺 嬔嬚嬞 脬舑莕 騩鰒...'

const buildResult = (left, right, word) => {
  return { left, right, word }
}

const test = (text, offset, expectedWord) => {
  const wordInfo = extractWord(text, offset)
  if (expectedWord !== wordInfo && (
    expectedWord.left !== wordInfo.left ||
    expectedWord.right !== wordInfo.right ||
    expectedWord.word !== wordInfo.word
  )) {
    // NOTE: Always invalid.
    expect(expectedWord).to.equal(wordInfo)
  }
}

describe('Test extractWord', () => {
  it('Basic - Invalid text', () => {
    test(null, 0, null)
  })
  it('Basic - Empty text', () => {
    test('', 0, null)
  })
  it('Basic - Invalid offset 1', () => {
    test(basicCheck, -182, buildResult(0, 5, 'Lorem'))
  })
  it('Basic - Invalid offset 2', () => {
    test(basicCheck, undefined, null)
  })
  it('Basic - Invalid offset 3', () => {
    test(basicCheck, 478343, buildResult(12, 17, 'dolor'))
  })

  it('Get first word', () => {
    test(basicText, 0, buildResult(0, 5, 'Lorem'))
  })
  it('Get second word', () => {
    test(basicText, 8, buildResult(6, 11, 'ipsum'))
  })
  it('Get last word', () => {
    test(basicText, 268, buildResult(266, 270, 'orci'))
  })
  it('Last character is not a valid word', () => {
    test(basicText, 271, null)
  })
  it('Get custom index (1)', () => {
    test(basicText, 79, buildResult(79, 81, 'in'))
  })
  it('Get custom index (2)', () => {
    console.log(basicText[104], basicText[105], basicText[106])
    test(basicText, 106, buildResult(105, 112, 'euismod'))
  })

  it('Markdown - Get first word', () => {
    test(basicMdText, 2, buildResult(2, 7, 'Lorem'))
  })
  it('Markdown - Get second word', () => {
    test(basicMdText, 14, buildResult(10, 15, 'ipsum'))
  })
  it('Markdown - Get custom index (1)', () => {
    test(basicMdText, 20, buildResult(18, 23, 'dolor'))
  })
  it('Markdown - Get custom index (2)', () => {
    test(basicMdText, 37, buildResult(35, 39, 'amet'))
  })
  it('Markdown - Not valid word', () => {
    test(basicMdText, 50, null)
  })
  it('Markdown - Not valid word', () => {
    test(basicMdText, 55, null)
  })
  it('Markdown - Valid non-ASCII word', () => {
    test(basicMdText, 61, buildResult(60, 63, '虥諰諨'))
  })

  it('Non-ASCII - Get first word', () => {
    test(nonAscii, 0, buildResult(0, 2, '虥諰'))
  })
  it('Non-ASCII - Get second word', () => {
    test(nonAscii, 4, buildResult(3, 6, '鯦鯢鯡'))
  })
  it('Non-ASCII - Get last word', () => {
    test(nonAscii, 56, buildResult(55, 57, '騩鰒'))
  })
  it('Non-ASCII - Last character is not a valid word', () => {
    test(nonAscii, 58, null)
  })
  it('Non-ASCII - Get custom index', () => {
    test(nonAscii, 19, buildResult(18, 21, '鱐鱍鱕'))
  })
})
