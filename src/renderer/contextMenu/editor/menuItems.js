import * as contextMenu from './actions'

export const CUT = {
  label: 'Cut',
  id: 'cutMenuItem', // not used yet!
  role: 'cut'
}

export const COPY = {
  label: 'Copy',
  id: 'copyMenuItem',
  role: 'copy'
}

export const PASTE = {
  label: 'Paste',
  id: 'pasteMenuItem',
  role: 'paste'
}

export const COPY_TABLE = {
  label: 'Copy Table',
  id: 'copyTableMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyTable()
  }
}

export const COPY_AS_MARKDOWN = {
  label: 'Copy As Markdown',
  id: 'copyAsMarkdownMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsMarkdown()
  }
}

export const COPY_AS_HTML = {
  label: 'Copy As Html',
  id: 'copyAsHtmlMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsHtml()
  }
}

export const PASTE_AS_PLAIN_TEXT = {
  label: 'Paste As Plain Text',
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.pasteAsPlainText()
  }
}

export const INSERT_BEFORE = {
  label: 'Insert Paragraph Before',
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('before')
  }
}

export const INSERT_AFTER = {
  label: 'Insert Paragraph After',
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('after')
  }
}

export const INSERT_ROW = {
  label: 'Insert Row',
  submenu: [{
    label: 'Previous Row',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'previous',
        action: 'insert',
        target: 'row'
      })
    }
  }, {
    label: 'Next Row',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'next',
        action: 'insert',
        target: 'row'
      })
    }
  }]
}

export const REMOVE_ROW = {
  label: 'Remove Row',
  submenu: [{
    label: 'Previous Row',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'previous',
        action: 'remove',
        target: 'row'
      })
    }
  }, {
    label: 'Current Row',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'current',
        action: 'remove',
        target: 'row'
      })
    }
  }, {
    label: 'Next Row',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'next',
        action: 'remove',
        target: 'row'
      })
    }
  }]
}

export const INSERT_COLUMN = {
  label: 'Insert Column',
  submenu: [{
    label: 'Left Column',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'left',
        action: 'insert',
        target: 'column'
      })
    }
  }, {
    label: 'Right Column',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'right',
        action: 'insert',
        target: 'column'
      })
    }
  }]
}

export const REMOVE_COLUMN = {
  label: 'Remove Column',
  submenu: [{
    label: 'Left Column',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'left',
        action: 'remove',
        target: 'column'
      })
    }
  }, {
    label: 'Current Column',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'current',
        action: 'remove',
        target: 'column'
      })
    }
  }, {
    label: 'Right Column',
    click (menuItem, browserWindow) {
      contextMenu.editTable({
        location: 'right',
        action: 'remove',
        target: 'column'
      })
    }
  }]
}

export const SEPARATOR = {
  type: 'separator'
}
