function Toast({ message, type, fading, onClick, bottom = "80px" }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{
        cursor: onClick ? "pointer" : undefined,
        position: "fixed",
        bottom,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        padding: "10px 18px",
        fontSize: "13px",
        color: "var(--text)",
        zIndex: 2000,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        animation: fading ? "fadeOut 1.2s ease forwards" : "fadeIn 0.4s ease",
      }}
    >
      {type === "remove" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "#f87171", flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ) : type === "info" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "#f87171", flexShrink: 0 }}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}
      {message}
    </div>
  );
}

export default Toast;