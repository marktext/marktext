const ID_PREFIX = 'ag-'
let id = 0

export const getUniqueId = () => `${ID_PREFIX}${id++}`

export const getLongUniqueId = () => `${getUniqueId()}-${(+new Date()).toString(32)}`
