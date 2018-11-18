import './globalSetting'
import './cli'
import './exceptionHandler'
import { checkSystem } from './utils/checkSystem'
import App from './app'

checkSystem()

const app = new App()

app.init()
