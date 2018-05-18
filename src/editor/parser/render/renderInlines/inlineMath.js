import { snackToCamel } from '../../../utils'

export default function inlineMath (h, cursor, block, token, outerClass) {
  return this[snackToCamel('display_math')](h, cursor, block, token, outerClass)
}
