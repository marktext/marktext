import arg from 'arg'
import path from 'path'
import { fileURLToPath } from 'url'

// Desktop entries launched with `%U` (PCManFM, for example) pass file:// URIs
// instead of paths. A URI Node can't map to a local path is kept as given.
const fileUriToPath = (argument: string): string => {
  if (!argument.startsWith('file://')) return argument
  try {
    return fileURLToPath(argument)
  } catch {
    return argument
  }
}

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
  const args = arg(spec, { argv, permissive })
  args._ = args._.map(fileUriToPath)
  return args
}

export type ParsedArgs = ReturnType<typeof parseArgs>

export default parseArgs
