"use client";

import dynamic from "next/dynamic";

const NcMap = dynamic(() => import("./NcMap"), { ssr: false });

export default function Home() {
  return <NcMap />;
}
