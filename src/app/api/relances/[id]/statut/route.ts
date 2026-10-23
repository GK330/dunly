import type { StatutRelance } from "@/lib/relances";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurValidation, estUuid, lireCorps } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

// Transitions autorisées à l'utilisateur : statut demandé → statuts de départ possibles
const TRANSITIONS: Partial<Record<StatutRelance, StatutRelance[]>> = {
  validee: ["brouillon"],
  brouillon: ["validee"],
  annulee: ["brouillon", "validee"],
};

export async function POST(request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("modifier une relance");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Relance");
  }

  try {
    const corps = await lireCorps(request);
    const statut = corps.statut as StatutRelance;
    const depart = TRANSITIONS[statut];

    if (!depart) {
      throw new ErreurValidation("Statut invalide.");
    }

    let requete = supabase
      .from("relances")
      .update({ statut })
      .eq("id", id)
      .in("statut", depart);

    // On ne valide pas une relance dont le texte n'est pas encore rédigé
    if (statut === "validee") {
      requete = requete.not("contenu", "is", null);
    }

    const { data, error } = await requete.select("id, statut").maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ErreurValidation("Cette relance ne peut pas passer à ce statut.");
    }

    return Response.json(data);
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors du changement de statut de la relance");
  }
}
