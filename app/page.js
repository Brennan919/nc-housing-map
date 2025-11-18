"use client";

import dynamic from "next/dynamic";

const NcMap = dynamic(() => import("./NcMap"), { ssr: false });

export default function Home() {
  return (
    <main className="page-container">
      <header className="page-header">
        <h1 className="page-title">
          North Carolina 2029 Housing Shortage Map by Brien Brennan
        </h1>
        <h2 className="page-subtitle">
          An interactive, county-by-county look at the state’s projected housing supply gap in 2029
        </h2>
        <p className="page-blurb">
  This map was inspired by HR&amp;A Advisors&rsquo; housing scarcity dashboard
  for the Florida Apartments Association. It is the first interactive,
  county-level map of North Carolina&rsquo;s housing shortage. It visualizes
  the state&apos;s housing supply gap in 2029, based on research conducted
  by Bowen National Research for the NC Chamber. This map was created by
  Brien Brennan. For questions or comments, email{" "}
  <a href="mailto:brien.brennan@gmail.com">brien.brennan@gmail.com</a>.
  &nbsp;&copy; 2025 Brien Brennan.
</p>


      </header>

      <section className="page-map-wrapper">
        <NcMap />
      </section>
    </main>
  );
}
