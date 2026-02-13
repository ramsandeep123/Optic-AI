import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";

const interResource = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const orbitronResource = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Passport Extractor Pro | Multi-Document Support",
  description: "Extract data from passports and documents using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${interResource.variable} ${orbitronResource.variable}`}>
        <div className="bg-gradient"></div>
        {children}
      </body>
    </html>
  );
}
