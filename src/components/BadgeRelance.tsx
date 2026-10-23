import { LIBELLES_STATUT_RELANCE, type StatutRelance } from "@/lib/relances";

export default function BadgeRelance({ statut }: { statut: StatutRelance }) {
  const { libelle, classes } = LIBELLES_STATUT_RELANCE[statut];

  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${classes}`}>{libelle}</span>;
}
