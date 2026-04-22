import styles from "../styles/app.module.css";

export type Mode = "replace" | "list";

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
}

export function Toolbar({ mode, onModeChange }: Props) {
  return (
    <div className={styles.toolbar}>
      <button
        className={`${styles.tabButton} ${mode === "replace" ? styles.tabActive : ""}`}
        onClick={() => onModeChange("replace")}
      >
        Replace
      </button>
      <button
        className={`${styles.tabButton} ${mode === "list" ? styles.tabActive : ""}`}
        onClick={() => onModeChange("list")}
      >
        List
      </button>
    </div>
  );
}
