import styles from "./AdherenceBadge.module.css";

// Within this many minutes either way reads as "On time", so the badge
// doesn't flicker between "1 min late" and "1 min early".
const ON_TIME_MIN = 1;
// Older than this and TheBus's adherence describes where the bus was, not
// where it is; show nothing rather than a stale claim.
const MAX_REPORT_AGE_S = 120;

// "5 min late" / "2 min early" / "On time" for a tracked bus. TheBus's
// adherence is minutes off schedule with positive = early, negative = late.
function AdherenceBadge({ adherence, ageS }) {
  if (adherence == null) return null;
  if (ageS != null && ageS > MAX_REPORT_AGE_S) return null;

  let label, tone;
  if (Math.abs(adherence) <= ON_TIME_MIN) {
    label = "On time";
    tone = styles.onTime;
  } else if (adherence < 0) {
    label = `${-adherence} min late`;
    tone = styles.late;
  } else {
    label = `${adherence} min early`;
    tone = styles.early;
  }

  return (
    <span className={`${styles.badge} ${tone}`} title="Compared with the schedule, from TheBus's live vehicle data">
      {label}
    </span>
  );
}

export default AdherenceBadge;
