export default function inlineMath (h, cursor, block, token, outerClass) {
  return this['display_math'](h, cursor, block, token, outerClass)
}
