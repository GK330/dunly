import { aujourdhuiParis, statutAffiche, type Facture } from "@/lib/facture";

// Tous les calculs se font en centimes, en TypeScript : jamais par l'IA,
// et jamais avec des nombres à virgule qui accumuleraient des erreurs d'arrondi

export type Indicateurs = {
  encaisseCeMois: number;
  enAttente: number;
  enRetard: number;
  aMettreDeCote: number;
  tuPeuxTeVerser: number;
  nombrePayeesCeMois: number;
  nombreEnAttente: number;
  nombreEnRetard: number;
};

type FacturePourCalcul = Pick<
  Facture,
  "montant_ttc" | "statut" | "payee_le" | "brouillon" | "echeance"
>;

function enCentimes(montant: number | null): number {
  return montant === null ? 0 : Math.round(montant * 100);
}

export function calculerIndicateurs(
  factures: FacturePourCalcul[],
  tauxCotisations: number,
  aujourdhui: string
): Indicateurs {
  const moisCourant = aujourdhui.slice(0, 7);

  let encaisse = 0;
  let enAttente = 0;
  let enRetard = 0;
  let nombrePayeesCeMois = 0;
  let nombreEnAttente = 0;
  let nombreEnRetard = 0;

  for (const facture of factures) {
    const statut = statutAffiche(facture, aujourdhui);
    const montant = enCentimes(facture.montant_ttc);

    if (statut === "payee" && facture.payee_le) {
      // Le mois du paiement est celui de Paris, pas celui de l'horloge UTC du serveur
      const moisPaiement = aujourdhuiParis(new Date(facture.payee_le)).slice(0, 7);
      if (moisPaiement === moisCourant) {
        encaisse += montant;
        nombrePayeesCeMois++;
      }
    } else if (statut === "en_retard") {
      enRetard += montant;
      nombreEnRetard++;
    } else if (statut === "en_attente") {
      enAttente += montant;
      nombreEnAttente++;
    }
  }

  const aMettreDeCote = Math.round(encaisse * tauxCotisations);

  return {
    encaisseCeMois: encaisse / 100,
    enAttente: enAttente / 100,
    enRetard: enRetard / 100,
    aMettreDeCote: aMettreDeCote / 100,
    tuPeuxTeVerser: (encaisse - aMettreDeCote) / 100,
    nombrePayeesCeMois,
    nombreEnAttente,
    nombreEnRetard,
  };
}
