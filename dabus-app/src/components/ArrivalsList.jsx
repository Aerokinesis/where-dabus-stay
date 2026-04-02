function ArrivalsList({ arrivals, selectedBus, onShowMap }) {
  const getMinutesUntil = (stopTime, date) => {
    const now = new Date()
    const arrival = new Date(`${date} ${stopTime}`)
    const diff = Math.round((arrival - now) / 60000)
    if (diff <= 0) return "Arriving now"
    if (diff === 1) return "1 min"
    return `${diff} mins`
  }

  return (
    <div>
      <h2>Arrivals</h2>
      {arrivals.map((bus) => (
        <div key={bus.id}>
          <p>Route {bus.route} — {bus.headsign} — {bus.direction}</p>
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
    </div>
  )
}

export default ArrivalsList