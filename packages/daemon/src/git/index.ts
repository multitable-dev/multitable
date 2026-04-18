import simpleGit from 'simple-git';

export async function getDiff(projectPath: string): Promise<string> {
  const git = simpleGit(projectPath);
  return git.diff(['HEAD']);
}

export async function getStatus(projectPath: string) {
  const git = simpleGit(projectPath);
  return git.status();
}

export async function getLog(projectPath: string, maxCount = 20) {
  const git = simpleGit(projectPath);
  return git.log({ maxCount });
}

export async function getBranch(projectPath: string) {
  const git = simpleGit(projectPath);
  return git.branch();
}

export async function getStagedDiff(projectPath: string): Promise<string> {
  const git = simpleGit(projectPath);
  return git.diff(['--cached']);
}
