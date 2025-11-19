"use client";

import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import ncCounties from "./nc-counties-merged.json";

// ---- Lens configuration ----

const LENS_CONFIG = {
  overview: {
    id: "overview",
    shortLabel: "Housing Shortage Overview",
    metricKey: "housing_shortage",
    legendTitle: "2029 housing shortage (units)",
  },
  per_capita: {
    id: "per_capita",
    shortLabel: "Housing Shortage per Capita",
    metricKey: "shortage_per_1000_2029",
    legendTitle: "Shortage per 1,000 people (2029)",
  },
  affordable_rental: {
    id: "affordable_rental",
    shortLabel: "Affordable Rental Unit Shortage",
    metricKey: "percent_rental_units_50_ami",
    legendTitle: "Shortage of rental units affordable at ≤50% AMI (%, 2029)",
  },
  rental_backlog: {
    id: "rental_backlog",
    shortLabel: "Rental Housing Backlog",
    metricKey: "rental_gap_to_units_ratio",
    legendTitle: "Rental shortage as % of rental stock (2029)",
  },
  forsale_backlog: {
    id: "forsale_backlog",
    shortLabel: "For-Sale Housing Backlog",
    metricKey: "for_sale_gap_to_units_ratio",
    legendTitle: "For-sale shortage as % of for-sale stock (2029)",
  },
};

const LENS_ORDER = [
  "overview",
  "per_capita",
  "affordable_rental",
  "rental_backlog",
  "forsale_backlog",
];

// ---------- Numeric helpers ----------

function safeNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  let str = String(raw).trim();
  if (!str) return null;

  // Remove % sign if present
  if (str.endsWith("%")) {
    str = str.slice(0, -1);
  }

  // Remove commas
  str = str.replace(/,/g, "");

  const n = Number(str);
  if (!Number.isFinite(n)) return null;

  return n;
}

function numberOrZero(raw) {
  const n = safeNumber(raw);
  return n == null ? 0 : n;
}

// Convert values that might be 0–1 ratios OR 0–100 percents into 0–100 percents
function toPercent(raw) {
  const n = safeNumber(raw);
  if (n == null) return 0;
  return n <= 1 ? n * 100 : n;
}

function formatInt(n) {
  if (n == null || !Number.isFinite(n)) return "No data";
  return new Intl.NumberFormat().format(Math.round(n));
}

function formatPerThousand(n) {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(1);
}

function formatPercent(n) {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return `${n.toFixed(1)}%`;
}

// ---------- Metric selection per lens ----------

function getMetricValue(feature, lensId) {
  const p = feature && feature.properties ? feature.properties : {};
  switch (lensId) {
    // Housing Shortage Overview: color by total shortage (units)
    case "overview":
      return numberOrZero(p.housing_shortage);

    // Housing Shortage per Capita: color by units per 1,000 people
    case "per_capita":
      return safeNumber(p.shortage_per_1000_2029) ?? 0;

    // Affordable Rental Unit Shortage: color by % of rentals affordable at ≤50% AMI that are missing
    case "affordable_rental":
      return toPercent(p.percent_rental_units_50_ami);

    // Rental Housing Backlog: color by rental shortage as % of all rental units
    case "rental_backlog":
      return toPercent(p.rental_gap_to_units_ratio);

    // For-sale Housing Backlog: color by for-sale shortage as % of for-sale stock
    case "forsale_backlog":
      return toPercent(p.for_sale_gap_to_units_ratio);

    default:
      return 0;
  }
}

// ---------- Color scale helpers ----------

function getColorForValue(value, breaks) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "#FFEDA0";

  if (!breaks || breaks.length === 0) {
    return "#FED976";
  }

  const [b1, b2, b3, b4] = [
    breaks[0],
    breaks[1] ?? breaks[0],
    breaks[2] ?? breaks[1] ?? breaks[0],
    breaks[3] ?? breaks[2] ?? breaks[1] ?? breaks[0],
  ];

  if (v > b4) return "#800026"; // darkest
  if (v > b3) return "#BD0026";
  if (v > b2) return "#E31A1C";
  if (v > b1) return "#FD8D3C";
  return "#FFEDA0"; // lightest
}

function formatLegendValue(value, lensId) {
  if (!Number.isFinite(value)) return "n/a";
  if (lensId === "overview") {
    return formatInt(value);
  }
  if (lensId === "per_capita") {
    return formatPerThousand(value);
  }
  // percent-based lenses
  return formatPercent(value);
}

// ---------- Popup content builder ----------

