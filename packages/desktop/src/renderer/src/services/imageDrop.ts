import { ElMessageBox } from 'element-plus'
import { t } from '../i18n'
import { useEditorStore } from '../store/editor'
import { usePreferencesStore } from '../store/preferences'
import notice from './notification'

let pendingDrop = false

export const resolveDroppedImage = (action: () => Promise<string>): Promise<string> | undefined => {
  const file = useEditorStore().currentFile
  const preferences = usePreferencesStore()
  if (
    file &&
    preferences.imageInsertAction === 'folder' &&
    preferences.imagePreferRelativeDirectory &&
    (!file.pathname || file.isPendingCreation)
  ) {
    return resolveImageAfterSaveChoice(action)
  }
}

const resolveImageAfterSaveChoice = async(action: () => Promise<string>): Promise<string> => {
  if (pendingDrop) return ''
  const editorStore = useEditorStore()
  const file = editorStore.currentFile
  if (!file || file.readOnly || file.modeChanging) return ''
  const isCurrentDocument = () =>
    editorStore.currentFile?.id === file.id &&
    !editorStore.currentFile.readOnly &&
    !editorStore.currentFile.modeChanging

  pendingDrop = true
  try {
    let shouldSave = true
    try {
      await ElMessageBox.confirm(
        t('editor.imageDrop.saveMessage'),
        t('editor.imageDrop.saveTitle'),
        {
          confirmButtonText: t('dialog.save'),
          cancelButtonText: t('common.cancel'),
          closeOnClickModal: false
        }
      )
    } catch (reason) {
      if (reason !== 'cancel' && reason !== 'close') throw reason
      shouldSave = false
    }
    if (!isCurrentDocument()) return ''
    if (shouldSave) {
      const result = await editorStore.SAVE_FILE_FOR_IMAGE()
      if (result.status === 'failed') return ''
    }
    if (!isCurrentDocument()) return ''
    const src = await action()
    return isCurrentDocument() ? src : ''
  } catch (error) {
    console.error('Unable to insert dropped image:', error)
    void notice.notify({ title: t('editor.imageDrop.failed'), type: 'error' })
    return ''
  } finally {
    pendingDrop = false
  }
}
