import { useLayoutEffect, useRef, useState } from "react";
import type { MatchResult } from "../types";
import styles from "../styles/app.module.css";

interface Props {
  match: MatchResult;
  matchNumber: number;
  anchor: DOMRect;
}

export function MatchTooltip({ match, matchNumber, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: anchor.bottom + 6,
    left: anchor.left,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = anchor.bottom + 6;
    let left = anchor.left;
    if (top + rect.height > window.innerHeight - 8) {
      top = anchor.top - rect.height - 6;
    }
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchor.top, anchor.left, anchor.bottom, anchor.right, match]);

  return (
    <div ref={ref} className={styles.tooltip} style={{ top: pos.top, left: pos.left }}>
      <div className={styles.tooltipHeader}>
        Match #{matchNumber} &middot; {match.index}–{match.end}
      </div>
      <div className={styles.tooltipMatch}>{match.text || "(empty match)"}</div>
      {match.groups.length > 0 && (
        <div className={styles.tooltipGroupList}>
          {match.groups.map((g, i) => (
            <GroupRow key={i} index={i + 1} name={g.name} text={g.text} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRow({
  index,
  name,
  text,
}: {
  index: number;
  name: string | undefined;
  text: string | null;
}) {
  return (
    <>
      <span className={styles.tooltipGroupName}>{name ?? index}</span>
      {text === null ? (
        <span className={styles.tooltipGroupValueNull}>—</span>
      ) : (
        <span className={styles.tooltipGroupValue}>{text || '""'}</span>
      )}
    </>
  );
}
