import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./liquid-glass.css";
import { GlassMaterial } from "@/components/glass-material";

export const metadata: Metadata = {
  title: "Waspada | Driver monitoring",
  description: "Live driver drowsiness monitoring dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body data-theme="light" data-glass="on"><div className="glass-environment" aria-hidden="true"><div className="landscape-ridge ridge-distant" /><div className="landscape-ridge ridge-middle" /><div className="landscape-ridge ridge-near" /><div className="landscape-light" /></div><GlassMaterial />{children}</body>
    </html>
  );
}
