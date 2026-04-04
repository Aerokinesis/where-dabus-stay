function StopHistory({ stopHistory, onSelectStop, onClearHistory }) {
  if (stopHistory.length === 0) return null;

  return (
    <div>
      <h2>Recent Stops</h2>
      {stopHistory.map((stopId) => (
        <button key={stopId} onClick={() => onSelectStop(stopId)}>
          Stop #{stopId}
        </button>
      ))}
      <button onClick={onClearHistory}>Clear History</button>
    </div>
  );
}

export default StopHistory;
