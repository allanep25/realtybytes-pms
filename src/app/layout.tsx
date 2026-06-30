import type { Metadata } from "next";
import "./globals.css";
import { HOTEL_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${HOTEL_NAME} — Hotel Management`,
  description: "Hotel management system for RealtyBytes",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
