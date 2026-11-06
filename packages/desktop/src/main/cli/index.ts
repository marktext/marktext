import path from 'path'
import { app } from 'electron'
import os from 'os'
import { isDirectory } from 'common/filesystem'
import parseArgs, { userArguments, type ParsedArgs } from './parser'
import { prepareCliJob } from './cliJob'
import { getPath } from '../utils'

const write = (s: string): boolean => process.stdout.write(s)
const writeLine = (s: string): boolean => write(s + '\n')

const cli = (): ParsedArgs => {
  let argv = userArguments(process.argv, !!process.defaultApp, app.getAppPath())
  if (import.meta.env.DEV) {
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
        --read-only               Open the specified files in read-only mode
        --user-data-dir           Change the user data directory
        --disable-gpu             Disable GPU hardware acceleration
        --disable-spellcheck      Disable built-in spellchecker
    -v, --verbose                 Be verbose
        --version                 Print version information
    -h, --help                    Print this help message

  Headless conversion (writes files and exits):

        --export-pdf <in.md...>   Export Markdown to PDF
        --export-html <in.md...>  Export Markdown to standalone HTML
        --export <fmt> <in.md...> Convert with pandoc: docx, odt, rtf, epub,
                                  latex, rst, org, mediawiki, textile
        --import <file...>        Convert a document to Markdown with pandoc
    -o, --output <path>           Output file (one input) or directory (batch);
                                  default: input name with the new extension

  Export options (--export-pdf / --export-html):

        --page-size <size>        A3, A4 (default), A5, Legal, Letter, Tabloid
                                  (PDF only)
        --landscape               Landscape orientation (PDF only)
        --margin-top <mm>         Page margins (defaults: 20mm top/bottom,
        --margin-right <mm>       15mm right/left; PDF only)
        --margin-bottom <mm>
        --margin-left <mm>
        --theme <name>            Export theme: academic, liber or a CSS file
                                  in <userData>/themes/export
        --header <text>           Centered page header (PDF only)
        --footer <text>           Centered page footer (PDF only)
        --font-family <name>      Override the export font
        --font-size <px>          Override the export font size
        --line-height <n>         Override the export line height
        --auto-numbering-headings Number the headings
        --show-front-matter       Keep the YAML front matter
        --toc-title <text>        Table-of-contents title

  Exit codes: 0 success, 1 conversion failed, 2 invalid arguments.
`)
    process.exit(0)
  }

  if (args['--version']) {
    writeLine(`MarkText: ${MARKTEXT_VERSION_STRING}`)
    writeLine(`Node.js: ${process.versions.node}`)
    writeLine(`Electron: ${process.versions.electron}`)
    writeLine(`Chromium: ${process.versions.chrome}`)
    writeLine(`OS: ${os.type()} ${os.arch()} ${os.release()}`)
    process.exit(0)
  }

  // Headless conversion jobs validate their own arguments and exit on bad input.
  prepareCliJob(args as unknown as Record<string, unknown>)

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
