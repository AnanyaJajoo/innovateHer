import type { Metadata } from "next";
import "./globals.css";
import VantaBackground from "./VantaBackground";

export const metadata: Metadata = {
  title: "AI Image Detector — Dashboard",
  description: "Metrics and stats for AI image detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased relative overflow-x-hidden">
        <VantaBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
