import { useState } from "react"

function SaveStopModal({ stop, onSave, onCancel }) {
  const [customName, setCustomName] = useState(stop.name)

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white",
        padding: "24px",
        borderRadius: "8px",
        width: "300px"
      }}>
        <h3>Save Stop</h3>
        <p>Stop #{stop.id}</p>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "16px" }}
        />
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => onSave(customName)}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default SaveStopModal