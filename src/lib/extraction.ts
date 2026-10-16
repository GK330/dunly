import { ajouterJours, LIMITES } from "@/lib/facture";
import { analyserMontant, estDateISO, estEmail } from "@/lib/validation";

// Réponse brute attendue du modèle : uniquement des chaînes, vides si l'information est absente
export type ReponseExtraction = {
  client_nom: string;
  client_email: string;
  numero: string;
  montant_ttc: string;
  emise_le: string;
  echeance: string;
};

// Champs retenus après vérification par le code : un champ invalide devient null
// et sera corrigé par l'utilisateur avant validation de la facture
export type Extraction = {
  client_nom: string | null;
  client_email: string | null;
  numero: string | null;
  montant_ttc: number | null;
  emise_le: string | null;
  echeance: string | null;
  echeance_deduite: boolean;
  champs_a_verifier: string[];
};

// Délai de paiement appliqué quand la facture n'indique pas d'échéance
export const DELAI_PAIEMENT_PAR_DEFAUT = 30;

const CHAMPS = ["client_nom", "client_email", "numero", "montant_ttc", "emise_le", "echeance"];

// Une lecture est fiable si tous les champs sont présents, aucun n'est douteux,
// et l'échéance figure vraiment sur la facture : elle peut alors être validée sans attendre
export function estLectureFiable(extraction: Extraction): boolean {
  return (
    extraction.client_nom !== null &&
    extraction.numero !== null &&
    extraction.montant_ttc !== null &&
    extraction.emise_le !== null &&
    extraction.echeance !== null &&
    !extraction.echeance_deduite &&
    extraction.champs_a_verifier.length === 0
  );
}

export function estReponseExtraction(donnees: unknown): donnees is ReponseExtraction {
  if (typeof donnees !== "object" || donnees === null) return false;
  const d = donnees as Record<string, unknown>;
  return CHAMPS.every((champ) => typeof d[champ] === "string");
}

export function normaliserExtraction(reponse: ReponseExtraction): Extraction {
  const aVerifier: string[] = [];

  function texte(valeur: string, max: number, champ: string): string | null {
    const propre = valeur.trim();
    if (!propre) return null;
    if (propre.length > max) {
      aVerifier.push(champ);
      return null;
    }
    return propre;
  }

  const client_nom = texte(reponse.client_nom, LIMITES.nomMax, "client");
  const numero = texte(reponse.numero, LIMITES.numeroMax, "numéro");

  let client_email: string | null = reponse.client_email.trim().toLowerCase() || null;
  if (client_email && !estEmail(client_email)) {
    aVerifier.push("e-mail du client");
    client_email = null;
  }

  let montant_ttc = analyserMontant(reponse.montant_ttc);
  if (reponse.montant_ttc.trim() && (montant_ttc === null || montant_ttc <= 0 || montant_ttc > LIMITES.montantMax)) {
    aVerifier.push("montant TTC");
    montant_ttc = null;
  }

  let emise_le: string | null = reponse.emise_le.trim() || null;
  if (emise_le && !estDateISO(emise_le)) {
    aVerifier.push("date d'émission");
    emise_le = null;
  }

  let echeance: string | null = reponse.echeance.trim() || null;
  if (echeance && (!estDateISO(echeance) || (emise_le !== null && echeance < emise_le))) {
    aVerifier.push("échéance");
    echeance = null;
  }

  // Sans échéance lisible, on propose la date d'émission + 30 jours, signalée à l'utilisateur
  let echeance_deduite = false;
  if (!echeance && emise_le) {
    echeance = ajouterJours(emise_le, DELAI_PAIEMENT_PAR_DEFAUT);
    echeance_deduite = true;
  }

  for (const [valeur, champ] of [
    [client_nom, "client"],
    [numero, "numéro"],
    [montant_ttc, "montant TTC"],
    [emise_le, "date d'émission"],
  ] as const) {
    if (valeur === null && !aVerifier.includes(champ)) aVerifier.push(champ);
  }

  return {
    client_nom,
    client_email,
    numero,
    montant_ttc,
    emise_le,
    echeance,
    echeance_deduite,
    champs_a_verifier: aVerifier,
  };
}
