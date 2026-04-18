import { useAppStore } from '../stores/appStore';

export function useProcess(processId: string | null) {
  const sessions = useAppStore(s => s.sessions);
  const commands = useAppStore(s => s.commands);
  const terminals = useAppStore(s => s.terminals);

  if (!processId) return null;
  return sessions[processId] ?? commands[processId] ?? terminals[processId] ?? null;
}
