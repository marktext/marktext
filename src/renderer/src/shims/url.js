// Browser shim for Node's 'url' module — uses native URL API
export function fileURLToPath(urlStr) {
  const url = new URL(urlStr)
  return decodeURIComponent(url.pathname)
}

export default { fileURLToPath }
