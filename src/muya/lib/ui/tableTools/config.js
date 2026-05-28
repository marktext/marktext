export const getToolList = (t) => {
  return {
    left: [{
      label: t('editor.insertRowAbove'),
      action: 'insert',
      location: 'previous',
      target: 'row'
    }, {
      label: t('editor.insertRowBelow'),
      action: 'insert',
      location: 'next',
      target: 'row'
    }, {
      label: t('editor.removeRow'),
      action: 'remove',
      location: 'current',
      target: 'row'
    }],
    bottom: [{
      label: t('editor.insertColumnLeft'),
      action: 'insert',
      location: 'left',
      target: 'column'
    }, {
      label: t('editor.insertColumnRight'),
      action: 'insert',
      location: 'right',
      target: 'column'
    }, {
      label: t('editor.removeColumn'),
      action: 'remove',
      location: 'current',
      target: 'column'
    }]
  }
}
