import arg from 'arg'

/**
 * Parse the given arguments or the default program arguments.
 *
 * @param {string[]} argv Arguments if null the default program arguments are used.
 * @param {boolean} permissive If set to false an exception is throw about unknown flags.
 * @returns {arg.Result} Parsed arguments
 */
const parseArgs = (argv = null, permissive = true) => {
  if (argv === null) {
    argv = process.argv.slice(1)
  }
  const spec = {
    '--debug': Boolean,
    '--safe': Boolean,

    '--new-window': Boolean,
    '-n': '--new-window',

    '--disable-gpu': Boolean,
    '--disable-spellcheck': Boolean,
    '--user-data-dir': String,

    // Misc
    '--help': Boolean,
    '-h': '--help',
    '--verbose': arg.COUNT,
    '-v': '--verbose',
    '--version': Boolean
  }
  return arg(spec, { argv, permissive })
}

export default parseArgs
