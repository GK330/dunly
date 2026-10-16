import { LIBELLES_STATUT, type StatutAffiche } from "@/lib/facture";

export default function BadgeStatut({ statut }: { statut: StatutAffiche }) {
  const { libelle, classes } = LIBELLES_STATUT[statut];

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${classes}`}>{libelle}</span>;
}
