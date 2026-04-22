import { useState } from "react";
import styles from "../styles/app.module.css";

export function CopyButton({ value, disabled }: { value: string; disabled?: boolean }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      className={styles.copyButton}
      disabled={disabled || !value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setLabel("Copied");
          setTimeout(() => setLabel("Copy"), 1200);
        } catch {
          setLabel("Failed");
          setTimeout(() => setLabel("Copy"), 1200);
        }
      }}
    >
      {label}
    </button>
  );
}
