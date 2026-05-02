function PullToRefreshIndicator({ isPulling, pullDistance, triggered }) {
  if (!isPulling && !triggered) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "60px",
        left: "50%",
        transform: triggered
          ? "translateX(-50%) translateY(48px)"
          : `translateX(-50%) translateY(${Math.min(pullDistance * 0.6, 48)}px)`,
        zIndex: 100,
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        transition: triggered
          ? "transform 0.2s ease, opacity 0.5s ease 0.2s"
          : "transform 0.05s ease",
        opacity: triggered ? 0 : 1,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: triggered
            ? "rotate(360deg)"
            : `rotate(${(pullDistance / 80) * 360}deg)`,
          transition: triggered
            ? "transform 0.5s ease"
            : "transform 0.05s ease",
          animation: triggered ? "spin 0.6s linear" : "none",
        }}
      >
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </div>
  );
}

export default PullToRefreshIndicator;