import { useState, useRef, useEffect } from "react";

const MAX_NAME_LENGTH = 60;

function SaveStopModal({ stop, onSave, onCancel }) {
  const [customName, setCustomName] = useState(stop.name);
  const remaining = MAX_NAME_LENGTH - customName.length;
  const isOverLimit = customName.length > MAX_NAME_LENGTH;

  const modalRef = useRef(null);
  const inputRef = useRef(null);

  // Save the focus from before the modal opened, move focus to the input,
  // trap Tab inside the modal, and restore focus when the modal unmounts.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    inputRef.current?.focus();
    inputRef.current?.select();

    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const focusables = modalRef.current?.querySelectorAll(
        'input, button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-stop-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          padding: "24px",
          borderRadius: "12px",
          width: "300px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div>
          <p id="save-stop-title" style={{ fontSize: "16px", fontWeight: 500, marginBottom: "4px" }}>
            Add to favorites
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Stop #{stop.id}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label htmlFor="save-stop-name" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Custom name
          </label>
          <input
            id="save-stop-name"
            ref={inputRef}
            type="text"
            value={customName}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isOverLimit) onSave(customName);
              if (e.key === "Escape") onCancel();
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text)",
              fontSize: "15px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
              Defaults to the stop name — change it to something memorable like
              "Home stop".
            </p>
            <p
              id="save-stop-counter"
              style={{
                fontSize: "11px",
                color: isOverLimit || remaining <= 5 ? "#f87171" : "var(--text-muted)",
                margin: 0,
                flexShrink: 0,
              }}
            >
              {isOverLimit ? `Too long — ${customName.length}/${MAX_NAME_LENGTH}` : `${customName.length}/${MAX_NAME_LENGTH}`}
            </p>
          </div>
        </div>
        <div
          style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
        >
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text-muted)",
              fontSize: "14px",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(customName)}
            disabled={isOverLimit}
            aria-describedby="save-stop-counter"
            style={{
              background: "var(--primary)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "14px",
              padding: "8px 16px",
              cursor: isOverLimit ? "not-allowed" : "pointer",
              opacity: isOverLimit ? 0.5 : 1,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveStopModal;
