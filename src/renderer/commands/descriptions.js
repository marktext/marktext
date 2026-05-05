import i18n from '@/i18n'

export default id => {
  if (typeof id !== 'string') return ''
  const key = `cmd.${id}`
  return i18n.t(key) || key
}
