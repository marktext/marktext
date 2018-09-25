// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import { spawn, exec } from 'child_process'

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

pandoc.exists = () => {
  return new Promise((resolve, reject) => {
    exec('pandoc --version', (error, stdout, stderr) => {
      if (error) resolve(false)
      else resolve(true)
    })
  })
}

export default pandoc
