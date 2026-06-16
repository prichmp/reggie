import { useEffect, useRef, useState } from "react";
import styles from "../styles/app.module.css";

interface Props {
  flags: string;
  onFlagsChange: (v: string) => void;
}

interface FlagDef {
  key: string;
  label: string;
  desc: string;
}

// Canonical order — the emitted flags string is always built from this list,
// so toggling produces a stable, deduped, valid string.
const FLAGS: FlagDef[] = [
  { key: "g", label: "global", desc: "find all matches" },
  { key: "i", label: "ignore case", desc: "case-insensitive matching" },
  { key: "m", label: "multiline", desc: "^ and $ match at line breaks" },
  { key: "s", label: "dotAll", desc: ". also matches newlines" },
  { key: "u", label: "unicode", desc: "full unicode matching" },
];

export function FlagsDropdown({ flags, onFlagsChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = new Set(flags.split(""));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(key: string) {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onFlagsChange(FLAGS.filter((f) => next.has(f.key)).map((f) => f.key).join(""));
  }

  const summary = FLAGS.filter((f) => active.has(f.key)).map((f) => f.key).join("");

  return (
    <div className={styles.flagsDropdown} ref={rootRef}>
      <button
        type="button"
        className={styles.flagsButton}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="regex flags"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={summary ? styles.flagsSummary : styles.flagsPlaceholder}>
          {summary || "flags"}
        </span>
        <span className={styles.flagsCaret} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className={styles.flagsMenu} role="menu">
          {FLAGS.map((f) => (
            <label key={f.key} className={styles.flagOption}>
              <input
                type="checkbox"
                checked={active.has(f.key)}
                onChange={() => toggle(f.key)}
              />
              <span className={styles.flagKey}>{f.key}</span>
              <span className={styles.flagText}>
                <span className={styles.flagLabel}>{f.label}</span>
                <span className={styles.flagDesc}>{f.desc}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
