import arg from 'arg'
import path from 'path'

export const userArguments = (
  argv: string[],
  defaultApp: boolean,
  entryPath?: string
): string[] => {
  const args = argv.slice(1)
  if (defaultApp) {
    // Electron switches can precede the application entry (including under Playwright).
    const index = args.findIndex(
      (arg) => !arg.startsWith('-') && (!entryPath || path.resolve(arg) === path.resolve(entryPath))
    )
    if (index !== -1) args.splice(index, 1)
  }
  return args
}

/**
 * Parse the given arguments or the default program arguments.
 *
 * @param argv Arguments if null the default program arguments are used.
 * @param permissive If set to false an exception is throw about unknown flags.
 * @returns Parsed arguments
 */
const parseArgs = (argv: string[] | null = null, permissive: boolean = true) => {
  if (argv === null) {
    argv = userArguments(process.argv, !!process.defaultApp)
  }
  const spec = {
    '--debug': Boolean,
    '--safe': Boolean,

    '--new-window': Boolean,
    '-n': '--new-window',

    '--read-only': Boolean,
    '--disable-gpu': Boolean,
    '--disable-spellcheck': Boolean,
    '--user-data-dir': String,

    // Misc
    '--help': Boolean,
    '-h': '--help',
    '--verbose': arg.COUNT,
    '-v': '--verbose',
    '--version': Boolean
  } satisfies arg.Spec
  return arg(spec, { argv, permissive })
}

export type ParsedArgs = ReturnType<typeof parseArgs>

export default parseArgs
