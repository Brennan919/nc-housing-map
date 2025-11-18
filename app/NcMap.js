"use client";

import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import ncCounties from "./nc-counties-merged.json"; // merged GeoJSON from Mapshaper
console.log(ncCounties.features[0].properties)

// ---------- Helper: compute numeric value safely ----------
function getShortageValue(feature) {
  // Adjust property name if needed; the merged GeoJSON should have "housing_shortage"
  const p = feature && feature.properties;
  if (!p) return 0;
  // Try multiple possible property names (robustness)
  const candidates = ["housing_shortage", "housing_units", "shortage", "shortage_units"];
  for (const k of candidates) {
    if (k in p && p[k] !== null && p[k] !== undefined && p[k] !== "") {
      const n = Number(String(p[k]).replace(/[, ]+/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

// ---------- NcMap component ----------
export default function NcMap() {
  // compute array of all shortage values once (useMemo so it's computed only on mount or when data changes)
  const values = useMemo(() => {
    const arr = (ncCounties.features || []).map((f) => getShortageValue(f));
    // filter out zeros if you want to exclude missing; we'll keep zeros but they will be lowest color
    return arr;
  }, []);

  // compute max and dynamic breakpoints
  const maxVal = useMemo(() => {
    return values.length ? Math.max(...values) : 0;
  }, [values]);

  // If maxVal is 0 (all missing), we set default breaks to show something reasonable
const breaks = useMemo(() => {
  if (!values.length) return [0];
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  // 6 breaks (0%, 20%, 40%, 60%, 80%, 100%)
  const arr = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map(quantile);
  return Array.from(new Set(arr)); // unique, sorted
}, [values]);

  // color scale using computed breaks (light -> dark)
 function getColor(shortage) {
  const v = Number(shortage) || 0;
  return v > 100000 ? "#4B000F" :     // deep maroon
         v > 30000  ? "#800026" :     // dark red
         v > 15000  ? "#BD0026" :     // red
         v > 10000  ? "#E31A1C" :     // orange-red
         v > 5000   ? "#FD8D3C" :     // orange
         v > 0      ? "#FED976" :     // pale yellow
                      "#FFEDA0";      // very pale yellow (no data)
}


  // style for each county polygon
  function style(feature) {
    const v = getShortageValue(feature);
    return {
      fillColor: getColor(v),
      weight: 0.8,           // border stroke width
      opacity: 1,
      color: "black",        // border color set to black (was white)
      dashArray: "",         // no dashed border
      fillOpacity: 0.8,
    };
  }

  // popup per county — reference the correct property
function onEachCounty(feature, layer) {
  const name = feature.properties.NAME || "Unknown County";
  const shortage = getShortageValue(feature);
  const pop = Number(feature.properties.population) || 0;
  const perCapita = pop ? (shortage / pop) * 1000 : null;

  const shortageText = shortage
    ? new Intl.NumberFormat().format(shortage)
    : "No data";
  const popText = pop
    ? new Intl.NumberFormat().format(pop)
    : "No data";
  const ratioText = perCapita
    ? perCapita.toFixed(1)
    : "n/a";

  // 🧠 NEW: Create styled HTML popup
  const popupHTML = `
    <div style="
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #003366;
      background: #f7f9fc;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      border: 1px solid #cfd8dc;
      min-width: 200px;
      ">
      <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; color: #111;">
        ${name} County
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 6px 0;">
      <div style="margin: 6px 0; display: flex; align-items: center;">
        <span style="margin-right: 6px;">🏠</span>
        <span>Housing Shortage:&nbsp;<strong>${shortageText}</strong></span>
      </div>
      <div style="margin: 6px 0; display: flex; align-items: center;">
        <span style="margin-right: 6px;">👥</span>
        <span>Population:&nbsp;<strong>${popText}</strong></span>
      </div>
      <div style="margin: 6px 0; display: flex; align-items: center;">
        <span style="margin-right: 6px;">📊</span>
        <span>Shortage / 1,000 people:&nbsp;<strong>${ratioText}</strong></span>
      </div>
    </div>
  `;

  layer.bindPopup(popupHTML, {
    maxWidth: 260,
    closeButton: true,
    autoPan: true,
    className: "custom-popup",
  });

  // Optional: Tooltip (keep as before)
  const tooltipHTML = `<strong>${name}</strong><br/>${shortageText} shortage`;
  layer.bindTooltip(tooltipHTML, {
    sticky: true,
    direction: "top",
    offset: [0, -4],
    opacity: 0.9,
  });

  // Hover highlight (unchanged)
  layer.on({
    mouseover: (e) => {
      const target = e.target;
      target.setStyle({
        weight: 2,
        color: "#000",
        fillOpacity: 0.95,
      });
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        target.bringToFront();
      }
    },
    mouseout: (e) => {
      geojsonRef && geojsonRef.resetStyle(e.target);
    },
  });
}



  // Keep a ref to the GeoJSON layer for resetStyle; we use a closure ref pattern
  let geojsonRef = null;
  function onGeoJsonReady(layer) {
    geojsonRef = layer;
  }

  // Legend component nested so it can read breaks and getColor
  function Legend() {
  const map = useMap();

  useEffect(() => {
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "legend-leaflet");

      // --- Larger container for readability ---
      div.style.background = "white";
      div.style.padding = "16px 20px";
      div.style.borderRadius = "14px";
      div.style.boxShadow = "0 0 15px rgba(0,0,0,0.3)";
      div.style.fontSize = "14px";
      div.style.lineHeight = "20px";
      div.style.color = "#222";
      div.style.width = "220px";
      div.style.maxWidth = "250px";

      // --- Title ---
      const title = document.createElement("div");
      title.style.fontWeight = "700";
      title.style.marginBottom = "10px";
      title.style.fontSize = "15px";
      title.textContent = "Housing Shortage (units)";
      div.appendChild(title);

      // --- Threshold-based swatches ---
      const thresholds = [0, 5000, 10000, 15000, 30000, 100000];
      thresholds.forEach((from, i) => {
        const to = thresholds[i + 1];
        const color = getColor((from + (to || from)) / 2);
        const rangeLabel = to
          ? `${from.toLocaleString()} – ${to.toLocaleString()}`
          : `${from.toLocaleString()} +`;

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.marginBottom = "6px";

        const sw = document.createElement("span");
        sw.style.width = "22px";
        sw.style.height = "14px";
        sw.style.background = color;
        sw.style.display = "inline-block";
        sw.style.marginRight = "10px";
        sw.style.border = "1px solid #999";
        row.appendChild(sw);

        const t = document.createTextNode(rangeLabel);
        row.appendChild(t);
        div.appendChild(row);
      });

      // --- Footer note ---
      const note = document.createElement("div");
      note.style.marginTop = "10px";
      note.style.fontSize = "11px";
      note.style.color = "#555";
      note.textContent = "Click or hover for details";
      div.appendChild(note);

      return div;
    };

    legend.addTo(map);
    return () => legend.remove();
  }, [map]);

  return null;
}



  return (
    <MapContainer
      center={[35.7596, -79.0193]}
      zoom={6}


      style={{ height: "100vh", width: "100%" }}
    >

      <GeoJSON
        data={ncCounties}
        style={style}
        onEachFeature={onEachCounty}
        // onEachFeature receives (feature, layer); onGeoJsonReady will be called when layer is available
        ref={(layer) => {
          if (layer && layer.getLayers) {
            onGeoJsonReady(layer);
          }
        }}
      />
      <Legend />
    </MapContainer>
  );
}
