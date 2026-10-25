"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "@phosphor-icons/react";

type Formule = {
  nom: string;
  accroche: string;
  mensuel: number;
  annuel: number;
  avantages: string[];
  miseEnAvant?: boolean;
};

// Tarifs fictifs : la section sert de simulation, aucun abonnement n'est vendu
const FORMULES: Formule[] = [
  {
    nom: "Découverte",
    accroche: "Pour essayer Dunly sur vos premières factures.",
    mensuel: 0,
    annuel: 0,
    avantages: [
      "5 factures par mois",
      "Lecture des PDF par l’IA",
      "Relances validées une à une",
      "Tableau de bord des encaissements",
    ],
  },
  {
    nom: "Solo",
    accroche: "Pour l’indépendant qui ne veut plus jamais relancer à la main.",
    mensuel: 9,
    annuel: 7,
    miseEnAvant: true,
    avantages: [
      "Factures illimitées",
      "Relances automatiques sous votre validation",
      "Paiement par carte dans chaque relance",
      "Réponses des clients lues par l’IA",
      "Score de risque de chaque client",
    ],
  },
  {
    nom: "Studio",
    accroche: "Pour les petites équipes et les collectifs.",
    mensuel: 24,
    annuel: 19,
    avantages: [
      "Tout ce qu’offre Solo",
      "Jusqu’à 5 utilisateurs",
      "Une signature par activité",
      "Export comptable",
      "Support prioritaire",
    ],
  },
];

function Prix({ montant }: { montant: number }) {
  return (
    <span className="relative inline-flex h-[1.1em] overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={montant}
          className="inline-block"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
        >
          {montant}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function Tarifs() {
  const [annuel, setAnnuel] = useState(false);

  return (
    <div>
      <div className="flex justify-center">
        <div className="relative flex rounded-full border border-grege bg-white p-1 text-sm font-medium">
          {[
            { valeur: false, libelle: "Mensuel", remise: null },
            { valeur: true, libelle: "Annuel", remise: "−20 %" },
          ].map((option) => (
            <button
              key={option.libelle}
              type="button"
              onClick={() => setAnnuel(option.valeur)}
              aria-pressed={annuel === option.valeur}
              className={`relative rounded-full px-4 py-2 transition-colors ${
                annuel === option.valeur ? "text-white" : "text-brun hover:text-cacao"
              }`}
            >
              {annuel === option.valeur && (
                <motion.span
                  layoutId="periode-tarif"
                  className="onglet-actif absolute inset-0 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {option.libelle}
                {option.remise && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      annuel === option.valeur ? "bg-white/25 text-white" : "bg-abricot text-mandarine-fonce"
                    }`}
                  >
                    {option.remise}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-10 grid gap-5 lg:grid-cols-3">
        {FORMULES.map((formule, index) => (
          <motion.li
            key={formule.nom}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
            className={`relative flex flex-col rounded-3xl border p-7 ${
              formule.miseEnAvant
                ? "border-cacao bg-cacao text-white shadow-2xl shadow-cacao/25 lg:-translate-y-3"
                : "border-grege bg-white"
            }`}
          >
            {formule.miseEnAvant && (
              <span className="onglet-actif absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold text-white">
                Le plus choisi
              </span>
            )}
            <h3 className="font-titre text-xl font-semibold">{formule.nom}</h3>
            <p className={`mt-1 text-sm ${formule.miseEnAvant ? "text-white/70" : "text-brun"}`}>
              {formule.accroche}
            </p>
            <p className="mt-6 flex items-end gap-1">
              <span className="font-titre text-5xl font-bold tracking-tight">
                <Prix montant={annuel ? formule.annuel : formule.mensuel} /> €
              </span>
              <span className={`pb-1.5 text-sm ${formule.miseEnAvant ? "text-white/70" : "text-brun"}`}>
                HT / mois
              </span>
            </p>
            <p className={`mt-1 h-5 text-xs ${formule.miseEnAvant ? "text-white/60" : "text-brun"}`}>
              {annuel && formule.annuel > 0 ? `Soit ${formule.annuel * 12} € facturés par an` : ""}
            </p>

            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {formule.avantages.map((avantage) => (
                <li key={avantage} className="flex items-start gap-2.5">
                  <Check
                    weight="bold"
                    className={`mt-0.5 size-4 shrink-0 ${formule.miseEnAvant ? "text-mandarine" : "text-mandarine-fonce"}`}
                    aria-hidden
                  />
                  {avantage}
                </li>
              ))}
            </ul>

            <Link
              href="/connexion"
              className={`btn mt-8 w-full ${formule.miseEnAvant ? "btn-primaire" : "btn-secondaire"}`}
            >
              {formule.mensuel === 0 ? "Commencer gratuitement" : `Choisir ${formule.nom}`}
            </Link>
          </motion.li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-brun">
        Tarifs donnés à titre de simulation : Dunly est un projet de démonstration, aucun
        abonnement n’est facturé.
      </p>
    </div>
  );
}
