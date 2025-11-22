"use client";

console.log("NcMap VERSION 7 loaded");

import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState, useCallback } from "react";
import ncCounties from "./nc-counties-merged.json";

// ---- Lens configuration ----

const LENS_CONFIG = {
  // Housing Shortage Overview: 0–4k, 4,001–10k, 10,001–16k, 16,001–34k, 34,001+
  overview: {
    id: "overview",
    shortLabel: "Housing Shortage Overview",
    metricKey: "housing_shortage",
    legendTitle: "2029 housing shortage (units)",
    breaks: [4000, 10000, 16000, 34000],
  },

  // Housing Shortage per Capita: 0–45, 45.1–57.5, 57.6–70, 70.1–82.5, 82.6+
  per_capita: {
    id: "per_capita",
    shortLabel: "Housing Shortage per Capita",
    metricKey: "shortage_per_1000_2029",
    legendTitle: "Shortage per 1,000 people (2029)",
    breaks: [45, 57.5, 70, 82.5],
  },

  // Affordable Rental Unit Shortage
  // You specified 0–0.3, 0.301–0.41, 0.411–0.52, 0.521–0.65, 0.651+
  // Data is converted to percent (x100), so breaks are 30, 41, 52, 65
    affordable_rental: {
    id: "affordable_rental",
    shortLabel: "Affordable Rental Unit Shortage",
    metricKey: "percent_rental_units_50_ami",
    // shorter single-line fallback if ever needed
    legendTitle: "Percent of rental shortage needed by households making ≤50% of AMI",
    // 👇 explicit multi-line title for the Leaflet legend
    legendTitleLines: [
      "Shortage of rental units",
      "affordable at ≤50% AMI (percent, 2029)",
    ],
    breaks: [30, 41, 52, 65],
  },


  // Rental Housing Backlog
  // You specified 0.05–0.10, 0.101–0.15, 0.151–0.20, 0.201–0.25, 0.251+
  // In percent, that’s 5–10, 10.1–15, 15.1–20, 20.1–25, 25.1+
  rental_backlog: {
    id: "rental_backlog",
    shortLabel: "Rental Housing Backlog",
    metricKey: "rental_gap_to_units_ratio",
    legendTitle: "Rental shortage as % of rental stock (percent, 2029)",
    breaks: [10, 15, 20, 25],
  },

  // For-Sale Housing Backlog
  // You specified 0–0.10, 0.101–0.130, 0.131–0.160, 0.161–0.190, 0.191+
  // In percent, that’s 0–10, 10.1–13, 13.1–16, 16.1–19, 19.1+
  forsale_backlog: {
    id: "forsale_backlog",
    shortLabel: "For-Sale Housing Backlog",
    metricKey: "for_sale_gap_to_units_ratio",
    legendTitle:
      "For-sale shortage as % of for-sale stock (percent, 2029)",
    breaks: [10, 13, 16, 19],
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

// Pick a color from the right palette for each lens + class index 0–4
function getPaletteColor(lensId, classIndex) {
  // Overview palette (slightly darker light color)
  const overviewPalette = ["#fde092ff", "#ff852eff", "#dc0a0aff", "#8c0000ff", "#430400ff"];

  // Housing Shortage per Capita: blues
  const perCapitaPalette = ["#e7f2ffff", "#82b8ffff", "#1f78fdff", "#003cbfff", "#001c6aff"];

  // Affordable Rental Unit Shortage: purples
  const affordableRentalPalette = [
    "#e4dafbff",
    "#c395ffff",
    "#9943eaff",
    "#5c15d7ff",
    "#31027dff",
  ];

  // Rental Housing Backlog: greens
  const rentalBacklogPalette = [
    "#dcffe7ff",
    "#80eb95ff",
    "#13c236ff",
    "#006c17ff",
    "#00290eff",
  ];

  // For-Sale Housing Backlog: pink/red
  const forSaleBacklogPalette = [
    "#ffe8f5ff",
    "#ff6bb8ff",
    "#e80878ff",
    "#980045ff",
    "#540034ff",
  ];

  const palettes = {
    overview: overviewPalette,
    per_capita: perCapitaPalette,
    affordable_rental: affordableRentalPalette,
    rental_backlog: rentalBacklogPalette,
    forsale_backlog: forSaleBacklogPalette,
  };

  const palette = palettes[lensId] || overviewPalette;
  const idx = Math.max(0, Math.min(classIndex, palette.length - 1));
  return palette[idx];
}

function getColorForValue(value, breaks, lensId) {
  const v = Number(value);
  if (!Number.isFinite(v) || !breaks || !breaks.length) {
    // lightest color from that lens if no data
    return getPaletteColor(lensId, 0);
  }

  const [b1, b2, b3, b4] = [
    breaks[0],
    breaks[1] ?? breaks[0],
    breaks[2] ?? breaks[1] ?? breaks[0],
    breaks[3] ?? breaks[2] ?? breaks[1] ?? breaks[0],
  ];

  let classIndex = 0;
  if (v > b4) classIndex = 4;
  else if (v > b3) classIndex = 3;
  else if (v > b2) classIndex = 2;
  else if (v > b1) classIndex = 1;
  else classIndex = 0;

  return getPaletteColor(lensId, classIndex);
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

  // 1) Housing Shortage Overview lens
  //    shows: pop2029, housing_shortage, housing_gap_rentals, housing_gap_for_sale
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

  // 2) Housing Shortage per Capita lens
  //    shows: pop2029, shortage_per_1000_2029, shortage_per_1000_household_2029
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

  // 3) Affordable Rental Unit Shortage lens
  //    shows: housing_gap_rentals, percent_rental_units_50_ami
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
      label: "Shortage of units affordable at ≤50% AMI (as % of rentals, 2029)",
      value: formatPercent(percent50AMI),
    });

  // 4) Rental Housing Backlog lens
  //    shows: rental_gap_to_units_ratio, housing_gap_rentals, percent_rental_units_50_ami
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
      label: "Shortage of units affordable at ≤50% AMI (as % of rentals, 2029)",
      value: formatPercent(percent50AMI),
    });

  // 5) For-Sale Housing Backlog lens
  //    shows: for_sale_gap_to_units_ratio, housing_gap_for_sale
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

