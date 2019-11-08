/**
 * This file copy from prismjs/plugins/prism-line-number
 */

/**
 * Regular expression used for determining line breaks
 * @type {RegExp}
 */
const NEW_LINE_EXP = /\n(?!$)/g

/**
 * Returns style declarations for the element
 * @param {Element} element
 */
const getStyles = function (element) {
  if (!element) {
    return null
  }

  return window.getComputedStyle ? getComputedStyle(element) : (element.currentStyle || null)
}

/**
* Resizes line numbers spans according to height of line of code
* @param {Element} element <pre> element
*/
const resizeCodeBlockLineNumber = function (element) {
  // FIXME: Heavy performance issues with this function, please see #1648.

  const codeStyles = getStyles(element)
  const whiteSpace = codeStyles['white-space']

  if (whiteSpace === 'pre' || whiteSpace === 'pre-wrap' || whiteSpace === 'pre-line') {
    const codeElement = element.querySelector('code')
    const lineNumbersWrapper = element.querySelector('.line-numbers-rows')
    let lineNumberSizer = element.querySelector('.line-numbers-sizer')
    const codeLines = codeElement.textContent.split(NEW_LINE_EXP)

    if (!lineNumberSizer) {
      lineNumberSizer = document.createElement('span')
      lineNumberSizer.className = 'line-numbers-sizer'

      codeElement.appendChild(lineNumberSizer)
    }

    lineNumberSizer.style.display = 'block'

    codeLines.forEach(function (line, lineNumber) {
      lineNumberSizer.textContent = line || '\n'
      const lineSize = lineNumberSizer.getBoundingClientRect().height
      lineNumbersWrapper.children[lineNumber].style.height = lineSize + 'px'
    })

    lineNumberSizer.textContent = ''
    lineNumberSizer.style.display = 'none'
  }
}

export default resizeCodeBlockLineNumber
