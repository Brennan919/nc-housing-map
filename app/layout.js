import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata = {
  title: "North Carolina Housing Shortage Map",
  description:
    "This map was inspired by HR&A Advisors’ housing scarcity dashboard for the Florida Apartments Association. It is the first interactive, county-level map of North Carolina’s housing shortage. It visualizes the state's projected 2029 housing supply gap using research conducted by Bowen National Research for the NC Chamber. Created by Brien Brennan. © 2025 Brien Brennan.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

