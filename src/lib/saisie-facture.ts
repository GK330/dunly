import "server-only";
import { LIMITES } from "@/lib/facture";
import type { ClientServeur } from "@/lib/supabase/server";
import {
  dateObligatoire,
  ErreurValidation,
  estUuid,
  montantObligatoire,
  texteObligatoire,
} from "@/lib/validation";

export type SaisieFacture = {
  client_id: string;
  numero: string;
  montant_ttc: number;
  emise_le: string;
  echeance: string;
};

// Valide les champs d'une facture complète, saisie à la main ou corrigée après lecture du PDF
export async function lireSaisieFacture(
  supabase: ClientServeur,
  corps: Record<string, unknown>
): Promise<SaisieFacture> {
  if (!estUuid(corps.client_id)) {
    throw new ErreurValidation("Choisissez le client de cette facture.");
  }

  const numero = texteObligatoire(corps.numero, "Le numéro de facture", LIMITES.numeroMax);
  const montant_ttc = montantObligatoire(corps.montant_ttc, LIMITES.montantMax);
  const emise_le = dateObligatoire(corps.emise_le, "La date d'émission");
  const echeance = dateObligatoire(corps.echeance, "La date d'échéance");

  if (echeance < emise_le) {
    throw new ErreurValidation("L'échéance ne peut pas précéder la date d'émission.");
  }

  // Le client doit appartenir à l'utilisateur : la session filtre la lecture
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", corps.client_id)
    .maybeSingle();

  if (!client) {
    throw new ErreurValidation("Client introuvable.");
  }

  return { client_id: client.id, numero, montant_ttc, emise_le, echeance };
}
