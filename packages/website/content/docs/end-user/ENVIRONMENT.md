# Environment

| Name                         | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `MARKTEXT_DEBUG`             | Enable debug mode.                                               |
| `MARKTEXT_DEBUG_KEYBOARD`    | Print more keyboard information when debug mode is enabled.      |
| `MARKTEXT_ERROR_INTERACTION` | Never show the error dialog to report bugs.                      |
| `MARKTEXT_PANDOC`            | Override the Pandoc executable path.                             |
| `MARKTEXT_RIPGREP_PATH`      | Override the ripgrep executable used for file and text searches. |

## Development

| Name                     | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `MARKTEXT_EXIT_ON_ERROR` | Exit on the first error or exception that occurs. |

The boolean switches treat non-empty environment values as enabled, so `MARKTEXT_DEBUG=0`
also enables debug mode. Development mode itself is selected at build time;
setting `NODE_ENV=development` does not turn a packaged release into a dev build.
