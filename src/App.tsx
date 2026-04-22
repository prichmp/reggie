import { useEffect, useMemo, useState } from "react";
import { RegexInput } from "./components/RegexInput";
import { SubjectEditor } from "./components/SubjectEditor";
import { Toolbar, type Mode } from "./components/Toolbar";
import { ReplacePanel } from "./components/ReplacePanel";
import { ListPanel } from "./components/ListPanel";
import { compileRegex, runRegex } from "./lib/runRegex";
import { applyReplace } from "./lib/applyReplace";
import { applyList } from "./lib/applyList";
import type { MatchResult } from "./types";
import styles from "./styles/app.module.css";

const STORAGE_KEY = "reggie:v1";
const SUBJECT_MAX_BYTES = 1_000_000;

interface PersistedState {
  pattern: string;
  flags: string;
  subject: string;
  mode: Mode;
  replaceTemplate: string;
  listTemplate: string;
}

const DEFAULTS: PersistedState = {
  pattern: "(?<word>\\w+)",
  flags: "gi",
  subject: "Hello world — try editing this subject or the regex above.",
  mode: "replace",
  replaceTemplate: "[$&]",
  listTemplate: "$&",
};

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function useDebounced<T>(value: T, delay = 80): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export function App() {
  const initial = useMemo(loadPersisted, []);
  const [pattern, setPattern] = useState(initial.pattern);
  const [flags, setFlags] = useState(initial.flags);
  const [subject, setSubject] = useState(initial.subject);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [replaceTemplate, setReplaceTemplate] = useState(initial.replaceTemplate);
  const [listTemplate, setListTemplate] = useState(initial.listTemplate);

  useEffect(() => {
    const subjectToStore = subject.length > SUBJECT_MAX_BYTES ? "" : subject;
    const payload: PersistedState = {
      pattern,
      flags,
      subject: subjectToStore,
      mode,
      replaceTemplate,
      listTemplate,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota or unavailable — ignore
    }
  }, [pattern, flags, subject, mode, replaceTemplate, listTemplate]);

  const compiled = useMemo<{ regex: RegExp | null; error: string | null }>(() => {
    if (!pattern) return { regex: null, error: null };
    try {
      return { regex: compileRegex(pattern, flags), error: null };
    } catch (e) {
      return { regex: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [pattern, flags]);

  const debouncedSubject = useDebounced(subject);
  const debouncedReplace = useDebounced(replaceTemplate);
  const debouncedList = useDebounced(listTemplate);

  const matches = useMemo<MatchResult[]>(() => {
    if (!compiled.regex) return [];
    try {
      return runRegex(compiled.regex, debouncedSubject);
    } catch {
      return [];
    }
  }, [compiled.regex, debouncedSubject]);

  const replaceOutput = useMemo(
    () => applyReplace(debouncedSubject, matches, debouncedReplace, flags.includes("g")),
    [debouncedSubject, matches, debouncedReplace, flags],
  );

  const listOutput = useMemo(
    () => applyList(matches, debouncedList),
    [matches, debouncedList],
  );

  const statusText = compiled.error
    ? `Invalid regex: ${compiled.error}`
    : `${matches.length} match${matches.length === 1 ? "" : "es"}`;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.title}>Reggie</div>
        <div className={compiled.error ? `${styles.status} ${styles.statusError}` : styles.status}>
          {statusText}
        </div>
      </header>

      <div className={styles.card}>
        <RegexInput
          pattern={pattern}
          onPatternChange={setPattern}
          flags={flags}
          onFlagsChange={setFlags}
        />
      </div>

      <SubjectEditor subject={subject} onSubjectChange={setSubject} matches={matches} />

      <Toolbar mode={mode} onModeChange={setMode} />
      <div className={styles.card}>
        {mode === "replace" ? (
          <ReplacePanel
            template={replaceTemplate}
            onTemplateChange={setReplaceTemplate}
            output={replaceOutput}
          />
        ) : (
          <ListPanel
            template={listTemplate}
            onTemplateChange={setListTemplate}
            output={listOutput}
          />
        )}
      </div>
    </div>
  );
}
