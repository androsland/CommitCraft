import * as vscode from 'vscode';
import { execFileSync } from 'child_process';

// Minimal type shims for the vscode.git extension public API
interface GitExtension {
  getAPI(version: 1): GitAPI;
}
interface GitAPI {
  git: { path: string };
  repositories: Repository[];
}
interface Repository {
  rootUri: vscode.Uri;
  inputBox: { value: string };
  log(options: { maxEntries: number }): Promise<Commit[]>;
  state: RepositoryState;
}
interface RepositoryState {
  workingTreeChanges: Change[];
}
interface Change {
  uri: vscode.Uri;
  status: number;
}
interface Commit {
  message: string;
}

const STATUS_UNTRACKED = 7;
const MAX_UNTRACKED_BYTES = 50_000;

function runGit(gitPath: string, args: string[], cwd: string): string {
  try {
    return execFileSync(gitPath, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function getGitAPI(): GitAPI {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) {
    throw new Error('No git repository found in workspace.');
  }
  const git = ext.isActive ? ext.exports : (ext as any).activate();
  return git.getAPI(1);
}

export async function getRepo(): Promise<{ repo: Repository; gitPath: string }> {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) {
    throw new Error('No git repository found in workspace.');
  }
  const gitExt = ext.isActive ? ext.exports : await ext.activate();
  const api = gitExt.getAPI(1);
  const gitPath = api.git.path;

  if (!api.repositories.length) {
    throw new Error('No git repository found in workspace.');
  }
  if (api.repositories.length === 1) {
    return { repo: api.repositories[0], gitPath };
  }

  // Auto-select the repo that has staged changes
  const withStaged = api.repositories.filter(
    (r) => runGit(gitPath, ['diff', '--staged', '--name-only'], r.rootUri.fsPath).trim() !== ''
  );
  if (withStaged.length === 1) {
    return { repo: withStaged[0], gitPath };
  }

  // Fall back to quick pick if zero or multiple repos have staged changes
  const candidates = withStaged.length ? withStaged : api.repositories;
  const items = candidates.map((r) => ({
    label: vscode.workspace.asRelativePath(r.rootUri, false),
    repo: r,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select repository to generate commit message for',
  });
  if (!picked) {
    throw new Error('No repository selected.');
  }
  return { repo: picked.repo, gitPath };
}

async function untrackedDiff(repo: Repository): Promise<string> {
  const untracked = repo.state.workingTreeChanges.filter(
    (c) => c.status === STATUS_UNTRACKED
  );
  if (!untracked.length) {
    return '';
  }

  const parts: string[] = [];
  for (const change of untracked) {
    const raw = await vscode.workspace.fs.readFile(change.uri);
    if (raw.byteLength > MAX_UNTRACKED_BYTES) {
      parts.push(`new file: ${change.uri.fsPath} (too large to inline)`);
      continue;
    }
    const content = new TextDecoder().decode(raw);
    const lines = content.split('\n').map((l: string) => `+${l}`).join('\n');
    parts.push(`diff --git a/${change.uri.fsPath} b/${change.uri.fsPath}\nnew file mode 100644\n--- /dev/null\n+++ b/${change.uri.fsPath}\n${lines}`);
  }
  return parts.join('\n\n');
}

export async function getDiff(repo: Repository, gitPath: string): Promise<string> {
  const cwd = repo.rootUri.fsPath;

  const staged = runGit(gitPath, ['diff', '--staged'], cwd);
  if (staged.trim()) {
    return staged;
  }

  const unstaged = runGit(gitPath, ['diff'], cwd);
  if (unstaged.trim()) {
    return unstaged;
  }

  return untrackedDiff(repo);
}

export async function getRecentCommits(repo: Repository): Promise<string> {
  try {
    const commits = await repo.log({ maxEntries: 5 });
    return commits.map((c) => c.message.split('\n')[0]).join('\n');
  } catch {
    return '';
  }
}

export function setInputBox(repo: Repository, value: string): void {
  repo.inputBox.value = value;
}
