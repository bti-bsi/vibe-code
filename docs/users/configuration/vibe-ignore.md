# Ignoring Files

This document provides an overview of the Vibe Ignore (`.vibeignore`) feature of Vibe Code.

Vibe Code includes the ability to automatically ignore files, similar to `.gitignore` (used by Git). Adding paths to your `.vibeignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.vibeignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](../../developers/tools/multi-file) command, any paths in your `.vibeignore` file will be automatically excluded.

For the most part, `.vibeignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.vibeignore` file.
- `!` negates a pattern.

You can update your `.vibeignore` file at any time. To apply the changes, you must restart your Vibe Code session.

## How to use `.vibeignore`

| Step                   | Description                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Enable .vibeignore** | Create a file named `.vibeignore` in your project root directory                       |
| **Add ignore rules**   | Open `.vibeignore` file and add paths to ignore, example: `/archive/` or `apikeys.txt` |

### `.vibeignore` examples

You can use `.vibeignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.vibeignore` file with `*`:

```
# Exclude all .md files
*.md
```

Finally, you can exclude files and directories from exclusion with `!`:

```
# Exclude all .md files except README.md
*.md
!README.md
```

To remove paths from your `.vibeignore` file, delete the relevant lines.
