function StopSearch({ stopNumber, setStopNumber, onSearch }) {
    
  return (
    <div>
      <h2>Search by Stop Number</h2>
      <input
        type="number"
        placeholder="Enter stop number"
        value={stopNumber}
        onChange={(e) => setStopNumber(e.target.value)}
      />
      <button onClick={onSearch}>Get Arrivals</button>
    </div>
  )
}

export default StopSearch