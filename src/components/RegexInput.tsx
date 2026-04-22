import { useEffect, useMemo, useRef } from "react";
import { tokenizeRegex } from "../lib/regexTokenizer";
import type { RegexToken, RegexTokenKind } from "../types";
import styles from "../styles/app.module.css";

const KIND_CLASS: Record<RegexTokenKind, string> = {
  literal: styles.tokLiteral,
  metachar: styles.tokMetachar,
  charclass: styles.tokCharclass,
  "group-open": styles.tokGroupOpen,
  "group-close": styles.tokGroupClose,
  quantifier: styles.tokQuantifier,
  anchor: styles.tokAnchor,
  escape: styles.tokEscape,
  alternation: styles.tokAlternation,
  flag: styles.tokLiteral,
  error: styles.tokError,
};

interface Props {
  pattern: string;
  onPatternChange: (v: string) => void;
  flags: string;
  onFlagsChange: (v: string) => void;
}

export function RegexInput({ pattern, onPatternChange, flags, onFlagsChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const tokens: RegexToken[] = useMemo(() => tokenizeRegex(pattern), [pattern]);

  useEffect(() => {
    const input = inputRef.current;
    const overlay = overlayRef.current;
    if (!input || !overlay) return;
    const syncScroll = () => {
      overlay.scrollLeft = input.scrollLeft;
    };
    input.addEventListener("scroll", syncScroll);
    return () => input.removeEventListener("scroll", syncScroll);
  }, []);

  return (
    <div className={styles.regexRow}>
      <span className={styles.slash}>/</span>
      <div className={styles.regexWrap}>
        <div ref={overlayRef} className={styles.regexOverlay} aria-hidden>
          {tokens.length === 0 ? (
            <span>&nbsp;</span>
          ) : (
            tokens.map((t, i) => (
              <span key={i} className={KIND_CLASS[t.kind]}>
                {t.text}
              </span>
            ))
          )}
        </div>
        <input
          ref={inputRef}
          className={styles.regexInput}
          value={pattern}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="enter a regex"
          onChange={(e) => onPatternChange(e.target.value)}
        />
      </div>
      <span className={styles.slash}>/</span>
      <input
        className={styles.flagsField}
        value={flags}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder="flags"
        onChange={(e) => {
          const deduped = Array.from(new Set(e.target.value.split("")))
            .filter((c) => /[gimsuy]/.test(c))
            .join("");
          onFlagsChange(deduped);
        }}
      />
    </div>
  );
}
