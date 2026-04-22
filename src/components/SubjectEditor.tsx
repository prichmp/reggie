import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchResult } from "../types";
import styles from "../styles/app.module.css";
import { MatchTooltip } from "./MatchTooltip";

interface Props {
  subject: string;
  onSubjectChange: (v: string) => void;
  matches: MatchResult[];
}

interface Segment {
  kind: "text" | "mark";
  text: string;
  matchIndex?: number;
}

function buildSegments(subject: string, matches: MatchResult[]): Segment[] {
  if (matches.length === 0) {
    return [{ kind: "text", text: subject }];
  }
  const segments: Segment[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index < cursor) return;
    if (m.index > cursor) {
      segments.push({ kind: "text", text: subject.slice(cursor, m.index) });
    }
    if (m.end > m.index) {
      segments.push({ kind: "mark", text: subject.slice(m.index, m.end), matchIndex: i });
    }
    cursor = Math.max(cursor, m.end);
  });
  if (cursor < subject.length) {
    segments.push({ kind: "text", text: subject.slice(cursor) });
  }
  return segments;
}

export function SubjectEditor({ subject, onSubjectChange, matches }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ matchIndex: number; rect: DOMRect } | null>(null);

  const segments = useMemo(() => buildSegments(subject, matches), [subject, matches]);

  useEffect(() => {
    const ta = textareaRef.current;
    const overlay = overlayRef.current;
    if (!ta || !overlay) return;
    const sync = () => {
      overlay.scrollTop = ta.scrollTop;
      overlay.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", sync);
    sync();
    return () => ta.removeEventListener("scroll", sync);
  }, [subject]);

  useEffect(() => {
    if (!hover) return;
    if (hover.matchIndex >= matches.length) setHover(null);
  }, [matches, hover]);

  function handleMouseMove(e: React.MouseEvent) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    // Manual hit-test: the overlay has pointer-events: none so elementsFromPoint
    // ignores its descendants. We also want the *line* rect for multi-line matches,
    // not the union bounding box, so getClientRects() is the right primitive.
    const x = e.clientX;
    const y = e.clientY;
    const marks = overlay.querySelectorAll<HTMLElement>("[data-match-index]");
    for (const mark of marks) {
      for (const rect of mark.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          const idx = Number(mark.getAttribute("data-match-index"));
          if (Number.isNaN(idx)) return;
          if (!hover || hover.matchIndex !== idx) {
            setHover({ matchIndex: idx, rect });
          }
          return;
        }
      }
    }
    if (hover) setHover(null);
  }

  function handleMouseLeave() {
    setHover(null);
  }

  const hoveredMatch = hover ? matches[hover.matchIndex] : null;

  return (
    <div
      className={styles.subjectWrap}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={overlayRef} className={styles.subjectOverlay} aria-hidden>
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <mark
              key={i}
              data-match-index={seg.matchIndex}
              className={
                hover && hover.matchIndex === seg.matchIndex
                  ? `${styles.mark} ${styles.markActive}`
                  : styles.mark
              }
            >
              {seg.text}
            </mark>
          ),
        )}
        {/* Force the overlay to render a trailing line when subject ends with \n */}
        {subject.endsWith("\n") && <span>&nbsp;</span>}
      </div>
      <textarea
        ref={textareaRef}
        className={styles.subjectTextarea}
        value={subject}
        spellCheck={false}
        placeholder="paste or type subject text here"
        onChange={(e) => onSubjectChange(e.target.value)}
      />
      {hoveredMatch && hover && (
        <MatchTooltip
          match={hoveredMatch}
          matchNumber={hover.matchIndex + 1}
          anchor={hover.rect}
        />
      )}
    </div>
  );
}
