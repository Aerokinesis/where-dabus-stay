import styles from "./SearchInput.module.css";

function SearchInput({ value, onChange, placeholder, onClear, onSubmit, ariaLabel }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onSubmit) onSubmit();
  };

  return (
    <div className={styles.inputRow}>
      <span
        className="material-symbols-rounded"
        aria-hidden="true"
        style={{ fontSize: "24px", color: "var(--md-sys-color-on-surface-variant)", flexShrink: 0 }}
      >
        search
      </span>
      <input
        className={styles.input}
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {value && (
        <md-icon-button onClick={onClear} aria-label="Clear search">
          <span className="material-symbols-rounded" style={{ fontSize: "20px" }}>close</span>
        </md-icon-button>
      )}
    </div>
  );
}

export default SearchInput;
