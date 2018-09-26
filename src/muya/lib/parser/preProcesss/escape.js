import { escape } from '../utils'
const meta = {
  id: 'escape',
  type: 'preProcess',
  sort: 200
}

function process (src) {
  return escape(src)
}

export default { meta, process }
