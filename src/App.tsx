import { useEffect, useMemo, useState } from "react";
import { RegexInput } from "./components/RegexInput";
import { SubjectEditor } from "./components/SubjectEditor";
import { Toolbar, type Mode } from "./components/Toolbar";
import { ReplacePanel } from "./components/ReplacePanel";
import { ListPanel } from "./components/ListPanel";
import { compileRegex } from "./lib/runRegex";
import { applyReplace } from "./lib/applyReplace";
import { applyList } from "./lib/applyList";
import { useRegexEngine } from "./hooks/useRegexEngine";
import type { RegexRequest } from "./lib/regexEngine";
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

/** True only after `active` has stayed true for `delay` ms — avoids flashing
 *  the computing indicator for fast regexes. */
function useDelayed(active: boolean, delay: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const handle = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(handle);
  }, [active, delay]);
  return shown;
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

  // Validate the live pattern synchronously so syntax errors surface instantly,
  // independent of the debounced/worker-driven match run below.
  const compileError = useMemo<string | null>(() => {
    if (!pattern) return null;
    try {
      compileRegex(pattern, flags);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [pattern, flags]);

  const debouncedPattern = useDebounced(pattern);
  const debouncedFlags = useDebounced(flags);
  const debouncedSubject = useDebounced(subject);
  const debouncedReplace = useDebounced(replaceTemplate);
  const debouncedList = useDebounced(listTemplate);

  // Drive the worker only with valid, debounced input; `null` clears matches.
  const request = useMemo<RegexRequest | null>(() => {
    if (!debouncedPattern) return null;
    try {
      compileRegex(debouncedPattern, debouncedFlags);
    } catch {
      return null;
    }
    return { pattern: debouncedPattern, flags: debouncedFlags, subject: debouncedSubject };
  }, [debouncedPattern, debouncedFlags, debouncedSubject]);

  const { matches, status } = useRegexEngine(request);
  const computing = useDelayed(status === "computing", 150);

  const replaceOutput = useMemo(
    () => applyReplace(debouncedSubject, matches, debouncedReplace, debouncedFlags.includes("g")),
    [debouncedSubject, matches, debouncedReplace, debouncedFlags],
  );

  const listOutput = useMemo(
    () => applyList(matches, debouncedList),
    [matches, debouncedList],
  );

  const statusText = compileError
    ? `Invalid regex: ${compileError}`
    : computing
      ? "Computing…"
      : status === "too-slow"
        ? "Regex too slow — aborted"
        : `${matches.length} match${matches.length === 1 ? "" : "es"}`;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.title}>Reggie</div>
        <div className={compileError ? `${styles.status} ${styles.statusError}` : styles.status}>
          {computing && <span className={styles.spinner} aria-hidden />}
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
