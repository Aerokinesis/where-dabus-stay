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
            <div className={styles.seg} role="group" aria-label="Theme">
              {["light", "system", "dark"].map((t) => (
                <button
                  key={t}
                  className={`${styles.segBtn} ${settings.theme === t ? styles.segActive : ""}`}
                  onClick={() => onUpdateSetting("theme", t)}
                  aria-pressed={settings.theme === t}
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
                <p id="radius-label" className={styles.rowLabel}>Search radius</p>
                <p id="radius-desc" className={styles.rowSub}>How far to look for stops</p>
              </div>
              <span id="radius-value" className={styles.sliderVal}>
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
                aria-labelledby="radius-label"
                aria-describedby="radius-desc radius-value"
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

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Legal</p>
        <div className={styles.group}>
          <div className={styles.legalBlock}>
            <p className={styles.legalAttribution}>
              Route and arrival data provided by permission of Oahu Transit Services, Inc.*
            </p>
            <p className={styles.legalNote}>
              * OTS and HEA are registered trademarks of Oahu Transit Services, Inc. All rights reserved.
            </p>
            <p className={styles.legalNote}>
              Real-time data is provided "as is" without warranty of any kind. OTS is not liable for inaccuracies or service interruptions. Use of this data is subject to the{" "}
              <a
                href="https://api.thebus.org"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.legalLink}
              >
                OTS Web Services Terms of Use
              </a>
              .
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default SettingsTab;