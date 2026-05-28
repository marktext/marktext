/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from 'fs'
import path from 'path'

const localesDir = path.join(process.cwd(), 'static/locales')

if (!fs.existsSync(localesDir)) {
  console.error('Locales directory does not exist!')
}

const files = fs.readdirSync(localesDir)
files.forEach((file) => {
  if (file.endsWith('.json') && file.indexOf('.min') === -1) {
    // Avoid re-minifying
    console.log(`Minimizing ${file}`)
    // Use readFileSync and writeFileSync to avoid Unicode escaping
    const content = fs.readFileSync(path.join(localesDir, file), 'utf8')

    const filename = path.parse(file).name

    fs.writeFileSync(
      path.join(localesDir, `${filename}.min.json`),
      JSON.stringify(JSON.parse(content)),
      'utf8'
    )
  }
})
console.log('Translation files minimized successfully')
