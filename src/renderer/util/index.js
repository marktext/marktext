export function serialize (params) {
  return Object.keys(params).map(key => `${key}=${params[key]}`).join('&')
}
export function merge (...args) {
  return Object.assign({}, ...args)
}
export function dataURItoBlob (dataURI) {
  const data = dataURI.split(';base64,')
  const byte = window.atob(data[1])
  const mime = data[0].split(':')[1]
  const ab = new ArrayBuffer(byte.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byte.length; i++) {
    ia[i] = byte.charCodeAt(i)
  }
  return new window.Blob([ab], { type: mime })
}
