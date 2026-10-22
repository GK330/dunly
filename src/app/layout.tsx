import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";
import EnTete from "@/components/EnTete";
import Mouvement from "@/components/Mouvement";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dunly",
  description: "L'outil anti-impayés des indépendants : relances automatiques et suivi des encaissements.",
};

export const viewport: Viewport = {
  themeColor: "#FF6A00",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${bricolage.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Mouvement>
          <EnTete />
          {children}
        </Mouvement>
      </body>
    </html>
  );
}
