import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { wsClient } from '../../../lib/ws';
import type { ProcessState } from '../../../lib/types';
import { useAppStore } from '../../../stores/appStore';
import { BUILTIN_THEMES } from '../../../lib/themes';
import { buildCmTheme } from '../../../lib/cm-theme';
import {
  fileMentionSource,
  warmProjectIndex,
} from '../../../lib/cm-completions';
import { uploadAttachment, quotePath } from '../../../lib/attachments';

import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  placeholder,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  LanguageDescription,
} from '@codemirror/language';
import { languages as lezerLanguages } from '@codemirror/language-data';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

// Languages we want available inside fenced code blocks. We cherry-pick from
// @codemirror/language-data by name — those descriptions are lazy-loaded at
// runtime when a fence of that language actually appears in the doc.
const FENCE_LANGS: LanguageDescription[] = lezerLanguages.filter((d) =>
  [
    'JavaScript', 'TypeScript', 'JSX', 'TSX',
    'Python', 'Rust', 'Go', 'C++', 'C',
    'JSON', 'YAML', 'TOML',
    'CSS', 'HTML', 'Vue', 'Svelte',
    'SQL', 'Shell', 'Bash',
    'Markdown',
  ].includes(d.name)
);

interface Props {
  processId: string;
  projectId: string;
  state: ProcessState;
  attachmentKind: 'session' | 'terminal';
  placeholder?: string;
}