function buildPopupHTML(lensId, properties) {
  const p = properties || {};
  const name = p.NAME || p.county || "Unknown County";

  const lines = [];

  if (lensId === "overview") {
    const shortage = numberOrZero(p.housing_shortage);
    const pop2029 = numberOrZero(p.pop2029);
    const rentalsGap = numberOrZero(p.housing_gap_rentals);
    const forsaleGap = numberOrZero(p.housing_gap_for_sale);

    lines.push({
      icon: "🏠",
      label: "Total housing shortage (units)",
      value: formatInt(shortage),
    });
    lines.push({
      icon: "👥",
      label: "2029 population",
      value: formatInt(pop2029),
    });
    lines.push({
      icon: "📊",
      label: "Rental housing shortage (units)",
      value: formatInt(rentalsGap),
    });
    lines.push({
      icon: "🏡",
      label: "For-sale housing shortage (units)",
      value: formatInt(forsaleGap),
    });
  } else if (lensId === "per_capita") {
    const pop2029 = numberOrZero(p.pop2029);
    const per1000People = safeNumber(p.shortage_per_1000_2029);
    const per1000Households = safeNumber(p.shortage_per_1000_household_2029);

    lines.push({
      icon: "👥",
      label: "2029 population",
      value: formatInt(pop2029),
    });
    lines.push({
      icon: "📊",
      label: "Shortage per 1,000 people (2029)",
      value: formatPerThousand(per1000People),
    });
    lines.push({
      icon: "📉",
      label: "Shortage per 1,000 households (2029)",
      value: formatPerThousand(per1000Households),
    });
  } else if (lensId === "affordable_rental") {
    const rentalsGap = numberOrZero(p.housing_gap_rentals);
    const percent50AMI = toPercent(p.percent_rental_units_50_ami);

    lines.push({
      icon: "🏘️",
      label: "Rental housing shortage (units)",
      value: formatInt(rentalsGap),
    });
    lines.push({
      icon: "💡",
      label:
        "Shortage of units affordable at \u226450% AMI (as % of rentals, 2029)",
      value: formatPercent(percent50AMI),
    });
  } else if (lensId === "rental_backlog") {
    const rentalsGap = numberOrZero(p.housing_gap_rentals);
    const backlogPercent = toPercent(p.rental_gap_to_units_ratio);
    const percent50AMI = toPercent(p.percent_rental_units_50_ami);

    lines.push({
      icon: "🏘️",
      label: "Rental housing shortage (units)",
      value: formatInt(rentalsGap),
    });
    lines.push({
      icon: "📊",
      label: "Rental shortage as % of all rental units (2029)",
      value: formatPercent(backlogPercent),
    });
    lines.push({
      icon: "💡",
      label:
        "Shortage of units affordable at \u226450% AMI (as % of rentals, 2029)",
      value: formatPercent(percent50AMI),
    });
  } else if (lensId === "forsale_backlog") {
    const forsaleGap = numberOrZero(p.housing_gap_for_sale);
    const backlogPercent = toPercent(p.for_sale_gap_to_units_ratio);

    lines.push({
      icon: "🏡",
      label: "For-sale housing shortage (units)",
      value: formatInt(forsaleGap),
    });
    lines.push({
      icon: "📊",
      label: "For-sale shortage as % of for-sale stock (2029)",
      value: formatPercent(backlogPercent),
    });
  }

  const itemsHtml = lines
    .map(
      (line) => `
      <div style="margin: 6px 0; display: flex; align-items: center;">
        <span style="margin-right: 6px;">${line.icon}</span>
        <span>${line.label}:&nbsp;<strong>${line.value}</strong></span>
      </div>`
    )
    .join("");

  return `
    <div style="
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #003366;
      background: #f7f9fc;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      border: 1px solid #cfd8dc;
      min-width: 220px;
    ">
      <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; color: #111;">
        ${name} County
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 6px 0;">
      ${itemsHtml}
    </div>
  `;
}

// ---------- Legend control ----------

