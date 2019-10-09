export const toolList = {
  left: [{
    label: 'Insert Previous Row',
    action: 'insert',
    location: 'previous',
    target: 'row'
  }, {
    label: 'Insert Next Row',
    action: 'insert',
    location: 'next',
    target: 'row'
  }, {
    label: 'Remove One Row',
    action: 'remove',
    location: 'current',
    target: 'row'
  }],
  bottom: [{
    label: 'Insert Left Column',
    action: 'insert',
    location: 'left',
    target: 'column'
  }, {
    label: 'Insert Right Column',
    action: 'insert',
    location: 'right',
    target: 'column'
  }, {
    label: 'Remove One Column',
    action: 'remove',
    location: 'current',
    target: 'column'
  }]
}
