const fs = require('fs')
const readline = require('readline')
const arg = require('arg')
const sourceMap = require('source-map')
const stackTraceParser = require('stacktrace-parser')

const spec = {
  '--map': String,
  '-m': '--map'
}
const args = arg(spec, { argv: process.argv.slice(1), permissive: true })
const mapPath = args['--map']

if (!mapPath) {
  console.log('ERROR: -m is a required argument.\n')
  console.log('USAGE:\n  yarn deobfuscateStackTrace -m <path_to_source_map>')
  process.exit(1)
} else if (!fs.existsSync(mapPath)) {
  console.log(`ERROR: Invalid source map path: "${mapPath}".`)
  process.exit(1)
}

const deobfuscateStackTrace = stackTraceStr => {
  const smc = new sourceMap.SourceMapConsumer(fs.readFileSync(mapPath, 'utf8'))
  const stack = stackTraceParser.parse(stackTraceStr)
  if (stack.length === 0) {
    throw new Error('Invalid stack trace.')
  }

  const errorMessage = stackTraceStr.split('\n').find(line => line.trim().length > 0)
  if (errorMessage) {
    console.log(errorMessage)
  }

  stack.forEach(({ methodName, lineNumber, column }) => {
    try {
      if (lineNumber == null || lineNumber < 1) {
        console.log(`    at ${methodName || ''}`)
      } else {
        const pos = smc.originalPositionFor({ line: lineNumber, column })
        if (pos && pos.line != null) {
          console.log(`    at ${pos.name || ''} (${pos.source}:${pos.line}:${pos.column})`)
        }
      }
    } catch (err) {
      console.log(`    Failed to parse line ${lineNumber} on column ${column}.`)
    }
  })
}

console.log('Please paste the stack trace and continue with double Enter:')

const lines = []
readline.createInterface({
  input: process.stdin,
  terminal: false
}).on('line', line => {
  if (!line || line === '') {
    console.log('Deobfuscated stack trace:')
    deobfuscateStackTrace(lines.join('\n'))
    process.exit(0)
  }
  lines.push(line)
})
