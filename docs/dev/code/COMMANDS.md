# Commands

A command can execute a procedure and is shown in the command palette or can be run from event bus. We distinguish between static commands that are defined at compile time (maybe completed at runtime) and dynamtic commands that are created at runtime. Static commands are pure objects that are listed as array and most dynamic commands are classes that need access to the editor or other components. Each command can have nestled subcommands that have the same properties like a command. A root command is the command from which all subcommands are loaded that are displayed on screen. You can change the root command by calling `bus.$emit('show-command-palette', <command-reference>)`. Please note: a root command has special requirements such as a `run` method.

**Static command:**

```js
{
  id: 'file.new-tab', // Unique id
  description: 'File: New Tab',
  execute: async () => {
    // Set `null` as first parameter to fake the sender event.
    ipcRenderer.emit('mt::new-untitled-tab', null)
  }
}
```

**Dynamic command:**

You can use either a class or object at runtime to register a command via the bus event `CMD::register-command`. A simple class example can be found below or a more complex [here](https://github.com/marktext/marktext/blob/develop/src/renderer/commands/quickOpen.js).

```js
export class ExampleCommand {
  constructor () {
    this.id = 'example-id'
    this.description = 'Example'
  }

  // Execute the command.
  async execute () {
    // No-op
  }
}

export class Example2Command {
  constructor () {
    this.id = 'example-2-id'
    this.description = 'Example 2'
    this.placeholder = '' // Textbox placeholder (optional)
    this.title = '' // Tooltip (optional)
    this.subcommands = [] // (optional)
    this.subcommandSelectedIndex = -1 // Required if `subcommands` defined (optional)
  }

  // Prepare subcommands and run the command when the entry is set as root.
  // `run` must prepare the `subcommands`.
  // `run` is only required if the command can be loaded as root command. If
  // `execute` and `run` are not defined but `subcommands` is defined the
  // subcommands are automatically loaded when the command is selected. Please
  // note that `subcommands` must be available and the command cannot be loaded
  // as root command when no `run` method is available (optional).
  run = async () => {
    this.subcommands = [{
      id: 'example-2-sub-1',
      description: 'Subcommand 1',
      execute: async () => {
        // No-op
      }
    },
    {
      id: 'example-2-sub-2',
      description: 'Subcommand 2',
      execute: async () => {
        // No-op
      }
    }]
  }

  // Run when the command palette is unloaded and the command is root.
  unload = () => {
    this.subcommands = []
  }

  // Handle search queries when the entry is root. Must return available
  // entries that should be shown in UI. If not defined the default searcher
  // is used (optional).
  search = async query => {
    return []
  }

  // Execute the command. Required but ignore if the parent has a
  // `executeSubcommand` method.
  execute = async () => {
    // The timeout is required to hide the command palette and then show again
    // to prevent issues.
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  // When defined this method is called when a subcommand is executed
  // instead `execute` on subcommand (optional).
  executeSubcommand = async id => {
    // No-op
  }
}
```