// Detect a language hint from an arbitrary clipboard blob. Cheap heuristics
// keyed on obvious shebangs / top-of-file syntax. Returns '' if we're not
// confident — callers fall back to an unadorned fence.
function detectLang(text: string): string {
  const s = text.trimStart();
  if (/^#!.*\b(bash|sh|zsh)\b/.test(s)) return 'bash';
  if (/^#!.*\bpython/.test(s)) return 'python';
  if (/^#!.*\bnode/.test(s)) return 'javascript';
  if (/^(import\s+.*\bfrom\b|export\s+(default\s+)?(function|class|const|let))/m.test(s)) return 'typescript';
  if (/^\s*(def\s+\w+\s*\(|class\s+\w+\s*:|from\s+\w|import\s+\w)/m.test(s)) return 'python';
  if (/^\s*(package\s+main|func\s+\w+\()/m.test(s)) return 'go';
  if (/^\s*(fn\s+\w+\s*\(|use\s+\w|impl\s+\w)/m.test(s)) return 'rust';
  if (/^\s*{[\s\S]*}\s*$/m.test(s) && /"\s*:/.test(s)) return 'json';
  if (/<\/?[a-z][\s\S]*>/i.test(s)) return 'html';
  if (/^\s*SELECT\s+.*FROM\s+/im.test(s)) return 'sql';
  return '';
}

function detectLangFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', c: 'c', cc: 'cpp', cpp: 'cpp', h: 'c',
    json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml',
    css: 'css', html: 'html', vue: 'vue', svelte: 'svelte',
    sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
    md: 'markdown',
  };
  return (ext && map[ext]) || '';
}

export const ChatInputCM = memo(function ChatInputCM({
  processId,
  projectId,
  state,
  attachmentKind,
  placeholder: placeholderText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onSendRef = useRef<() => boolean>(() => false);
  const disabledRef = useRef(false);

  const [hasText, setHasText] = useState(false);
  // Sessions are SDK-driven: 'stopped'/'idle' means "ready to start a new turn",
  // 'running' means a turn is in flight (block sends to avoid 409s), 'errored'
  // means the last turn failed and needs explicit recovery.
  const disabled = state === 'errored' || state === 'running';
  disabledRef.current = disabled;

  // Keep project id reachable by the file-mention completion source — it
  // reads it lazily so we don't have to re-create extensions when the user
  // switches projects.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const activeThemeId = useAppStore((s) => s.activeThemeId);
  const customThemes = useAppStore((s) => s.customThemes);

  const themeCompartment = useRef(new Compartment());
  const editableCompartment = useRef(new Compartment());

  const pickTheme = useCallback(() => {
    const all = [...BUILTIN_THEMES, ...customThemes];
    const active = all.find((tt) => tt.id === activeThemeId);
    return buildCmTheme(active?.isDark ?? true);
  }, [activeThemeId, customThemes]);

  // Warm the project file index in the background so the first '@' keystroke
  // doesn't stall on a fresh walk.
  useEffect(() => {
    if (projectId) warmProjectIndex(projectId);
  }, [projectId]);

  // Mount CodeMirror once. Extensions that need to react to React state go
  // through Compartments (theme, editable) so we never recreate the view.
  useEffect(() => {
    if (!containerRef.current) return;

    const doSend = (): boolean => {
      if (disabledRef.current) return false;
      const view = viewRef.current;
      if (!view) return false;
      const text = view.state.doc.toString().trim();
      if (!text) return false;
      wsClient.sendTurn(processId, text);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
      });
      return true;
    };
    onSendRef.current = doSend;

    const uploadFile = async (file: File) => {
      if (!file.type.startsWith('image/')) return false;
      const id = toast.loading(`Uploading ${file.name || 'image'}…`);
      try {
        const res = await uploadAttachment(attachmentKind, processId, file);
        const injected = quotePath(res.path) + ' ';
        const view = viewRef.current;
        if (view) {
          view.dispatch(view.state.replaceSelection(injected));
          view.focus();
        }
        toast.success(`Attached ${res.filename}`, { id });
      } catch (err: any) {
        toast.error(`Upload failed: ${err?.message ?? err}`, { id });
      }
      return true;
    };

    const composerKeymap = keymap.of([
      {
        key: 'Enter',
        run: () => doSend(),
      },
      {
        key: 'Mod-Enter',
        run: () => doSend(),
      },
      {
        key: 'Shift-Enter',
        run: (v) => {
          v.dispatch(v.state.replaceSelection('\n'));
          return true;
        },
      },
    ]);

    const domHandlers = EditorView.domEventHandlers({
      paste: (event, view) => {
        // 1) Image paste → upload as attachment, inject quoted path.
        const items = event.clipboardData?.items ?? [];
        for (const it of Array.from(items)) {
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f && f.type.startsWith('image/')) {
              event.preventDefault();
              void uploadFile(f);
              return true;
            }
          }
        }
        // 2) Multi-line text paste → wrap in a fenced code block with a
        //    detected language hint. Single-line pastes fall through so the
        //    user can still paste short snippets inline.
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (!text.includes('\n')) return false;

        // Respect the user's explicit choice if they already have a fence
        // marker on the current line — don't double-wrap.
        const head = view.state.sliceDoc(
          Math.max(0, view.state.selection.main.from - 3),
          view.state.selection.main.from
        );
        if (head.includes('```')) return false;

        const lang = detectLang(text);
        const fence = '```' + lang + '\n' + text.replace(/\n$/, '') + '\n```\n';
        event.preventDefault();
        view.dispatch(view.state.replaceSelection(fence));
        return true;
      },
      drop: (event, view) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        view.focus();
        void Promise.all(images.map((f) => uploadFile(f)));
        return true;
      },
      dragover: (event) => {
        if (event.dataTransfer?.types.includes('Files')) {
          event.preventDefault();
        }
        return false;
      },
    });

    const updateListener = EditorView.updateListener.of((vu) => {
      if (vu.docChanged) {
        setHasText(vu.state.doc.length > 0);
      }
    });

    const extensions = [
      // History & selection
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSpecialChars(),
      EditorView.lineWrapping,
      EditorState.allowMultipleSelections.of(true),
      // Language
      markdown({
        base: markdownLanguage,
        codeLanguages: FENCE_LANGS,
        addKeymap: false,
      }),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightSelectionMatches(),
      // Autocomplete — file mentions (@) and slash commands (/)
      autocompletion({
        // Slash-command autocomplete was deliberately dropped: Claude Code's
        // slash commands are interactive TUI features (modals, pickers,
        // ephemeral output) that don't round-trip through a raw stdin pipe.
        // Submitting one from the chat view silently opens a modal that then
        // eats the user's next message. File mentions are fine — they're
        // just text insertion.
        override: [fileMentionSource(() => projectIdRef.current || null)],
        activateOnTyping: true,
        defaultKeymap: true,
        maxRenderedOptions: 40,
        icons: true,
      }),
      // Placeholder
      placeholder(placeholderText ?? 'Message the agent…  Enter to send · Shift+Enter for newline · @ for files'),
      // Keymap ordering matters — CM6 tries bindings in registration order
      // and the first one that returns true wins. We put completion's Enter
      // FIRST so it can accept a suggestion when the popup is open; only
      // when no completion is active does the composer's Enter fall through
      // to send the message.
      keymap.of([
        ...closeBracketsKeymap,
        ...completionKeymap,
      ]),
      composerKeymap,
      keymap.of([
        ...searchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
        indentWithTab,
      ]),
      // Event handlers
      domHandlers,
      updateListener,
      // Compartments for live-reconfigurable extensions
      themeCompartment.current.of(pickTheme()),
      editableCompartment.current.of(EditorView.editable.of(!disabled)),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: '', extensions }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    // Focus on mount so the composer feels immediately actionable.
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId, attachmentKind]); // intentionally omit pickTheme/disabled/placeholderText — handled via compartments

  // Reconfigure theme when the active theme changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(pickTheme()),
    });
  }, [pickTheme]);

  // Reconfigure editable flag on state transitions.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.current.reconfigure(
        EditorView.editable.of(!disabled)
      ),
    });
  }, [disabled]);

  // Global Cmd/Ctrl+K → focus the composer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Don't hijack if user is typing in another input/textarea.
        const el = document.activeElement as HTMLElement | null;
        const inField =
          el &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (inField && el !== containerRef.current && !containerRef.current?.contains(el)) return;
        e.preventDefault();
        viewRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onAttachClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        const id = toast.loading(`Uploading ${f.name}…`);
        try {
          const res = await uploadAttachment(attachmentKind, processId, f);
          const view = viewRef.current;
          if (view) {
            view.dispatch(view.state.replaceSelection(quotePath(res.path) + ' '));
            view.focus();
          }
          toast.success(`Attached ${res.filename}`, { id });
        } catch (err: any) {
          toast.error(`Upload failed: ${err?.message ?? err}`, { id });
        }
      }
    };
    input.click();
  };

  // Also handle a handy hint for paste language when user pastes a file — not
  // wired by default because pasting a file reference from the filesystem is
  // not common. Exposed here for future extension.
  void detectLangFromFilename;

  const canSend = hasText && !disabled;

  return (
    <div
      style={{
        padding: '10px 14px 14px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-sidebar)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }}
      >
        <button
          onClick={onAttachClick}
          disabled={disabled}
          title="Attach image"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          <Paperclip size={14} />
        </button>

        <div
          ref={containerRef}
          className="mt-cm-composer"
          style={{
            flex: 1,
            minHeight: 28,
            maxHeight: '40vh',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'stretch',
            opacity: disabled ? 0.55 : 1,
          }}
        />

        <button
          onClick={() => onSendRef.current()}
          disabled={!canSend}
          title={canSend ? 'Send (Enter)' : disabled ? 'Session not running' : 'Type a message'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: canSend ? 'var(--accent-blue)' : 'var(--bg-hover)',
            color: canSend ? '#fff' : 'var(--text-muted)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            transition: 'background-color var(--dur-fast) var(--ease-out)',
          }}
        >
          <Send size={14} />
        </button>
      </div>

      {disabled && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {state === 'errored'
            ? 'Session errored — last turn failed. Send a new message to retry.'
            : 'A turn is in flight — wait for it to finish.'}
        </div>
      )}
    </div>
  );
});
