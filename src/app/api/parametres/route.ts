import { COLONNES_PARAMETRES } from "@/lib/parametres";
import { reponseErreurBase, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurValidation, lireCorps } from "@/lib/validation";

function texteLimite(valeur: unknown, champ: string, max: number): string {
  const texte = typeof valeur === "string" ? valeur.trim() : "";
  if (texte.length > max) {
    throw new ErreurValidation(`${champ} ne doit pas dépasser ${max} caractères.`);
  }
  return texte;
}

export async function PUT(request: Request) {
  // 0. Vérification de la session
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("modifier vos paramètres");
  }

  try {
    // 1. Validation des données
    const corps = await lireCorps(request);
    const nom_affiche = texteLimite(corps.nom_affiche, "Le nom affiché", 100);
    const signature = texteLimite(corps.signature, "La signature", 500);

    // Le taux est saisi en pourcentage (24,6) et enregistré en fraction (0.246)
    const pourcentage = Number(String(corps.taux_cotisations ?? "").replace(",", "."));
    if (!Number.isFinite(pourcentage) || pourcentage < 0 || pourcentage >= 100) {
      throw new ErreurValidation("Le taux de cotisations doit être compris entre 0 et 100 %.");
    }
    const taux_cotisations = Math.round(pourcentage * 100) / 10000;

    if (typeof corps.validation_relances !== "boolean") {
      throw new ErreurValidation("Réglage de validation des relances invalide.");
    }
    const validation_relances = corps.validation_relances;

    if (typeof corps.paiement_carte_actif !== "boolean") {
      throw new ErreurValidation("Réglage du paiement par carte invalide.");
    }
    const paiement_carte_actif = corps.paiement_carte_actif;

    // 2. Une seule ligne par utilisateur : création ou mise à jour
    const { data, error } = await supabase
      .from("parametres")
      .upsert({
        user_id: user.id,
        nom_affiche,
        signature,
        taux_cotisations,
        validation_relances,
        paiement_carte_actif,
        updated_at: new Date().toISOString(),
      })
      .select(COLONNES_PARAMETRES)
      .single();

    if (error) throw error;

    return Response.json(data);
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de l'enregistrement des paramètres");
  }
}
