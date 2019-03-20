import dayjs from 'dayjs/esm'
import relativeTime from 'dayjs/esm/plugin/relativeTime'
import 'dayjs/esm/locale/en' // load on demand

dayjs.locale('en') // use Spanish locale globally

dayjs.extend(relativeTime)

export default dayjs