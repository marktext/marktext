import * as actions from '../actions/edit'
import userPreference from '../preference'
import keybindings from '../shortcutHandler'

const { aidou } = userPreference.getAll()

export default {
  label: 'Edit',
  submenu: [{
    label: 'Undo',
    accelerator: keybindings.getAccelerator('editUndo'),
    click: (menuItem, browserWindow) => {
      actions.edit(browserWindow, 'undo')
    }
  }, {
    label: 'Redo',
    accelerator: keybindings.getAccelerator('editRedo'),
    click: (menuItem, browserWindow) => {
      actions.edit(browserWindow, 'redo')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Cut',
    accelerator: keybindings.getAccelerator('editCut'),
    role: 'cut'
  }, {
    label: 'Copy',
    accelerator: keybindings.getAccelerator('editCopy'),
    role: 'copy'
  }, {
    label: 'Paste',
    accelerator: keybindings.getAccelerator('editPaste'),
    role: 'paste'
  }, {
    type: 'separator'
  }, {
    label: 'Copy As Markdown',
    accelerator: keybindings.getAccelerator('editCopyAsMarkdown'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'copyAsMarkdown')
    }
  }, {
    label: 'Copy As HTML',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'copyAsHtml')
    }
  }, {
    label: 'Paste As Plain Text',
    accelerator: keybindings.getAccelerator('editCopyAsPlaintext'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'pasteAsPlainText')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Select All',
    accelerator: keybindings.getAccelerator('editSelectAll'),
    role: 'selectall'
  }, {
    type: 'separator'
  }, {
    label: 'Duplicate',
    accelerator: keybindings.getAccelerator('editDuplicate'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'duplicate')
    }
  }, {
    label: 'Create Paragraph',
    accelerator: keybindings.getAccelerator('editCreateParagraph'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'createParagraph')
    }
  }, {
    label: 'Delete Paragraph',
    accelerator: keybindings.getAccelerator('editDeleteParagraph'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'deleteParagraph')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Find',
    accelerator: keybindings.getAccelerator('editFind'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'find')
    }
  }, {
    label: 'Find Next',
    accelerator: keybindings.getAccelerator('editFindNext'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'fineNext')
    }
  }, {
    label: 'Find Previous',
    accelerator: keybindings.getAccelerator('editFindPrevious'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'findPrev')
    }
  }, {
    label: 'Replace',
    accelerator: keybindings.getAccelerator('editReplace'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'replace')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Aidou',
    visible: aidou,
    accelerator: keybindings.getAccelerator('editAidou'),
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'aidou')
    }
  }, {
    label: 'Insert Image',
    submenu: [{
      label: 'Absolute Path',
      click (menuItem, browserWindow) {
        actions.insertImage(browserWindow, 'absolute')
      }
    }, {
      label: 'Relative Path',
      click (menuItem, browserWindow) {
        actions.insertImage(browserWindow, 'relative')
      }
    }, {
      label: 'Upload to Cloud (EXP)',
      click (menuItem, browserWindow) {
        actions.insertImage(browserWindow, 'upload')
      }
    }]
  }, {
    type: 'separator'
  }, {
    label: 'Line Ending',
    submenu: [{
      id: 'crlfLineEndingMenuEntry',
      label: 'Carriage return and line feed (CRLF)',
      type: 'radio',
      click (menuItem, browserWindow) {
        actions.lineEnding(browserWindow, 'crlf')
      }
    }, {
      id: 'lfLineEndingMenuEntry',
      label: 'Line feed (LF)',
      type: 'radio',
      click (menuItem, browserWindow) {
        actions.lineEnding(browserWindow, 'lf')
      }
    }]
  }, {
    type: 'separator'
  }, {
    label: 'Text Direction',
    submenu: [{
      id: 'textDirectionLTRMenuEntry',
      label: 'Left To Right',
      type: 'radio',
      click (menuItem, browserWindow) {
        actions.textDirection(browserWindow, 'ltr')
      }
    }, {
      id: 'textDirectionRTLMenuEntry',
      label: 'Right To Left',
      type: 'radio',
      click (menuItem, browserWindow) {
        actions.textDirection(browserWindow, 'rtl')
      }
    }]
  }]
}
