// render token of text type to vdom.
import { highlight } from '../utils/'
const meta = {
  id: 'text',
  type: 'inline',
  sort: 300,
  token: true,
  validate: false

}
function render (h, cursor, block, token) {
  const { start, end } = token.range
  return highlight(h, block, start, end, token)
}
export default { meta, render }
