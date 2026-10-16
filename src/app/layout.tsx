import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import EnTete from "@/components/EnTete";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Encaisse",
  description: "L'outil anti-impayés des indépendants : relances automatiques et suivi des encaissements.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <EnTete />
        {children}
      </body>
    </html>
  );
}
