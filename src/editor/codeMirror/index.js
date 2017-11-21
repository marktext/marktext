import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/closetag'
import 'codemirror/mode/javascript/javascript'
import codeMirror from 'codemirror/lib/codemirror'

import 'codemirror/lib/codemirror.css'
import './index.css'

const defaultOption = {
  autoCloseBrackets: true,
  autoCloseTags: true,
  autofocus: true,
  tabSize: 2,
  mode: 'javascript'
}

const CustomerCodeMirror = (container, option) => {
  return codeMirror(container, Object.assign(defaultOption, option))
}

export default CustomerCodeMirror
