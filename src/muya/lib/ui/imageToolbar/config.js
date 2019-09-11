import editIcon from '../../assets/pngicon/imageEdit/2.png'
import inlineIcon from '../../assets/pngicon/inline_image/2.png'
import leftIcon from '../../assets/pngicon/algin_left/2.png'
import middleIcon from '../../assets/pngicon/algin_center/2.png'
import rightIcon from '../../assets/pngicon/algin_right/2.png'
import deleteIcon from '../../assets/pngicon/delete/2.png'

const icons = [
  {
    type: 'edit',
    tooltip: 'Edit Image',
    icon: editIcon
  },
  {
    type: 'inlineImage',
    tooltip: 'Inline Image',
    icon: inlineIcon
  },
  {
    type: 'alignLeft',
    tooltip: 'Align Left',
    icon: leftIcon
  },
  {
    type: 'alignMiddle',
    tooltip: 'Align Middle',
    icon: middleIcon
  },
  {
    type: 'alignRight',
    tooltip: 'Align Right',
    icon: rightIcon
  },
  {
    type: 'delete',
    tooltip: 'Remove Image',
    icon: deleteIcon
  }
]

export default icons
