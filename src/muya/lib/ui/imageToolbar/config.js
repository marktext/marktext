import editIcon from '../../assets/pngicon/imageEdit/2.png'
import inlineIcon from '../../assets/pngicon/inline_image/2.png'
import leftIcon from '../../assets/pngicon/algin_left/2.png'
import middleIcon from '../../assets/pngicon/algin_center/2.png'
import rightIcon from '../../assets/pngicon/algin_right/2.png'
import deleteIcon from '../../assets/pngicon/image_delete/2.png'

export const getIcons = (translateFn) => {
  const t = typeof translateFn === 'function' ? translateFn : (k) => k
  return [
    { type: 'edit', tooltip: t('editor.image.toolbar.edit'), icon: editIcon },
    { type: 'inline', tooltip: t('editor.image.toolbar.inline'), icon: inlineIcon },
    { type: 'left', tooltip: t('editor.image.toolbar.alignLeft'), icon: leftIcon },
    { type: 'center', tooltip: t('editor.image.toolbar.alignCenter'), icon: middleIcon },
    { type: 'right', tooltip: t('editor.image.toolbar.alignRight'), icon: rightIcon },
    { type: 'delete', tooltip: t('editor.image.toolbar.delete'), icon: deleteIcon }
  ]
}

export default getIcons
