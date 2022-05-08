import path from 'path'
import { app } from 'electron'
import os from 'os'
import { isDirectory } from 'common/filesystem'
import parseArgs from './parser'
import { getPath } from '../utils'

const write = s => process.stdout.write(s)
const writeLine = s => write(s + '\n')

const cli = () => {
  let argv = process.argv.slice(1)
  if (process.env.NODE_ENV === 'development') {
    // Don't pass electron development arguments to MarkText and change user data path.
    argv = ['--user-data-dir', path.join(getPath('appData'), 'marktext-dev')]
  }

  const args = parseArgs(argv, true)
  if (args['--help']) {
    write(`Usage: marktext [commands] [path ...]

  Available commands:

        --debug                   Enable debug mode
        --safe                    Disable plugins and other user configuration
    -n, --new-window              Open a new window on second-instance
        --user-data-dir           Change the user data directory
        --disable-gpu             Disable GPU hardware acceleration
        --disable-spellcheck      Disable built-in spellchecker
    -v, --verbose                 Be verbose
        --version                 Print version information
    -h, --help                    Print this help message
`)
    process.exit(0)
  }

  if (args['--version']) {
    writeLine(`MarkText: ${global.MARKTEXT_VERSION_STRING}`)
    writeLine(`Node.js: ${process.versions.node}`)
    writeLine(`Electron: ${process.versions.electron}`)
    writeLine(`Chromium: ${process.versions.chrome}`)
    writeLine(`OS: ${os.type()} ${os.arch()} ${os.release()}`)
    process.exit(0)
  }

  // Check for portable mode and ensure the user data path is absolute. We assume
  // that the path is writable if not this lead to an application crash.
  if (!args['--user-data-dir']) {
    const portablePath = path.join(app.getAppPath(), '..', '..', 'marktext-user-data')
    if (isDirectory(portablePath)) {
      args['--user-data-dir'] = portablePath
    }
  } else {
    args['--user-data-dir'] = path.resolve(args['--user-data-dir'])
  }

  return args
}

export default cli
