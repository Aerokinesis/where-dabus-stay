import styles from "./StopHistory.module.css";

function StopHistory({ stopHistory, onSelectStop, onClearHistory }) {
  if (stopHistory.length === 0) return (
    <div className={styles.empty}>No recent stops.</div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Recent</span>
        <button className={styles.clearBtn} onClick={onClearHistory}>Clear</button>
      </div>
      <div className={styles.pills}>
        {stopHistory.map((stopId) => (
          <button key={stopId} className={styles.pill} onClick={() => onSelectStop(stopId)}>
            #{stopId}
          </button>
        ))}
      </div>
    </div>
  );
}

export default StopHistory;