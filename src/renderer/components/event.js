import { ipcRenderer } from 'electron'

const mixins = {
  methods: {
    handleSave () {
      ipcRenderer.on('AGANI::ask-file-save', () => {
        const pathname = this.pathname
        const markdown = this.editor.getMarkdown()
        ipcRenderer.send('AGANI:response-file-save', { pathname, markdown })
      })
    },
    listenEvents () {
      ipcRenderer.on('AGANI::set-pathname', (e, { pathname }) => {
        this.pathname = pathname
      })
      ipcRenderer.on('AGANI::file-loaded', (e, { file, filename, pathname }) => {
        this.pathname = pathname
        this.editor.setMarkdown(file)
      })
    }
  }
}

export default mixins
