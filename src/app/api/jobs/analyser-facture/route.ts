import * as Sentry from "@sentry/nextjs";
import { estLectureFiable, type Extraction } from "@/lib/extraction";
import { extraireFacture } from "@/lib/extraire-facture";
import { estReessayable, messageErreurIA } from "@/lib/ia";
import { extraireTextePdf } from "@/lib/pdf";
import { NOMBRE_REESSAIS, verifierSignatureQStash } from "@/lib/qstash";
import { creerClientAdmin, type ClientAdmin } from "@/lib/supabase/admin";
import { preparerRelanceImmediate } from "@/lib/tournee-relances";
import { estUuid } from "@/lib/validation";

export const maxDuration = 60;

// Un PDF dont on ne tire presque aucun texte est probablement une image scannée
const TEXTE_MIN = 30;

class ErreurDefinitive extends Error {}

// Retrouve le client parmi ceux de l'utilisateur, par e-mail puis par nom ;
// à défaut, le crée avec les informations lues sur la facture
async function trouverOuCreerClient(
  supabase: ClientAdmin,
  userId: string,
  extraction: Extraction
): Promise<string | null> {
  if (extraction.client_email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .eq("email", extraction.client_email)
      .limit(1);
    if (data?.[0]) return data[0].id;
  }

  if (extraction.client_nom) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .ilike("nom", extraction.client_nom.replace(/[%_\\]/g, "\\$&"))
      .limit(1);
    if (data?.[0]) return data[0].id;
  }

  if (!extraction.client_nom) return null;

  // Le worker n'a pas de session : l'auteur est indiqué explicitement
  const { data: client, error } = await supabase
    .from("clients")
    .insert({ user_id: userId, nom: extraction.client_nom, email: extraction.client_email })
    .select("id")
    .single();

  if (error) throw error;
  return client.id;
}

async function traiter(request: Request) {
  const { factureId } = await request.json();
  const tentative = Number(request.headers.get("Upstash-Retried") ?? "0");

  if (!estUuid(factureId)) {
    return Response.json({ resultat: "ignoré" });
  }

  // Le worker n'a pas d'utilisateur connecté : il utilise le client administrateur
  const supabase = creerClientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select("id, user_id, fichier_chemin, etat_analyse")
    .eq("id", factureId)
    .maybeSingle();

  // Idempotence : une facture absente ou déjà lue n'est pas analysée une seconde fois
  if (!facture || facture.etat_analyse !== "en_cours" || !facture.fichier_chemin) {
    return Response.json({ resultat: "ignoré" });
  }

  Sentry.setUser({ id: facture.user_id });

  try {
    // 1. Extraction du texte du PDF
    const texte = await extraireTextePdf(supabase, facture.fichier_chemin);

    if (texte.length < TEXTE_MIN) {
      throw new ErreurDefinitive(
        "Ce PDF ne contient pas de texte lisible (document scanné ?). Saisissez la facture à la main."
      );
    }

    // 2. Lecture des champs par le modèle d'IA, vérifiés ensuite par le code
    const extraction = await extraireFacture(texte, {
      id: facture.id,
      nom: "analyse-facture",
      userId: facture.user_id,
      metadata: { tentativeQStash: tentative + 1 },
    });

    // 3. Client retrouvé ou créé automatiquement
    const clientId = await trouverOuCreerClient(supabase, facture.user_id, extraction);

    // 4. Lecture fiable : la facture est validée et prend son statut tout de suite.
    // Sinon elle reste « À vérifier ». Dans les deux cas, l'utilisateur peut la corriger,
    // et aucune relance ne part sans sa validation (paramètre validation_relances).
    const enregistrer = (validee: boolean, champsAVerifier: string[]) =>
      supabase
        .from("factures")
        .update({
          client_id: clientId,
          numero: extraction.numero,
          montant_ttc: extraction.montant_ttc,
          emise_le: extraction.emise_le,
          echeance: extraction.echeance,
          brouillon: !validee,
          donnees_extraites: {
            ...extraction,
            champs_a_verifier: champsAVerifier,
            validee_automatiquement: validee,
            modele: process.env.AI_MODEL,
          },
          etat_analyse: "prete",
          message_erreur: null,
        })
        .eq("id", facture.id);

    const fiable = clientId !== null && estLectureFiable(extraction);
    let { error } = await enregistrer(fiable, extraction.champs_a_verifier);

    // Numéro déjà utilisé (le même PDF déposé deux fois ?) : la facture reste à vérifier
    if (fiable && error?.code === "23505") {
      ({ error } = await enregistrer(false, ["numéro (déjà utilisé par une autre facture)"]));
    }

    if (error) throw error;

    // Facture validée et déjà en retard : sa relance est préparée tout de suite
    if (fiable) {
      preparerRelanceImmediate(facture.id);
    }

    return Response.json({ resultat: fiable ? "validée" : "à vérifier" });
  } catch (erreur) {
    console.error(`Échec de la lecture du PDF (tentative ${tentative + 1}) :`, erreur);
    Sentry.captureException(erreur, {
      tags: { tache: "analyse-facture", tentative: String(tentative + 1) },
      extra: { factureId: facture.id },
    });

    const definitive = erreur instanceof ErreurDefinitive;

    // Erreur passagère et tentatives restantes : on demande à QStash de réessayer
    if (!definitive && estReessayable(erreur) && tentative < NOMBRE_REESSAIS) {
      return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
    }

    // Erreur définitive ou dernière tentative : on enregistre l'échec
    await supabase
      .from("factures")
      .update({
        etat_analyse: "erreur",
        message_erreur: definitive ? erreur.message : messageErreurIA(erreur),
      })
      .eq("id", facture.id);

    return Response.json({ resultat: "erreur" });
  }
}

export const POST = verifierSignatureQStash(traiter);
