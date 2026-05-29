# Portable Mode

MarkText stores all user configuration inside the [application data directory](APPLICATION_DATA_DIRECTORY.md) that can be changed with `--user-data-dir` command-line flag.

## Linux and Windows

On Linux and Windows you can also create a directory called `marktext-user-data` to save all user data inside the directory. Like:

```
marktext-portable/
 ├── marktext (Linux) or MarkText.exe (Windows)
 ├── marktext-user-data/
 ├── resources/
 ├── THIRD-PARTY-LICENSES.txt
 └── ...
```
