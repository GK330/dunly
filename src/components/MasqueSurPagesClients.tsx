"use client";

import { usePathname } from "next/navigation";

// Pages destinées aux clients de l'indépendant (paiement) : jamais l'en-tête de l'application,
// même si la personne qui paie est connectée à Dunly dans le même navigateur
const PAGES_CLIENTS = ["/paiement", "/payer"];

export default function MasqueSurPagesClients({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();

  if (PAGES_CLIENTS.some((prefixe) => chemin.startsWith(prefixe))) {
    return null;
  }

  return children;
}
