import WindowManager from '../app/windowManager'
import Preference from '../preferences'
import Keybindings from '../keyboard/shortcutHandler'
import AppMenu from '../menu'

class Accessor {

  /**
   * @param {AppEnvironment} appEnvironment The application environment instance.
   */
  constructor(appEnvironment) {
    const userDataPath = appEnvironment.paths.userDataPath

    this.env = appEnvironment
    this.paths = appEnvironment.paths // export paths to make it better accessible
    this.preferences = new Preference(this.paths)
    this.keybindings = new Keybindings(userDataPath)
    this.menu = new AppMenu(this.preferences, this.keybindings, userDataPath)
    this.windowManager = new WindowManager(this.menu, this.preferences)
  }
}

export default Accessor
