import L from "leaflet";
import { TileLayer } from "react-leaflet";
import { useDarkMap } from "../hooks/useDarkMap";

const CARTO_KEY = import.meta.env.VITE_CARTO_KEY;

const OSM = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  // In dark mode without a CARTO key, index.css darkens this layer with a
  // CSS filter instead.
  className: "map-tiles",
};

// CARTO Dark Matter. Free with a key (5M tile requests/month non-commercial,
// 1M commercial); the credit must stay visible on the map. @2x tiles on
// high-density screens are still one request each.
const CARTO_DARK = {
  url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}${L.Browser.retina ? "@2x" : ""}.png?key=${CARTO_KEY}`,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
    '&copy; <a href="https://carto.com/attribution/">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
};

// The road map for every map in the app: CARTO Dark Matter in dark mode,
// OpenStreetMap in light mode (or in dark mode when no key is configured).
function BaseTileLayer() {
  const dark = useDarkMap() && Boolean(CARTO_KEY);
  // The key makes React build a new layer when the theme changes;
  // react-leaflet only updates a reused layer's URL, not its attribution or
  // className.
  return <TileLayer key={dark ? "carto-dark" : "osm"} {...(dark ? CARTO_DARK : OSM)} />;
}

export default BaseTileLayer;
