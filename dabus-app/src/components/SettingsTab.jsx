import styles from "./SettingsTab.module.css";
import { APP_VERSION } from "../constants";

const RADIUS_OPTIONS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

function SettingsTab({ settings, onUpdateSetting, onClearHistory, onClearFavorites }) {
  const radiusIndex = RADIUS_OPTIONS.indexOf(settings.searchRadius);
  const sliderValue = radiusIndex === -1 ? 3 : radiusIndex;

  return (
    <div className={styles.container}>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Display</p>
        <div className={styles.group}>
          <div className={styles.row}>
            <div>
              <p className={styles.rowLabel}>Appearance</p>
              <p className={styles.rowSub}>Choose your preferred theme</p>
            </div>
            <div className={styles.seg}>
              {["light", "system", "dark"].map((t) => (
                <button
                  key={t}
                  className={`${styles.segBtn} ${settings.theme === t ? styles.segActive : ""}`}
                  onClick={() => onUpdateSetting("theme", t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Nearby stops</p>
        <div className={styles.group}>
          <div className={`${styles.row} ${styles.sliderRow}`}>
            <div className={styles.sliderHeader}>
              <div>
                <p className={styles.rowLabel}>Search radius</p>
                <p className={styles.rowSub}>How far to look for stops</p>
              </div>
              <span className={styles.sliderVal}>
                {settings.searchRadius.toFixed(2)} mi
              </span>
            </div>
            <div className={styles.sliderWrap}>
              <span className={styles.sliderEdge}>0.1</span>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max={RADIUS_OPTIONS.length - 1}
                step="1"
                value={sliderValue}
                onChange={(e) =>
                  onUpdateSetting("searchRadius", RADIUS_OPTIONS[parseInt(e.target.value)])
                }
              />
              <span className={styles.sliderEdge}>0.5 mi</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Data</p>
        <div className={styles.group}>
          <button className={styles.dangerBtn} onClick={onClearHistory}>
            Clear recent stops
          </button>
          <div className={styles.divider} />
          <button className={styles.dangerBtn} onClick={onClearFavorites}>
            Clear all favorites
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>About</p>
        <div className={styles.group}>
          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>Version</span>
            <span className={styles.aboutVal}>{APP_VERSION}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>Transit data</span>
            <span className={styles.aboutVal}>TheBus GTFS</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>Data updated</span>
            <span className={styles.aboutVal}>Apr 2026</span>
          </div>
        </div>
      </div>

    </div>
  );
}

export default SettingsTab;