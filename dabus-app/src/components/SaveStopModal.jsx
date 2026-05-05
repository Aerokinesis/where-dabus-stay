import { useState } from "react";

function SaveStopModal({ stop, onSave, onCancel }) {
  const [customName, setCustomName] = useState(stop.name);

  return (
    <div
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
          <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "4px" }}>
            Add to favorites
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Stop #{stop.id}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Custom name
          </label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave(customName);
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
              outline: "none",
            }}
          />
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Defaults to the stop name — change it to something memorable like
            "Home stop".
          </p>
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
            style={{
              background: "var(--primary)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "14px",
              padding: "8px 16px",
              cursor: "pointer",
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
