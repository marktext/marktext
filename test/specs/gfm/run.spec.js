// This file is copy from https://github.com/markedjs/marked/blob/master/test/specs/gfm/getSpecs.js
// And for custom use.
import { removeCustomClass } from '../help'
import { writeResult } from '../commonMark/run.spec'
import { MT_MARKED_OPTIONS } from '../config'
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const marked = require('../../../src/muya/lib/parser/marked/index.js').default
const HtmlDiffer = require('@markedjs/html-differ').HtmlDiffer
const fs = require('fs')
const path = require('path')

const options = { ignoreSelfClosingSlash: true, ignoreAttributes: ['id', 'class'] }

const htmlDiffer = new HtmlDiffer(options)

const getSpecs = () => {
  return fetch('https://github.github.com/gfm/')
    .then(res => res.text())
    .then(html => cheerio.load(html))
    .then($ => {
      const version = $('.version').text().match(/\d+\.\d+/)[0]
      if (!version) {
        throw new Error('No version found')
      }
      const specs = []
      $('.extension').each((i, ext) => {
        const section = $('.definition', ext).text().trim().replace(/^\d+\.\d+(.*?) \(extension\)[\s\S]*$/, '$1')
        $('.example', ext).each((j, exa) => {
          const example = +$(exa).attr('id').replace(/\D/g, '')
          const markdown = $('.language-markdown', exa).text().trim()
          const html = $('.language-html', exa).text().trim()
          specs.push({
            section,
            html,
            markdown,
            example
          })
        })
      })

      return [version, specs]
    })
}

const getMarkedSpecs = async (version) => {
  return fetch(`https://raw.githubusercontent.com/markedjs/marked/master/test/specs/gfm/gfm.${version}.json`)
    .then(res => res.json())
}

const diffAndGenerateResult = async () => {
  const [version, specs] = await getSpecs()
  const markedSpecs = await getMarkedSpecs(version)
  specs.forEach(spec => {
    const html = removeCustomClass(marked(spec.markdown, MT_MARKED_OPTIONS))
    if (!htmlDiffer.isEqual(html, spec.html)) {
      spec.shouldFail = true
    }
  })
  fs.writeFileSync(path.resolve(__dirname, `./gfm.${version}.json`), JSON.stringify(specs, null, 2) + '\n')
  writeResult(version, specs, markedSpecs, 'gfm')
}

try {
  diffAndGenerateResult()
} catch (err) {
  console.log(err)
}
