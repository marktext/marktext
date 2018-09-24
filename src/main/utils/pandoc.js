// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import commandExists from 'command-exists'
import { spawn } from 'child_process'

const command = 'pandoc'

const pandoc = (from, to, ...args) => {
  const option = ['-s', from, '-t', to].concat(args)

  const converter = () => new Promise((resolve, reject) => {
    const proc = spawn(command, option)
    proc.on('error', reject)
    let data = ''
    proc.stdout.on('data', chunk => {
      data += chunk.toString()
    })
    proc.stdout.on('end', () => resolve(data))
    proc.stdout.on('error', reject)
    proc.stdin.end()
  })

  converter.stream = srcStream => {
    const proc = spawn(command, option)
    srcStream.pipe(proc.stdin)
    return proc.stdout
  }

  return converter
}

pandoc.exists = async () => {
  try {
    await commandExists('pandoc')
    return true
  } catch (err) {
    return false
  }
}

export default pandoc
