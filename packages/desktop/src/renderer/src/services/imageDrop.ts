import { ElMessageBox } from 'element-plus'
import { t } from '../i18n'
import { useEditorStore } from '../store/editor'
import { usePreferencesStore } from '../store/preferences'
import notice from './notification'

let pendingDrop = false

export const beforeImageDrop = (): Promise<boolean> | undefined => {
  const editorStore = useEditorStore()
  const file = editorStore.currentFile
  const preferences = usePreferencesStore()
  if (!file || preferences.imageInsertAction !== 'folder' ||
    !preferences.imagePreferRelativeDirectory || (file.pathname && !file.isPendingCreation)) return
  if (pendingDrop || file.readOnly || file.modeChanging) return Promise.resolve(false)
  const isCurrentDocument = () => editorStore.currentFile?.id === file.id &&
    !editorStore.currentFile.readOnly && !editorStore.currentFile.modeChanging

  pendingDrop = true
  return ElMessageBox.confirm(t('editor.imageDrop.saveMessage'), t('editor.imageDrop.saveTitle'), {
    confirmButtonText: t('dialog.save'),
    cancelButtonText: t('common.cancel'),
    closeOnClickModal: false
  }).then(async() => {
    if (!isCurrentDocument()) return false
    const result = await editorStore.FILE_SAVE({ waitForResult: true })
    return !!result && result.status !== 'failed' && isCurrentDocument()
  }, (reason) => {
    if (reason !== 'cancel' && reason !== 'close') throw reason
    return isCurrentDocument()
  }).catch((error) => {
    console.error('Unable to prepare image drop:', error)
    void notice.notify({ title: t('editor.imageDrop.failed'), type: 'error' })
    return false
  }).finally(() => { pendingDrop = false })
}
