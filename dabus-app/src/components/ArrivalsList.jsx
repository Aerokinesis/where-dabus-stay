function ArrivalsList({
  arrivals,
  selectedBus,
  onShowMap,
  currentStop,
  isFavorited,
  onSaveStop,
  lastUpdated,
}) {
  const getMinutesUntil = (stopTime, date) => {
    const now = new Date();
    const arrival = new Date(`${date} ${stopTime}`);
    const diff = Math.round((arrival - now) / 60000);
    if (diff <= 0) return "Arriving now";
    if (diff === 1) return "1 min";
    if (diff < 60) return `${diff} mins`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };

  // Build a map of { direction -> Set of route numbers }
  const routesByDirection = arrivals.reduce((acc, bus) => {
    if (!bus.direction) return acc;
    if (!acc[bus.direction]) acc[bus.direction] = new Set();
    acc[bus.direction].add(bus.route);
    return acc;
  }, {});

  return (
    <div>
      <h2>Arrivals</h2>
      {currentStop && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <p>
            {currentStop.name} — Stop #{currentStop.id}
          </p>
          <button onClick={onSaveStop}>
            {isFavorited ? "⭐ Saved" : "☆ Save Stop"}
          </button>
        </div>
      )}
      {lastUpdated && <p>Last updated: {lastUpdated.toLocaleTimeString()}</p>}

      {arrivals.map((bus) => (
        <div key={bus.id}>
          <p>
            {bus.canceled === "1" && "❌ CANCELED — "}
            Route {bus.route} — {bus.headsign} — {bus.direction}
          </p>
          <p>
            {bus.estimated === "1" ? "🟢 Live" : "🕐 Scheduled"} —{" "}
            {bus.stopTime} ({getMinutesUntil(bus.stopTime, bus.date)})
          </p>
          {bus.estimated === "1" && <p>Bus #{bus.vehicle}</p>}
          {bus.estimated === "1" && (
            <button onClick={() => onShowMap(bus)}>
              {selectedBus?.id === bus.id ? "Hide Map" : "Show on Map"}
            </button>
          )}
        </div>
      ))}

      {/* Routes-by-direction summary */}
      {Object.entries(routesByDirection).map(([direction, routes]) => (
        <div key={direction}>
          <h3>Buses Traveling {direction}</h3>
          <p>
            {[...routes]
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
}

export default ArrivalsList;
