import * as vscode from 'vscode';

const SECRET_KEY = 'git-commitcraft.apiKey';

export async function getApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
  return secrets.get(SECRET_KEY);
}

export async function deleteApiKey(secrets: vscode.SecretStorage): Promise<void> {
  const existing = await secrets.get(SECRET_KEY);
  if (!existing) {
    vscode.window.showInformationMessage('No API key is currently stored.');
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    'Delete your stored Anthropic API key?',
    { modal: true },
    'Delete'
  );
  if (confirm === 'Delete') {
    await secrets.delete(SECRET_KEY);
    vscode.window.showInformationMessage('API key deleted.');
  }
}

export async function setApiKey(secrets: vscode.SecretStorage): Promise<boolean> {
  const key = await vscode.window.showInputBox({
    prompt: 'Paste your Anthropic API key',
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'sk-ant-...',
  });
  if (!key) {
    return false;
  }
  await secrets.store(SECRET_KEY, key);
  vscode.window.showInformationMessage('API key saved.');
  return true;
}
