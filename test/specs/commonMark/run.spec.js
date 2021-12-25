// This file is copy from marked and modified.
import { removeCustomClass, padding } from '../help'
import { MT_MARKED_OPTIONS } from '../config'
const fetch = require('node-fetch')
const markedJs = require('marked')
const marked = require('../../../src/muya/lib/parser/marked/index.js').default
const HtmlDiffer = require('@markedjs/html-differ').HtmlDiffer
const fs = require('fs')
const path = require('path')

const options = { ignoreSelfClosingSlash: true, ignoreAttributes: ['id', 'class'] }

const htmlDiffer = new HtmlDiffer(options)

const getSpecs = async () => {
  const version = await fetch('https://raw.githubusercontent.com/commonmark/commonmark.js/master/package.json')
    .then(res => res.json())
    .then(pkg => pkg.version.replace(/^(\d+\.\d+).*$/, '$1'))

  return fetch(`https://spec.commonmark.org/${version}/spec.json`)
    .then(res => res.json())
    .then(specs => ({ specs, version }))
}

const getMarkedSpecs = async (version) => {
  return fetch(`https://raw.githubusercontent.com/markedjs/marked/master/test/specs/commonmark/commonmark.${version}.json`)
    .then(res => res.json())
}

export const writeResult = (version, specs, markedSpecs, type = 'commonmark') => {
  let result = '## Test Result\n\n'
  const totalCount = specs.length
  const failedCount = specs.filter(s => s.shouldFail).length
  const classifiedResult = {}
  for (const spec of specs) {
    const { example, section, shouldFail } = spec
    const item = classifiedResult[section]
    if (item) {
      item.count++
      if (shouldFail) {
        item.failed++
        item.failedExamples.push(example)
      }
    } else {
      classifiedResult[section] = {
        count: 1,
        failed: 0,
        failedExamples: []
      }
      if (shouldFail) {
        classifiedResult[section].failed++
        classifiedResult[section].failedExamples.push(example)
      }
    }
  }
  result += `Total test ${totalCount} examples, and failed ${failedCount} examples:\n\n`

  // |section|failed/total|percentage|
  const sectionMaxLen = Math.max(...Object.keys(classifiedResult).map(key => key.length))
  const failedTotalLen = 15
  const percentageLen = 15
  result += `|${padding('Section', sectionMaxLen)}|${padding('Failed/Total', failedTotalLen)}|${padding('Percentage', percentageLen)}|\n`
  result += `|${padding('-'.repeat(sectionMaxLen - 2), sectionMaxLen, ':')}|${padding('-'.repeat(failedTotalLen - 2), failedTotalLen, ':')}|${padding('-'.repeat(percentageLen - 2), percentageLen, ':')}|\n`

  for (const key of Object.keys(classifiedResult)) {
    const { count, failed } = classifiedResult[key]

    result += `|${padding(key, sectionMaxLen)}`
    result += `|${padding(failed + '/' + count, failedTotalLen)}`
    result += `|${padding(((count - failed) / count * 100).toFixed(2) + '%', percentageLen)}|\n`
  }

  result += '\n'

  specs.filter(s => s.shouldFail)
    .forEach(spec => {
      const expectedHtml = spec.html
      const acturalHtml = marked(spec.markdown, MT_MARKED_OPTIONS)
      result += `**Example${spec.example}**\n\n`
      result += '```markdown\n'
      result += 'Markdown content\n'
      result += `${spec.markdown.replace(/`/g, '\\`')}\n`
      result += 'Expected Html\n'
      result += `${expectedHtml}\n`
      result += 'Actural Html\n'
      result += `${acturalHtml}\n`
      result += '```\n\n'
    })
  const failedPath = type === 'commonmark' ? `./${type}.${version}.md` : `../gfm/${type}.${version}.md`
  fs.writeFileSync(path.join(__dirname, failedPath), result)
  // compare with markedjs
  let compareResult = '## Compare with `marked.js`\n\n'
  compareResult += `Marked.js failed examples count: ${markedSpecs.filter(s => s.shouldFail).length}\n`
  compareResult += `MarkText failed examples count: ${failedCount}\n\n`
  let count = 0
  specs.forEach((spec, i) => {
    if (spec.shouldFail !== markedSpecs[i].shouldFail) {
      count++
      const acturalHtml = marked(spec.markdown, MT_MARKED_OPTIONS)

      compareResult += `**Example${spec.example}**\n\n`
      compareResult += `MarkText ${spec.shouldFail ? 'fail' : 'success'} and marked.js ${markedSpecs[i].shouldFail ? 'fail' : 'success'}\n\n`
      compareResult += '```markdown\n'
      compareResult += 'Markdown content\n'
      compareResult += `${spec.markdown.replace(/`/g, '\\`')}\n`
      compareResult += 'Expected Html\n'
      compareResult += `${spec.html}\n`
      compareResult += 'Actural Html\n'
      compareResult += `${acturalHtml}\n`
      compareResult += 'marked.js html\n'
      compareResult += `${markedJs(spec.markdown, { headerIds: false })}\n`
      compareResult += '```\n\n'
    }
  })

  compareResult += `There are ${count} examples are different with marked.js.`
  const comparePath = type === 'commonmark' ? './compare.marked.md' : '../gfm/compare.marked.md'
  fs.writeFileSync(path.join(__dirname, comparePath), compareResult)
}

const diffAndGenerateResult = async () => {
  const { specs, version } = await getSpecs()
  const markedSpecs = await getMarkedSpecs(version)

  specs.forEach(spec => {
    const html = removeCustomClass(marked(spec.markdown, MT_MARKED_OPTIONS))
    if (!htmlDiffer.isEqual(html, spec.html)) {
      spec.shouldFail = true
    }
  })
  fs.writeFileSync(path.join(__dirname, `./commonmark.${version}.json`), JSON.stringify(specs, null, 2) + '\n')
  writeResult(version, specs, markedSpecs, 'commonmark')
}

try {
  diffAndGenerateResult()
} catch (err) {
  console.log(err)
}
