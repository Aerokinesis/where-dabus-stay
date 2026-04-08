import styles from "./Favorites.module.css";

function Favorites({ favorites, onSelectStop, onRemoveFavorite }) {
  if (favorites.length === 0) return (
    <div className={styles.empty}>No saved stops yet.</div>
  );

  return (
    <div className={styles.container}>
      {favorites.map((fav) => (
        <div key={fav.stop_id} className={styles.row}>
          <div className={styles.info} onClick={() => onSelectStop(fav.stop_id)}>
            <span className={styles.star}>★</span>
            <div className={styles.text}>
              <span className={styles.name}>{fav.custom_name}</span>
              <span className={styles.id}>Stop #{fav.stop_id}</span>
            </div>
          </div>
          <button className={styles.removeBtn} onClick={() => onRemoveFavorite(fav.stop_id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

export default Favorites;