// ---------- Fit map to North Carolina bounds ----------

function FitBoundsToNC() {
  const map = useMap();

  useEffect(() => {
    try {
      if (!map) return;
      if (!ncCounties || typeof ncCounties !== "object") return;

      const layer = L.geoJSON(ncCounties);
      const bounds = layer.getBounds();

      if (bounds && bounds.isValid && bounds.isValid()) {
        // Extra padding on bottom-right to push NC slightly up and left
        map.fitBounds(bounds, {
          paddingTopLeft: [10, 10],
          paddingBottomRight: [210, 210],
        });
      }
    } catch (error) {
      console.error("FitBoundsToNC error:", error);
    }
  }, [map]);

  return null;
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
      div.style.maxWidth = "260px"; // 👈 add this

      const cfg = LENS_CONFIG[activeLensId];
const titleText = cfg ? cfg.legendTitle : "Legend";

const title = document.createElement("div");
title.style.fontWeight = "700";
title.style.marginBottom = "8px";
title.style.fontSize = "14px";
title.style.letterSpacing = "0.02em";

// If this lens defines legendTitleLines, render each line separately
if (cfg && Array.isArray(cfg.legendTitleLines)) {
  cfg.legendTitleLines.forEach((line) => {
    const lineDiv = document.createElement("div");
    lineDiv.textContent = line;
    title.appendChild(lineDiv);
  });
} else {
  // fallback: single-line title
  title.textContent = titleText;
}

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
        const color = getColorForValue(midValue, breaksToUse, activeLensId);


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
  const activeLens = LENS_CONFIG[activeLensId];

  return (
    <div className={`lens-card lens-card-${activeLensId}`}>
      {/* Translucent header bar */}
      <div className={`lens-card-header lens-card-header-${activeLensId}`}>
        <span className="lens-card-header-label">Heatmap lens</span>
        <span className="lens-card-header-active">
          {activeLens?.shortLabel || "Select view"}
        </span>
      </div>

      {/* Inner content of the panel */}
      <div className="lens-card-inner">
        <div className="lens-card-title">Viewing heatmap data for:</div>
        <div className="lens-options">
          {LENS_ORDER.map((id) => {
            const cfg = LENS_CONFIG[id];
            const isActive = id === activeLensId;
            return (
              <button
                key={id}
                type="button"
                className={`lens-option${
                  isActive ? " lens-option-active" : ""
                }`}
                onClick={() => setActiveLensId(id)}
              >
                <span
                  className={`lens-dot lens-dot-${id}${
                    isActive ? " lens-dot-active" : ""
                  }`}
                  aria-hidden="true"
                />
                <span className="lens-label-text">{cfg.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}





// ---------- NcMap main component ----------

export default function NcMap() {
  const [activeLensId, setActiveLensId] = useState("overview");

  // Grab the active lens config (including fixed breaks)
  const lensConfig = LENS_CONFIG[activeLensId];

  // Use the static breaks defined above; 4 breakpoints → 5 classes
  const breaks = lensConfig?.breaks ?? [];


  function style(feature) {
    const v = getMetricValue(feature, activeLensId);
    return {
      fillColor: getColorForValue(v, breaks, activeLensId),
      weight: 1.2,
      opacity: 1,
      color: "#000000", // black outlines
      dashArray: "",
      fillOpacity: 0.85,
    };
  }

  // ✅ Make sure onEachCounty is defined and in scope
  const onEachCounty = useCallback(
    (feature, layer) => {
      try {
        const props = feature?.properties ?? {};
        const html = buildPopupHTML(activeLensId, props);

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
              color: "#000000", // thicker border on hover
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              target.bringToFront();
            }
          },
          mouseout: (e) => {
            const target = e.target;
            target.setStyle({
              weight: 1.2,
              color: "#000000",
            });
          },
        });
      } catch (error) {
        console.error("Popup error:", error, feature);
      }
    },
    [activeLensId]
  );

  return (
    <div className="map-root">
      <MapContainer
        center={[35.7596, -79.0193]}  // fallback; FitBoundsToNC will override
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        {/* Auto-fit NC, slightly up and left */}
        <FitBoundsToNC />

        <GeoJSON
          key={activeLensId}          // 🔁 re-create layer when lens changes
          data={ncCounties}
          style={style}
          onEachFeature={onEachCounty}
        />

        <Legend activeLensId={activeLensId} breaks={breaks} />
      </MapContainer>

      <LensSelector
        activeLensId={activeLensId}
        setActiveLensId={setActiveLensId}
      />
    </div>
  );
}

