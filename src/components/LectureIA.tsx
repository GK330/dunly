"use client";

import { Sparkle } from "@phosphor-icons/react";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

// Étapes réellement suivies pendant la lecture d'une facture : l'utilisateur voit que l'IA travaille
const ETAPES_LECTURE = [
  "Lecture du PDF…",
  "Repérage du client…",
  "Relevé du montant TTC…",
  "Vérification des dates…",
  "Contrôle des champs…",
];

// Version courte, dans une ligne du tableau des factures
export function LectureIALigne() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-abricot/70 px-2.5 py-0.5 text-mandarine-fonce">
      <Sparkle weight="duotone" className="size-3.5 animate-pulse" aria-hidden />
      <AITextLoading
        texts={ETAPES_LECTURE}
        interval={1600}
        label="L’IA lit la facture"
        className="justify-start text-xs font-medium text-mandarine-fonce"
      />
    </span>
  );
}

// Version détaillée, sur la fiche d'une facture en cours de lecture
export function LectureIAPanneau() {
  return (
    <div className="carte mt-6 flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="onglet-actif flex size-12 items-center justify-center rounded-2xl text-white">
        <Sparkle weight="duotone" className="size-6 animate-pulse" aria-hidden />
      </span>
      <AITextLoading
        texts={ETAPES_LECTURE}
        interval={1600}
        label="L’IA lit la facture"
        showElapsed
        className="font-titre text-2xl"
      />
      <p className="max-w-md text-sm text-brun">
        L’IA lit votre facture. Cette page se met à jour toute seule dès que la lecture est
        terminée.
      </p>
    </div>
  );
}
