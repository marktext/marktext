import path from 'path'

const additionalPaths = ({
  'win32': [],
  'linux': [
    '/usr/bin'
  ],
  'darwin': [
    '/usr/local/bin',
    '/Library/TeX/texbin'
  ]
})[process.platform] || []

export const checkSystem = () => {
  if (additionalPaths.length > 0) {
    // First integrate the additional paths that we need.
    const nPATH = process.env.PATH.split(path.delimiter)

    for (const x of additionalPaths) {
      // Check for both trailing and non-trailing slashes (to not add any
      // directory more than once)
      const y = (x[x.length - 1] === '/') ? x.substr(0, x.length - 1) : x + '/'
      if (!nPATH.includes(x) && !nPATH.includes(y)) {
        nPATH.push(x)
      }
    }

    process.env.PATH = nPATH.join(path.delimiter)
  }

  if (path.dirname('pandoc').length > 0) {
    if (process.env.PATH.indexOf(path.dirname('pandoc')) === -1) {
      process.env.PATH += path.delimiter + path.dirname('pandoc')
    }
  }
}
