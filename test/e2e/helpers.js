const os = require('os')
const path = require('path')
const { _electron } = require('playwright')

const projectRoot = path.resolve(__dirname, '../..')

const getDateAsFilename = () => {
  const date = new Date()
  return '' + date.getFullYear() + (date.getMonth() + 1) + date.getDay()
}

const getTempPath = () => {
  const name = 'marktext-e2etest-' + getDateAsFilename() + '-' + Math.random().toString(36).slice(2, 8)
  return path.join(os.tmpdir(), name)
}

const getElectronPath = () => {
  if (process.platform === 'win32') {
    return path.resolve(path.join('node_modules', '.bin', 'electron.cmd'))
  }
  const pathTxt = path.join(projectRoot, 'node_modules/electron/path.txt')
  const relPath = require('fs').readFileSync(pathTxt, 'utf-8').trim()
  return path.join(projectRoot, 'node_modules/electron/dist', relPath)
}

const launchElectron = async userArgs => {
  userArgs = userArgs || []
  const executablePath = getElectronPath()
  // Pass project root as entry so Electron reads package.json and getAppPath() returns project root.
  // Passing out/main/index.js directly bypasses package.json and breaks __static path resolution.
  const args = [projectRoot, '--user-data-dir', getTempPath()].concat(userArgs)
  const app = await _electron.launch({
    executablePath,
    args,
    cwd: projectRoot,
    env: { ...process.env, PERF_TESTING: 'true' },
    timeout: 30000
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { app, page }
}

module.exports = { getElectronPath, launchElectron }
