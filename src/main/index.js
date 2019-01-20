import './globalSetting'
import './cli'
import './exceptionHandler'
import { checkSystem } from './utils/checkSystem'
import App from './app'

// NOTE: We only support Linux, macOS and Windows but not BSD nor SunOS.
if (!/^(darwin|win32|linux)$/i.test(process.platform)) {
  console.error(`Operating system "${process.platform}" is not supported! Please open an issue at "https://github.com/marktext/marktext".`)
  process.exit(1)
}

checkSystem()

const app = new App()

app.init()
