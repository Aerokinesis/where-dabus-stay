// Shared helpers for community posts — used by the rider-facing News feed and
// the /admin editor so both describe a post the same way.

export const CATEGORIES = [
  { key: "service_change", label: "Service change", filter: "Service" },
  { key: "event", label: "Event", filter: "Events" },
  { key: "volunteer", label: "Volunteer", filter: "Volunteer" },
  { key: "otr_update", label: "OTR update", filter: "OTR" },
];

export const categoryLabel = (key) =>
  CATEGORIES.find((c) => c.key === key)?.label || "Notice";

// "live" | "scheduled" | "ended" relative to now.
export const postStatus = (p, now = Date.now()) => {
  if (new Date(p.starts_at).getTime() > now) return "scheduled";
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return "ended";
  return "live";
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Short "when was this posted" label: Today / Yesterday / 3 days ago / Sep 12.
export const postedLabel = (iso, now = new Date()) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// "Until Sat, Sep 27, 2 PM" — only when the post has an end date.
export const untilLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const time = hasTime ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "") : "";
  return `Until ${date}${time ? `, ${time}` : ""}`;
};
