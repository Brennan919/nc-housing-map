"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const NcMap = dynamic(() => import("./NcMap"), { ssr: false });

export default function Home() {
  const [showAbout, setShowAbout] = useState(true);

  return (
    <div className="page-shell">
      {/* Fixed header with title */}
      <header className="site-header">
  <div className="site-header-inner">
    <div className="site-title-block">
      <h1 className="site-title">
        North Carolina Housing Shortage Map by Brien Brennan
      </h1>
      <p className="site-subtitle">
        County-by-county visualization of the 2029 housing supply gap
      </p>
    </div>
  </div>
</header>


      {/* Main content: about panel + map */}
      {/* Main content: about panel + map */}
<main className="main-content">
  <section className="about-panel" aria-label="About this map">
    <div className="about-panel-header-row">
      <h2 className="about-title">About this map</h2>
      <button
        type="button"
        className="about-toggle"
        onClick={() => setShowAbout((prev) => !prev)}
      >
        {showAbout ? "Hide details" : "Show details"}
      </button>
    </div>

    <div
      className={
        "about-panel-body" +
        (showAbout ? "" : " about-panel-body-collapsed")
      }
    >
      <p className="about-text">
        This map was created by Brien Brennan, and inspired by HR&amp;A
        Advisors&rsquo; housing scarcity dashboard for the Florida
        Apartments Association. It is the first-ever interactive,
        county-level map of North Carolina&rsquo;s housing shortage. It
        visualizes the state&apos;s housing supply gap in 2029, based on
        research conducted by Bowen National Research for the NC Chamber.
        View different data using the heatmap selector tool, and click on
        counties to see details about the shortage.
      </p>
    </div>
  </section>

  <section className="page-map-wrapper">
    <NcMap />
  </section>
</main>


      {/* Fixed footer with contact + copyright */}
      <footer className="site-footer">
        <p className="footer-text">
          For questions or comments, email{" "}
          <a href="mailto:brien.brennan@gmail.com">
            brien.brennan@gmail.com
          </a>
          .&nbsp;&copy; 2025 Brien Brennan.
        </p>
      </footer>
    </div>
  );
}

