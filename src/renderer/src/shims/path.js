// Browser shim for Node's 'path' module — delegates to preload-exposed window.path
export const resolve = (...args) => window.path.resolve(...args)
export const join = (...args) => window.path.join(...args)
export const dirname = (p) => window.path.dirname(p)
export const basename = (p, ext) => window.path.basename(p, ext)
export const extname = (p) => window.path.extname(p)
export const normalize = (p) => window.path.normalize(p)
export const relative = (from, to) => window.path.relative(from, to)
export const isAbsolute = (p) => window.path.isAbsolute(p)
export const sep = window.path?.sep || '/'
export const delimiter = window.path?.delimiter || ':'
export const parse = (p) => window.path.parse(p)

export default {
  resolve,
  join,
  dirname,
  basename,
  extname,
  normalize,
  relative,
  isAbsolute,
  sep,
  delimiter,
  parse
}
