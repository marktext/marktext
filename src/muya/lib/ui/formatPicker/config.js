import strongIcon from '../../assets/icons/format_strong.svg'
import emphasisIcon from '../../assets/icons/format_emphasis.svg'
import codeIcon from '../../assets/icons/format_code.svg'
import imageIcon from '../../assets/icons/format_image.svg'
import linkIcon from '../../assets/icons/format_link.svg'
import strikeIcon from '../../assets/icons/format_strike.svg'
import mathIcon from '../../assets/icons/format_math.svg'
import clearIcon from '../../assets/icons/format_clear.svg'

const icons = [
  {
    type: 'strong',
    icon: strongIcon
  }, {
    type: 'em',
    icon: emphasisIcon
  }, {
    type: 'del',
    icon: strikeIcon
  }, {
    type: 'inline_code',
    icon: codeIcon
  }, {
    type: 'link',
    icon: linkIcon
  }, {
    type: 'image',
    icon: imageIcon
  }, {
    type: 'inline_math',
    icon: mathIcon
  }, {
    type: 'clear',
    icon: clearIcon
  }
]

export default icons
