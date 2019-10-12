export const toolList = {
  left: [{
    label: 'Insert Row Above',
    action: 'insert',
    location: 'previous',
    target: 'row'
  }, {
    label: 'Insert Row Below',
    action: 'insert',
    location: 'next',
    target: 'row'
  }, {
    label: 'Remove Row',
    action: 'remove',
    location: 'current',
    target: 'row'
  }],
  bottom: [{
    label: 'Insert Column Left',
    action: 'insert',
    location: 'left',
    target: 'column'
  }, {
    label: 'Insert Column Right',
    action: 'insert',
    location: 'right',
    target: 'column'
  }, {
    label: 'Remove Column',
    action: 'remove',
    location: 'current',
    target: 'column'
  }]
}
