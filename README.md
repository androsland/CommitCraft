# CommitCraft

Generate Git commit messages instantly using AI — right from the VS Code Source Control panel.

Supports **Anthropic Claude** (cloud) and **Ollama** (local, free).

---

## Features

- **One-click generation** — a sparkle button appears in the Source Control panel toolbar. Click it to generate a commit message from your current diff.
- **Style matching** — analyzes your last 5 commits and matches your repo's existing style and format.
- **Staged-first** — uses your staged diff if available, falls back to all modified files.
- **Claude or Ollama** — switch between Claude (cloud) and any locally installed Ollama model from the status bar.

---

## Getting Started

### Using Claude (cloud)

1. Install the extension.
2. Open the Command Palette (`Ctrl+Shift+P`) and run **CommitCraft: Set API Key**.
3. Paste your [Anthropic API key](https://console.anthropic.com/).
4. Stage some changes and click the **$(sparkle) sparkle button** in the Source Control toolbar.

### Using Ollama (local, free)

1. Install and start [Ollama](https://ollama.com).
2. Pull a model: `ollama pull llama3.2`
3. Click the model indicator in the status bar (bottom-right) and select your Ollama model.
4. Stage some changes and click the sparkle button.

---

## Commands

| Command | Description |
|---|---|
| `CommitCraft: Generate Commit Message` | Generate and insert a commit message |
| `CommitCraft: Set API Key` | Store your Anthropic API key securely |
| `CommitCraft: Edit API Key` | Replace your stored API key |
| `CommitCraft: Delete API Key` | Remove your stored API key |
| `CommitCraft: Select Model` | Switch between Claude and Ollama models |

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `commitcraft.provider` | `claude` | AI provider: `claude` or `ollama` |
| `commitcraft.ollamaHost` | `http://localhost:11434` | Ollama server URL |
| `commitcraft.ollamaModel` | _(none)_ | Ollama model to use |

---

## Requirements

- **Claude**: An [Anthropic API key](https://console.anthropic.com/) (paid, usage-based)
- **Ollama**: [Ollama](https://ollama.com) installed and running locally with at least one model pulled

---

## Changelog

### 0.1.3
- The sparkle button now animates into a loading spinner while the commit message is being generated, then reverts once done.

### 0.1.2 and earlier
- Initial release with Claude and Ollama support.

---

## License

MIT
