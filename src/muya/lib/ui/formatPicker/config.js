import strongIcon from '../../assets/pngicon/format_strong/2.png'
import emphasisIcon from '../../assets/pngicon/format_emphasis/2.png'
import underlineIcon from '../../assets/pngicon/format_underline/2.png'
import codeIcon from '../../assets/pngicon/code/2.png'
import imageIcon from '../../assets/pngicon/format_image/2.png'
import linkIcon from '../../assets/pngicon/format_link/2.png'
import strikeIcon from '../../assets/pngicon/format_strike/2.png'
import mathIcon from '../../assets/pngicon/format_math/2.png'
import clearIcon from '../../assets/pngicon/format_clear/2.png'

const icons = [
  {
    type: 'strong',
    tooltip: 'Emphasize',
    icon: strongIcon
  }, {
    type: 'em',
    tooltip: 'Italic',
    icon: emphasisIcon
  }, {
    type: 'u',
    tooltip: 'Underline',
    icon: underlineIcon
  }, {
    type: 'del',
    tooltip: 'Strikethrough',
    icon: strikeIcon
  }, {
    type: 'inline_code',
    tooltip: 'Inline Code',
    icon: codeIcon
  }, {
    type: 'inline_math',
    tooltip: 'Inline Math',
    icon: mathIcon
  }, {
    type: 'link',
    tooltip: 'Line',
    icon: linkIcon
  }, {
    type: 'image',
    tooltip: 'Image',
    icon: imageIcon
  }, {
    type: 'clear',
    tooltip: 'Eliminate',
    icon: clearIcon
  }
]

export default icons
