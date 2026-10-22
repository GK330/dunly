"use client";

import { useReducedMotion } from "motion/react";
import CountUp from "@/components/reactbits/CountUp";
import { formaterMontant } from "@/lib/facture";

// Montant en euros qui défile comme un compteur de caisse au chargement
export default function MontantAnime({
  montant,
  className = "",
}: {
  montant: number;
  className?: string;
}) {
  const reduire = useReducedMotion();

  if (reduire) {
    return <span className={className}>{formaterMontant(montant)}</span>;
  }

  return (
    <span className={className} aria-label={formaterMontant(montant)}>
      <CountUp
        to={montant}
        decimals={2}
        separator={" "}
        decimalSeparator=","
        suffix={" €"}
        mode="roll"
        trigger="load"
        duration={1.4}
      />
    </span>
  );
}
