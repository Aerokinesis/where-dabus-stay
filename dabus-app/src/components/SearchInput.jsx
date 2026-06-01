import styles from "./SearchInput.module.css";

function SearchInput({ value, onChange, placeholder, onClear, onSubmit, ariaLabel }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onSubmit) onSubmit();
  };

  return (
    <div className={styles.inputRow}>
      <svg
        className={styles.icon}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
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
        <button
          className={styles.clearBtn}
          onClick={onClear}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default SearchInput;
