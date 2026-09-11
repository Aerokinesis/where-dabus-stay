import styles from "./StopHistory.module.css";

function StopHistory({ stopHistory, onSelectStop, onRemoveStop }) {
  if (stopHistory.length === 0)
    return <div className={styles.empty}>No recent stops.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Recent</span>
      </div>
      {stopHistory.map((entry) => (
        <div key={entry.stopId} className={styles.row}>
          <button type="button" className={styles.info} onClick={() => onSelectStop(entry.stopId)}>
            <span className={styles.stopId}>Stop #{entry.stopId}</span>
            {entry.stopName && (
              <span className={styles.stopName}>
                {entry.stopName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            )}
          </button>
          <button
            className={styles.removeBtn}
            onClick={() => onRemoveStop(entry.stopId)}
            aria-label={`Remove Stop #${entry.stopId} from recents`}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default StopHistory;