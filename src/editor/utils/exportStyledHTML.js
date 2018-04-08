import axios from 'axios'
import cheerio from 'cheerio'
import { parse, toPlainObject, fromPlainObject, generate } from 'css-tree'
import { CLASS_OR_ID, DAED_REMOVE_SELECTOR } from '../config'
import { collectImportantComments, unescapeHtml } from './index'

class ExportHTML {
  async generate () {
    const html = this.getHtml()
    const style = await this.getStyle()
    const outputHtml = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Mark Text</title>
        <style>
        ${style}
        a {
          pointer-events: auto;
        }
        hr {
          height: 5px;
          background: gainsboro;
          border: none;
        }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>`
    return outputHtml
  }
  async getStyle () {
    const links = Array.from(document.querySelectorAll('link'))
    const styles = Array.from(document.querySelectorAll('style'))
    let styleSheets = []

    const DEAD_OBVIOUS = new Set(['*', 'body', 'html'])

    const checker = selector => {
      if (DAED_REMOVE_SELECTOR.has(selector)) {
        return false
      }
      if (DEAD_OBVIOUS.has(selector)) {
        return true
      }
      if (/:-(ms|moz)-/.test(selector)) {
        return true
      }
      if (/:{1,2}(before|after)/.test(selector)) {
        return true
      }
      try {
        return !!document.querySelector(selector)
      } catch (err) {
        const exception = err.toString()
        console.log(`Unable to querySelector('${selector}') [${exception}]`, 'error') // eslint-disable-line no-console
        return false
      }
    }

    const cleaner = (ast, callback) => {
      const decisionsCache = {}

      const clean = (children, cb) => children.filter((child) => {
        if (child.type === 'Rule') {
          const values = child.prelude.value.split(',').map(x => x.trim())
          const keepValues = values.filter((selectorString) => {
            if (decisionsCache[selectorString]) {
              return decisionsCache[selectorString]
            }
            const keep = cb(selectorString)
            decisionsCache[selectorString] = keep
            return keep
          })
          if (keepValues.length) {
            // re-write the selector value
            child.prelude.value = keepValues.join(', ')
            return true
          }
          return false
        } else if (child.type === 'Atrule' && child.name === 'media') {
          // recurse
          child.block.children = clean(child.block.children, cb)
          return child.block.children.length > 0
        }
        // The default is to keep it.
        return true
      })

      ast.children = clean(ast.children, callback)
      return ast
    }

    const linkPromises = links
      .filter(link => (
        link.href &&
        (link.rel === 'stylesheet' ||
          link.href.toLowerCase().endsWith('.css')) &&
        !link.href.toLowerCase().startsWith('blob:') &&
        link.media !== 'print'
      ))
      .map(link => {
        const href = link.href
        return axios.get(href)
      })
    const linkStyles = await Promise.all(linkPromises)
    for (const style of linkStyles) {
      if (style.data) styleSheets.push(style.data)
    }
    styleSheets.push(...styles.map(style => style.innerHTML))
    styleSheets = styleSheets.map(style => {
      const ast = parse(style, {
        parseValue: false,
        parseRulePrelude: false
      })

      return toPlainObject(ast)
    })
    const cleanedStyles = styleSheets.map(ast => {
      const cleanedAST = fromPlainObject(cleaner(ast, checker))
      return generate(cleanedAST)
    })
    const finalCSS = collectImportantComments(cleanedStyles.join('\n'))

    return finalCSS
  }

  getHtml () {
    const rawHTML = document.querySelector(`#${CLASS_OR_ID['AG_EDITOR_ID']}`).outerHTML
    const $ = cheerio.load(rawHTML)
    const removeClassNames = [
      `.${CLASS_OR_ID['AG_REMOVE']}`,
      `.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`,
      `.${CLASS_OR_ID['AG_EMOJI_MARKER']}`,
      `.${CLASS_OR_ID['AG_TABLE_TOOL_BAR']}`,
      `.${CLASS_OR_ID['AG_MATH_MARKER']}`,
      `.${CLASS_OR_ID['AG_MATH_TEXT']}`,
      '.CodeMirror-cursors'
    ]
    $(removeClassNames.join(', ')).remove()
    $(`.${CLASS_OR_ID['AG_ACTIVE']}`).removeClass(CLASS_OR_ID['AG_ACTIVE'])
    $(`[data-role=hr]`).replaceWith('<hr>')
    const emojis = $(`span.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`)
    if (emojis.length > 0) {
      emojis.each((i, e) => {
        const emojiElement = $(e)
        const emoji = emojiElement.attr('data-emoji')

        emojiElement.text(emoji)
      })
    }

    // set checkbox to disabled
    const checkboxs = $(`input.${CLASS_OR_ID['AG_TASK_LIST_ITEM_CHECKBOX']}`)
    if (checkboxs.length) {
      checkboxs.each((i, c) => {
        const checkbox = $(c)
        checkbox.attr('disabled', true)
      })
    }

    // change `data-href` to `href` attribute
    const anchors = $(`a[data-href]`)
    if (anchors.length > 0) {
      anchors.each((i, a) => {
        const anchor = $(a)
        const href = anchor.attr('data-href')
        anchor.removeAttr('data-href')
        anchor.attr('href', href)
        anchor.attr('target', '_blank')
      })
    }
    return $('body').html()
      .replace(/<span class="ag-html-tag">([\s\S]+?)<\/span>/g, (m, p1) => unescapeHtml(p1))
  }
}

export default ExportHTML