function Legend({ activeLensId, breaks }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const legend = L.control({ position: "topright" });

    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "legend-leaflet");

      div.style.background = "white";
      div.style.padding = "16px 20px";
      div.style.borderRadius = "14px";
      div.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
      div.style.fontSize = "13px";
      div.style.lineHeight = "20px";
      div.style.color = "#111827";
      div.style.border = "1px solid #cbd5e1";
      div.style.minWidth = "230px";

      const cfg = LENS_CONFIG[activeLensId];
      const titleText = cfg ? cfg.legendTitle : "Legend";

      const title = document.createElement("div");
      title.style.fontWeight = "700";
      title.style.marginBottom = "8px";
      title.style.fontSize = "14px";
      title.style.letterSpacing = "0.02em";
      title.textContent = titleText;
      div.appendChild(title);

      let breaksToUse = Array.isArray(breaks) ? breaks : [];
      if (breaksToUse.length === 0) {
        const row = document.createElement("div");
        row.textContent = "No data available";
        row.style.fontSize = "12px";
        row.style.color = "#6b7280";
        div.appendChild(row);
        return div;
      }

      // Build 5 classes: [0, b1), [b1, b2), [b2, b3), [b3, b4), [b4, +∞)
      const [b1, b2, b3, b4] = [
        breaksToUse[0],
        breaksToUse[1] ?? breaksToUse[0],
        breaksToUse[2] ?? breaksToUse[1] ?? breaksToUse[0],
        breaksToUse[3] ?? breaksToUse[2] ?? breaksToUse[1] ?? breaksToUse[0],
      ];

      const classes = [
        { from: 0, to: b1 },
        { from: b1, to: b2 },
        { from: b2, to: b3 },
        { from: b3, to: b4 },
        { from: b4, to: null },
      ];

      classes.forEach((cls) => {
        const midValue =
          cls.to == null ? cls.from + 1 : (cls.from + cls.to) / 2;
        const color = getColorForValue(midValue, breaksToUse);

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.marginBottom = "6px";

        const swatch = document.createElement("span");
        swatch.style.width = "24px";
        swatch.style.height = "14px";
        swatch.style.background = color;
        swatch.style.display = "inline-block";
        swatch.style.marginRight = "10px";
        swatch.style.border = "1px solid #9ca3af";
        row.appendChild(swatch);

        const label = document.createElement("span");
        label.textContent = cls.to
          ? `${formatLegendValue(cls.from, activeLensId)} – ${formatLegendValue(
              cls.to,
              activeLensId
            )}`
          : `≥ ${formatLegendValue(cls.from, activeLensId)}`;
        row.appendChild(label);

        div.appendChild(row);
      });

      return div;
    };

    legend.addTo(map);
    return () => legend.remove();
  }, [map, activeLensId, breaks]);

  return null;
}

// ---------- Lens selector UI ----------

function LensSelector({ activeLensId, setActiveLensId }) {
  return (
    <div className="lens-card">
      <div className="lens-card-title">Viewing heatmap data for:</div>
      <div className="lens-options">
        {LENS_ORDER.map((id) => {
          const cfg = LENS_CONFIG[id];
          const isActive = id === activeLensId;
          return (
            <button
              key={id}
              type="button"
              className={`lens-option${isActive ? " lens-option-active" : ""}`}
              onClick={() => setActiveLensId(id)}
            >
              <span
                className={`lens-dot${
                  isActive ? " lens-dot-active" : ""
                }`}
                aria-hidden="true"
              />
              <span>{cfg.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- NcMap main component ----------

export default function NcMap() {
  const [activeLensId, setActiveLensId] = useState("overview");

  const values = useMemo(() => {
    const features = ncCounties.features || [];
    return features
      .map((f) => getMetricValue(f, activeLensId))
      .filter((v) => Number.isFinite(Number(v)));
  }, [activeLensId]);

  const breaks = useMemo(() => {
    const sorted = [...values].map(Number).sort((a, b) => a - b);
    if (!sorted.length) return [];

    const quantile = (p) =>
      sorted[Math.floor(p * (sorted.length - 1))];

    // 4 quantiles → 5 color classes
    return [0.2, 0.4, 0.6, 0.8].map(quantile);
  }, [values]);

  function style(feature) {
    const v = getMetricValue(feature, activeLensId);
    return {
      fillColor: getColorForValue(v, breaks),
      weight: 1,
      opacity: 1,
      color: "#ffffff",
      dashArray: "",
      fillOpacity: 0.85,
    };
  }

  function onEachCounty(feature, layer) {
    const html = buildPopupHTML(activeLensId, feature.properties || {});
    layer.bindPopup(html, {
      maxWidth: 320,
      closeButton: true,
      className: "custom-popup",
    });

    layer.on({
      mouseover: (e) => {
        const target = e.target;
        target.setStyle({
          weight: 2,
          color: "#111827",
          fillOpacity: 1,
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          target.bringToFront();
        }
      },
      mouseout: (e) => {
        const target = e.target;
        target.setStyle(style(feature));
      },
    });
  }

  return (
    <div className="map-root">
      <MapContainer
        center={[35.7596, -79.0193]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <GeoJSON data={ncCounties} style={style} onEachFeature={onEachCounty} />
        <Legend activeLensId={activeLensId} breaks={breaks} />
      </MapContainer>

      <LensSelector
        activeLensId={activeLensId}
        setActiveLensId={setActiveLensId}
      />
    </div>
  );
}
