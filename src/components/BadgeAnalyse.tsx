import type { AnalyseFacture } from "@/lib/facture";

const AFFICHAGE: Record<AnalyseFacture, { libelle: string; classes: string }> = {
  en_cours: { libelle: "Lecture en cours…", classes: "bg-yellow-100 text-yellow-800" },
  prete: { libelle: "Lue par l’IA", classes: "bg-stone-100 text-stone-800" },
  erreur: { libelle: "Lecture échouée", classes: "bg-red-100 text-red-800" },
};

export default function BadgeAnalyse({ analyse }: { analyse: AnalyseFacture }) {
  const { libelle, classes } = AFFICHAGE[analyse];

  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${classes}`}>{libelle}</span>;
}
