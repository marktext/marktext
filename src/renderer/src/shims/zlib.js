// Browser shim for Node's 'zlib' module — delegates to preload-exposed nodeAPI
export function deflateSync(input, options) {
  const base64 = window.nodeAPI.deflateSync(input, options)
  return {
    toString: (encoding) => {
      if (encoding === 'base64') return base64
      throw new Error('zlib shim only supports base64 output')
    }
  }
}

export default { deflateSync }
