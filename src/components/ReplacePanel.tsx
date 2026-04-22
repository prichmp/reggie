import styles from "../styles/app.module.css";
import { CopyButton } from "./CopyButton";

interface Props {
  template: string;
  onTemplateChange: (v: string) => void;
  output: string;
}

export function ReplacePanel({ template, onTemplateChange, output }: Props) {
  return (
    <div className={styles.panelGrid}>
      <div className={styles.panelColumn}>
        <div className={styles.panelLabel}>
          <span>Replacement template</span>
          <span style={{ textTransform: "none" }}>
            $&amp; · $1 · $&lt;name&gt; · $$ · \n · \t
          </span>
        </div>
        <textarea
          className={styles.templateInput}
          value={template}
          spellCheck={false}
          placeholder="replacement"
          onChange={(e) => onTemplateChange(e.target.value)}
        />
      </div>
      <div className={styles.panelColumn}>
        <div className={styles.panelLabel}>
          <span>Output</span>
          <CopyButton value={output} />
        </div>
        <textarea className={styles.outputArea} value={output} readOnly />
      </div>
    </div>
  );
}
