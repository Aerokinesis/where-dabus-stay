import styles from "./StopHistory.module.css";

function StopHistory({ stopHistory, onSelectStop, onRemoveStop, onClearHistory }) {
  if (stopHistory.length === 0)
    return <div className={styles.empty}>No recent stops.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Recent</span>
        <button className={styles.clearBtn} onClick={onClearHistory}>
          Clear
        </button>
      </div>
      {stopHistory.map((entry) => (
        <div key={entry.stopId} className={styles.row}>
          <div className={styles.info} onClick={() => onSelectStop(entry.stopId)}>
            <span className={styles.stopId}>Stop #{entry.stopId}</span>
            {entry.stopName && (
              <span className={styles.stopName}>
                {entry.stopName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            )}
          </div>
          <button className={styles.removeBtn} onClick={() => onRemoveStop(entry.stopId)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

export default StopHistory;