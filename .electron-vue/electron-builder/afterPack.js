'use strict'
const fs = require('fs')
const path = require('path')
const { exec: execNode  } = require("child_process")
const util = require('util')

const exec = util.promisify(execNode)

// interface AfterPackContext {
//   outDir: string
//   appOutDir: string
//   packager: PlatformPackager<any>
//   electronPlatformName: string
//   arch: Arch
//   targets: Array<Target>
// }

/**
 *
 * @param {AfterPackContext} context
 */
const afterPack = async (context) => {
  // Workaround to remove debug information from production binaries on Linux (Electron#32669).
  if (context.packager.platform.name === 'linux') {
    console.log('[afterPack] Removing Electron debug information on Linux')

    const { appOutDir } = context
    const chromeCrashpadHandlerPath = path.join(appOutDir, 'chrome_crashpad_handler')
    const libvkPath = path.join(appOutDir, 'libvk_swiftshader.so')

    if (fs.existsSync(chromeCrashpadHandlerPath)) {
      const { err } = await exec(`strip "${chromeCrashpadHandlerPath}"`)
      if (err) {
        console.log('[afterPack] Unable to strip "chrome_crashpad_handler".')
      }
    } else {
      console.log(`[afterPack] "chrome_crashpad_handler" doesn't exists: "${chromeCrashpadHandlerPath}".`)
    }

    if (fs.existsSync(libvkPath)) {
      const { err } = await exec(`strip "${libvkPath}"`)
      if (err) {
        console.log('[afterPack] Unable to strip "libvk_swiftshader.so".')
      }
    } else {
      console.log(`[afterPack] "libvk_swiftshader.so" doesn't exists: "${libvkPath}".`)
    }
  }
}

exports.default = afterPack
