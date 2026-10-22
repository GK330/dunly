"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

type Lien = { href: string; libelle: string };

// Navigation de l'en-tête : la pastille orange glisse d'un onglet à l'autre
export default function NavPrincipale({ liens }: { liens: Lien[] }) {
  const chemin = usePathname();

  function estActif(href: string) {
    return chemin.startsWith(href);
  }

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_80%,transparent)] [scrollbar-width:none] md:[mask-image:none]">
      {liens.map((lien) => {
        const actif = estActif(lien.href);

        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              actif ? "text-white" : "text-brun hover:bg-abricot/50 hover:text-cacao"
            }`}
          >
            {actif && (
              <motion.span
                layoutId="onglet-actif"
                className="onglet-actif absolute inset-0 rounded-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
              />
            )}
            <span className="relative">{lien.libelle}</span>
          </Link>
        );
      })}
    </nav>
  );
}
