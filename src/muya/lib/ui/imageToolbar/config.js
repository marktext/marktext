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
    type: 'inline',
    tooltip: 'Inline Image',
    icon: inlineIcon
  },
  {
    type: 'left',
    tooltip: 'Align Left',
    icon: leftIcon
  },
  {
    type: 'center',
    tooltip: 'Align Middle',
    icon: middleIcon
  },
  {
    type: 'right',
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
