// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import { spawn } from 'child_process'
import commandExists from 'command-exists'
import { isFile2 } from 'common/filesystem'

const pandocCommand = 'pandoc'

const getCommand = () => {
  if (envPathExists()) {
    return process.env.MARKTEXT_PANDOC
  }
  return pandocCommand
}

const pandoc = (from, to, ...args) => {
  const command = getCommand()
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
  if (envPathExists()) {
    return true
  }
  return commandExists.sync(pandocCommand)
}

const envPathExists = () => {
  return !!process.env.MARKTEXT_PANDOC && isFile2(process.env.MARKTEXT_PANDOC)
}

export default pandoc
