import fs from 'fs'
import path from 'path'
import { Menu } from 'electron'

const JSON_REG = /```json(.+)```/g
const preferencePath = path.join(__static, 'preference.md')
let PREFERENCE_CACHE = null

export const getMenuItem = menuName => {
  const menus = Menu.getApplicationMenu()
  return menus.items.find(menu => menu.label === menuName)
}

export const getUserPreference = () => {
  if (PREFERENCE_CACHE) {
    return PREFERENCE_CACHE
  } else {
    const content = fs.readFileSync(preferencePath, 'utf-8')
    try {
      const userSetting = JSON_REG.exec(content.replace(/\n/g, ''))[1]
      PREFERENCE_CACHE = JSON.parse(userSetting)
      return PREFERENCE_CACHE
    } catch (err) {
      // todo notice the user
      console.log(err)
    }
  }
}

export const setUserPreference = (key, value) => {
  const preUserSetting = getUserPreference()
  const newUserSetting = PREFERENCE_CACHE = Object.assign({}, preUserSetting, { [key]: value })

  return new Promise((resolve, reject) => {
    const content = fs.readFileSync(preferencePath, 'utf-8')
    const tokens = content.split('```')
    const newContent = tokens[0] +
      '```json\n' +
      JSON.stringify(newUserSetting, null, 2) +
      '\n```' +
      tokens[2]
    fs.writeFile(preferencePath, newContent, 'utf-8', err => {
      if (err) reject(err)
      else resolve(newUserSetting)
    })
  })
}
