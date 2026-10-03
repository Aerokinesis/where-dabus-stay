## Accessibility Audit: DaBus (main branch)
**Standard:** WCAG 2.1 AA | **Date:** 2026-07-08 | **Method:** source review + computed contrast ratios (both themes)

### Summary
**Issues found:** 12 | **Critical:** 3 | **Major:** 4 | **Minor:** 5

Strong foundations already in place: global `:focus-visible` outline, 44px `--control-h` on inputs, a proper focus trap with focus restore in SaveStopModal, `aria-label` on icon-only buttons (BackButton, favorite remove, alert dismiss, refresh), `role="alert"` on errors and route alerts, `aria-expanded` on the FAQ accordion, and a fully labeled radius slider. The issues below are the gaps.

### Findings

#### Perceivable
| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| 1 | Accent `#e8b84b` used as text (arrival times `.time` 15px, AddressSearch `.stopId` 12px) is 1.84:1 on white in light theme | 1.4.3 | 🔴 Critical | Add a light-theme override, e.g. `--accent-text: #8a6d1f` (or darker) used for text; keep `#e8b84b` for the star icon on dark |
| 2 | Primary `#1a6faf` as small text on dark surface is 3.08:1 (Settings `.sliderVal` 13px, `.legalLink` 11px) | 1.4.3 | 🟡 Major | Use a lighter blue for text-on-dark, e.g. `#4f9fd8`+ (needs ≥4.5:1 vs `#1F1F23`) |
| 3 | Danger `#f87171` on light theme is 2.77:1 (Settings clear buttons, toast icons) | 1.4.3 | 🟡 Major | Light-theme override, e.g. `#b91c1c` |
| 4 | Active nav tab conveyed by color alone; no programmatic state | 1.4.1 / 4.1.2 | 🟡 Major | Add `aria-current="page"` to the active nav button (also fixes SR announcement) |
| 5 | No `h1`; FAQ `h2` is the app's only heading; Settings section labels are `<p>` | 1.3.1 | 🟢 Minor | Add a visually-hidden `h1` ("DaBus"), make section labels `h2`/`h3` |

#### Operable
| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| 6 | Clickable `<div>` rows are not keyboard-reachable: StopHistory `.info`, Favorites `.info`, RoutesTab `.routeRow` | 2.1.1 | 🔴 Critical | Convert to `<button>` (block-level, unstyled) — row content stays identical |
| 7 | AddressSearch result buttons fire only on `onMouseDown`/`onTouchEnd`; keyboard Enter/Space dispatches `click`, which has no handler — results are focusable but inert | 2.1.1 | 🔴 Critical | Add `onClick` guarded against double-fire (e.g. skip if `e.detail > 0` was already handled by mousedown, or use a `handledRef`) |
| 8 | Small targets: RouteAlerts dismiss 28×28, Settings theme `segBtn` ~23px tall, StopHistory Remove/Clear ~26px | 2.5.5 (AAA; 24px is the 2.2 AA floor) | 🟢 Minor | Pad hit areas to 44×44 where layout allows (padding, not size) — `segBtn` is the only one under the 24px floor |
| 9 | SaveStopModal Escape-to-close is bound on the input only; Escape does nothing when focus is on Save/Cancel | 2.1.1 (practice) | 🟢 Minor | Move the Escape check into the existing document `keydown` listener |

#### Understandable
| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| 10 | Toast is also a button (`role="button"` when tappable) but has no `tabIndex` or key handler | 2.1.1 / 4.1.2 | 🟡 Major | `tabIndex={0}` + Enter/Space handler when `onClick` is set |

#### Robust
| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| 11 | Toasts ("Stop removed", "Press back again to exit", update notice) are never announced to screen readers | 4.1.3 | 🟡 Major | Add `role="status"` (implicit `aria-live="polite"`) to the toast container |
| 12 | Bottom-nav SVGs and Toast icons lack `aria-hidden` | 4.1.2 | 🟢 Minor | `aria-hidden="true"` on decorative SVGs |

