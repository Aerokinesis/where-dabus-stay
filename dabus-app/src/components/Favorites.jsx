function Favorites({ favorites, onSelectStop, onRemoveFavorite }) {
  if (favorites.length === 0) return null

  return (
    <div>
      <h2>Favorites</h2>
      {favorites.map((fav) => (
        <div
          key={fav.stop_id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px",
            borderBottom: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          <span onClick={() => onSelectStop(fav.stop_id)}>
            ⭐ {fav.custom_name} — Stop #{fav.stop_id}
          </span>
          <button onClick={() => onRemoveFavorite(fav.stop_id)}>Remove</button>
        </div>
      ))}
    </div>
  )
}

export default Favorites