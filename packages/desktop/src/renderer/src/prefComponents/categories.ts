import {
  Setting, Brush, Edit, FolderOpened, Document, Picture, Operation
} from '@element-plus/icons-vue'

export const preferenceCategories = [
  { id: 'general', icon: Setting },
  { id: 'appearance', icon: Brush },
  { id: 'editor', icon: Edit },
  { id: 'files', icon: FolderOpened },
  { id: 'markdown', icon: Document },
  { id: 'images', icon: Picture },
  { id: 'keybindings', icon: Operation }
] as const
export type PreferenceCategoryId = (typeof preferenceCategories)[number]['id']

export const generalGroups: Partial<Record<PreferenceCategoryId, readonly string[]>> = {
  general: ['opening', 'windowOpening', 'language'],
  appearance: ['windowAppearance'],
  files: ['save', 'navigation', 'recovery'],
  images: ['pandoc']
}
export const editorGroups: Partial<Record<PreferenceCategoryId, readonly string[]>> = {
  appearance: ['typography'],
  editor: ['writing', 'code'],
  files: ['files']
}
