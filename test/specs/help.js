export const removeCustomClass = html => {
  const customClass = ['indented-code-block', 'fenced-code-block', 'task-list-item']
  customClass.forEach(className => {
    if (html.indexOf(className) > -1) {
      const REG_EXP = new RegExp(`class="${className}"`, 'g')
      /* eslint-disable no-useless-escape */
      const REG_EXP_SIMPLE = new RegExp(className + ` \*`, 'g')
      /* eslint-enable no-useless-escape */
      html = html.replace(REG_EXP, '')
        .replace(REG_EXP_SIMPLE, '')
    }
  })
  return html
}
