import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import VersionGuard from "@/components/VersionGuard";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "HRM Pilot Web App - Enterprise HR & Attendance Management",
  description: "Comprehensive Human Resource & Biometric Attendance Management System",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HRM Portal",
  },
  formatDetection: {
    telephone: false,
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col font-sans bg-slate-900 text-slate-100"
      >
        <VersionGuard />
        {children}
      </body>
    </html>
  );
}
