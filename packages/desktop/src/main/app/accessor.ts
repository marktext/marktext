import WindowManager from '../app/windowManager'
import Preference from '../preferences'
import EditorBufferStore from '../editorBufferStore'
import DataCenter from '../dataCenter'
import Keybindings from '../keyboard/shortcutHandler'
import AppMenu from '../menu'
import { loadMenuCommands } from '../menu/actions'
import { CommandManager, loadDefaultCommands } from '../commands'
import type { AppEnvironment } from './env'
import type AppPaths from './paths'

class Accessor {
  public env: AppEnvironment
  public paths: AppPaths
  public preferences: Preference
  public dataCenter: DataCenter
  public editorBufferStore: EditorBufferStore
  public commandManager: CommandManager
  public keybindings: Keybindings
  public menu: AppMenu
  public windowManager: WindowManager

  /**
   * @param appEnvironment The application environment instance.
   */
  constructor(appEnvironment: AppEnvironment) {
    const userDataPath = appEnvironment.paths.userDataPath

    this.env = appEnvironment
    this.paths = appEnvironment.paths // export paths to make it better accessible

    this.preferences = new Preference(this.paths)
    this.dataCenter = new DataCenter(this.paths)
    this.editorBufferStore = new EditorBufferStore(this.paths)

    this.commandManager = CommandManager
    this._loadCommands()

    this.keybindings = new Keybindings(this.commandManager, appEnvironment)
    this.menu = new AppMenu(this.preferences, this.keybindings, userDataPath)
    this.windowManager = new WindowManager(this.menu, this.preferences, this.editorBufferStore)
  }

  private _loadCommands(): void {
    const { commandManager } = this
    loadDefaultCommands(commandManager)
    loadMenuCommands(commandManager)

    if (this.env.isDevMode) {
      commandManager.__verifyDefaultCommands()
    }
  }
}

export default Accessor
