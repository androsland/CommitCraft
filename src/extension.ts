import * as vscode from 'vscode';
import { getApiKey, setApiKey, deleteApiKey } from './apiKey';
import { getRepo, getDiff, getRecentCommits, setInputBox } from './git';
import { buildPrompt, callClaude, CLAUDE_MODEL_DISPLAY } from './generate';
import { isOllamaRunning, getOllamaModels, callOllama } from './ollama';

type ModelPickItem = vscode.QuickPickItem & { providerId?: string };

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('git-commitcraft');
  return {
    provider: cfg.get<string>('provider', 'claude'),
    ollamaHost: cfg.get<string>('ollamaHost', 'http://localhost:11434'),
    ollamaModel: cfg.get<string>('ollamaModel', ''),
  };
}

function modelBarLabel(provider: string, ollamaModel: string): string {
  if (provider === 'ollama') {
    return `$(server-environment) Ollama: ${ollamaModel || 'not set'}`;
  }
  return `$(sparkle) ${CLAUDE_MODEL_DISPLAY}`;
}

export function activate(context: vscode.ExtensionContext) {
  // Persistent right-side status bar showing current model — click to change
  const modelBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  modelBar.command = 'git-commitcraft.selectModel';
  modelBar.tooltip = 'Click to change AI model for commit message generation';
  context.subscriptions.push(modelBar);

  function refreshModelBar() {
    const { provider, ollamaModel } = getConfig();
    modelBar.text = modelBarLabel(provider, ollamaModel);
    modelBar.show();
  }
  refreshModelBar();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('git-commitcraft')) {
        refreshModelBar();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('git-commitcraft.setApiKey', () =>
      setApiKey(context.secrets)
    ),

    vscode.commands.registerCommand('git-commitcraft.editApiKey', () =>
      setApiKey(context.secrets)
    ),

    vscode.commands.registerCommand('git-commitcraft.deleteApiKey', () =>
      deleteApiKey(context.secrets)
    ),

    vscode.commands.registerCommand('git-commitcraft.selectModel', async () => {
      const { ollamaHost } = getConfig();
      const apiKey = await getApiKey(context.secrets);

      const items: ModelPickItem[] = [];

      items.push({
        label: `$(sparkle) ${CLAUDE_MODEL_DISPLAY}`,
        description: 'Anthropic API',
        detail: apiKey ? 'API key is set' : '⚠ No API key — use "Set API Key" command first',
        providerId: 'claude',
      });

      items.push({ label: 'Local Ollama Models', kind: vscode.QuickPickItemKind.Separator });

      const ollamaRunning = await isOllamaRunning(ollamaHost);
      if (ollamaRunning) {
        const models = await getOllamaModels(ollamaHost);
        if (models.length) {
          for (const m of models) {
            items.push({
              label: `$(server-environment) ${m}`,
              description: 'Local Ollama model',
              providerId: `ollama:${m}`,
            });
          }
        } else {
          items.push({
            label: 'No Ollama models installed',
            detail: 'Run: ollama pull <model>  (e.g. ollama pull llama3.2)',
          });
        }
      } else {
        items.push({
          label: 'Ollama not detected',
          detail: `Ollama is not running at ${ollamaHost}. Start it or update the host in Settings.`,
        });
      }

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select AI provider and model',
        matchOnDescription: true,
      });

      if (!picked?.providerId) {
        return;
      }

      const cfg = vscode.workspace.getConfiguration('git-commitcraft');
      if (picked.providerId === 'claude') {
        await cfg.update('provider', 'claude', vscode.ConfigurationTarget.Global);
      } else {
        const model = picked.providerId.slice('ollama:'.length);
        await cfg.update('provider', 'ollama', vscode.ConfigurationTarget.Global);
        await cfg.update('ollamaModel', model, vscode.ConfigurationTarget.Global);
      }
      refreshModelBar();
    }),

    vscode.commands.registerCommand('git-commitcraft.generate', async () => {
      const { provider, ollamaHost, ollamaModel } = getConfig();
      let apiKey: string | undefined;

      if (provider === 'ollama') {
        if (!ollamaModel) {
          const action = await vscode.window.showErrorMessage(
            'No Ollama model selected.',
            'Select Model'
          );
          if (action === 'Select Model') {
            await vscode.commands.executeCommand('git-commitcraft.selectModel');
          }
          return;
        }
        const running = await isOllamaRunning(ollamaHost);
        if (!running) {
          vscode.window.showErrorMessage(
            `Ollama is not running at ${ollamaHost}. Start Ollama and try again.`
          );
          return;
        }
      } else {
        apiKey = await getApiKey(context.secrets);
        if (!apiKey) {
          const action = await vscode.window.showErrorMessage(
            'No Anthropic API key set.',
            'Set API Key'
          );
          if (action === 'Set API Key') {
            const saved = await setApiKey(context.secrets);
            if (!saved) {
              return;
            }
            apiKey = await getApiKey(context.secrets);
          }
          if (!apiKey) {
            return;
          }
        }
      }

      let repo: Awaited<ReturnType<typeof getRepo>>;
      try {
        repo = await getRepo();
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to find git repository.'
        );
        return;
      }

      let diff: string;
      try {
        diff = await getDiff(repo.repo, repo.gitPath);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to read git diff.'
        );
        return;
      }

      if (!diff) {
        vscode.window.showInformationMessage('No changes found to generate a message for.');
        return;
      }

      const recentCommits = await getRecentCommits(repo.repo);
      const prompt = buildPrompt(diff, recentCommits);

      const modelDesc =
        provider === 'ollama' ? `Ollama: ${ollamaModel}` : CLAUDE_MODEL_DISPLAY;

      const spinner = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
      spinner.text = `$(loading~spin) Generating via ${modelDesc}...`;
      spinner.show();

      try {
        let message: string;
        if (provider === 'ollama') {
          message = await callOllama(ollamaHost, ollamaModel, prompt);
        } else {
          message = await callClaude(apiKey!, prompt);
        }
        setInputBox(repo.repo, message);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          `${modelDesc} error: ` + (err instanceof Error ? err.message : String(err))
        );
      } finally {
        spinner.dispose();
      }
    })
  );
}

export function deactivate() {}