### Color Contrast Check (computed)
| Element | Fg | Bg | Ratio | Required | Pass? |
|---------|----|----|-------|----------|-------|
| Body text dark | #f0f0f0 | #18181B | >12:1 | 4.5:1 | ✅ |
| Muted text dark | #888888 | #1F1F23 | 4.63:1 | 4.5:1 | ✅ |
| Muted text light | #666666 | #f5f5f5 | 5.27:1 | 4.5:1 | ✅ |
| Arrival time (light) | #e8b84b | #ffffff | 1.84:1 | 4.5:1 | ❌ |
| Arrival time (dark) | #e8b84b | #1F1F23 | 8.91:1 | 4.5:1 | ✅ |
| Primary as text (dark) | #1a6faf | #1F1F23 | 3.08:1 | 4.5:1 | ❌ |
| Primary as text (light) | #1a6faf | #ffffff | 5.33:1 | 4.5:1 | ✅ |
| White on primary (buttons) | #ffffff | #1a6faf | 5.33:1 | 4.5:1 | ✅ |
| Danger (dark) | #f87171 | #1F1F23 | 5.94:1 | 4.5:1 | ✅ |
| Danger (light) | #f87171 | #ffffff | 2.77:1 | 4.5:1 | ❌ |
| Live pill dark | #4ade80 | #1A2E22 | 8.27:1 | 4.5:1 | ✅ |
| Live pill light | #166534 | #dcfce7 | 6.49:1 | 4.5:1 | ✅ |
| Scheduled pill dark | #888888 | #1F1F2E | 4.58:1 | 4.5:1 | ✅ |
| Scheduled pill light | #3730a3 | #e0e7ff | 8.06:1 | 4.5:1 | ✅ |
| Arrived pill (both) | — | — | 6.15 / 6.71 | 4.5:1 | ✅ |
| Border vs bg (dark/light) | #6e6e73 / #919191 | bg | 3.49 / 3.15 | 3:1 | ✅ |

### Keyboard Navigation
| Element | Tab reach | Enter/Space | Notes |
|---------|-----------|-------------|-------|
| Bottom nav buttons | ✅ | ✅ | Add aria-current |
| Search inputs + clear | ✅ | ✅ | Labeled |
| AddressSearch results | ✅ (buttons) | ❌ inert | Finding #7 |
| StopHistory / Favorites rows | ❌ divs | ❌ | Finding #6 |
| RoutesTab route rows | ❌ div | ❌ | Finding #6 |
| RoutesTab stop "Arrivals" | ✅ | ✅ | OK |
| FAQ accordion / Settings rows | ✅ | ✅ | OK |
| SaveStopModal | ✅ trapped | ✅ | Escape only on input (#9) |
| Toast (tappable) | ❌ | ❌ | Finding #10 |

### Priority Fixes
1. **Light-theme accent/danger text colors (#1, #3)** — arrival times are the app's core content and are near-invisible to low-vision users in light mode.
2. **Keyboard access to stop/route rows and search results (#6, #7)** — keyboard and switch users currently cannot open a stop's arrivals from Recent, Favorites, Routes, or search — the app's primary flows.
3. **Toast announcements + aria-current (#11, #4)** — cheap fixes that make state changes perceivable to screen-reader users, including the back-to-exit toast.

Not covered by static review: real screen-reader behavior (VoiceOver/TalkBack), 200% zoom reflow, and Leaflet map-marker focus order — worth a manual pass on-device.

---

### Remediation — 2026-07-08 (same day)
All critical and major findings (#1–#4, #6, #7, #10, #11) fixed in source:
- New theme vars in `index.css`: `--primary-text`, `--accent-text`, `--danger`, `--danger-bg` with per-theme values; all text usages of `--primary`/`--accent`/hardcoded `#f87171` migrated. Every pair re-verified ≥4.5:1 computationally (accent-text light `#b45309` 5.02:1; arrival times additionally render on a pale gold chip in light mode (`#92400e` on `#fef3c7`, 6.37:1) so the brand gold treatment survives - see `:global([data-theme="light"]) .time`, primary-text dark `#4f9fd8` 5.70:1, danger light `#b91c1c` 6.47:1).
- StopHistory/Favorites rows and RoutesTab route rows converted from clickable divs to real `<button>`s (inner divs → spans to keep valid button content; CSS resets added).
- AddressSearch results: keyboard `onClick` added, guarded via `e.detail === 0` so mousedown taps don't double-fire.
- Bottom nav: `aria-current="page"` on active tab, `aria-hidden` on decorative SVGs.
- Toast: `role="status"` + `aria-live="polite"` when passive; `tabIndex` + Enter/Space handler when tappable.
Minor findings (#5, #8, #9, #12-partial) remain open. `canceledTag` keeps hardcoded `#f87171` on `#3a1a1a` (5.4:1, passes both themes).
