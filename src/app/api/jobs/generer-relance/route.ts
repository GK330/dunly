import * as Sentry from "@sentry/nextjs";
import {
  chargerContexteRelance,
  composerRelance,
  estRelancable,
  type ContexteRelance,
} from "@/lib/contexte-relance";
import { ajouterJours, aujourdhuiParis, formaterDate, formaterMontant } from "@/lib/facture";
import { notifierUtilisateur } from "@/lib/notifications";
import { publierTache, verifierSignatureQStash } from "@/lib/qstash";
import { redigerRelance } from "@/lib/rediger-relance";
import { LIBELLES_NIVEAU, type StatistiquesClient } from "@/lib/relances";
import { creerClientAdmin, type ClientAdmin } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/validation";

export const maxDuration = 60;

const STATISTIQUES_VIDES: StatistiquesClient = {
  nombre_factures: 1,
  nombre_retards: 1,
  retard_moyen_jours: 0,
};

// Effet secondaire : la veille de l'envoi, l'utilisateur est prévenu et peut agir.
// Un échec d'envoi est journalisé, mais ne fait jamais échouer le traitement.
async function notifierVeille(supabase: ClientAdmin, contexte: ContexteRelance) {
  const { relance, facture, parametres } = contexte;
  const appUrl = process.env.APP_URL ?? "";
  const aujourdhui = aujourdhuiParis();
  // Préparée tout de suite (facture qui vient d'être validée) ou la veille de l'envoi
  const immediate = relance.prevue_le <= aujourdhui;
  const quand =
    relance.prevue_le === ajouterJours(aujourdhui, 1)
      ? "demain"
      : `le ${formaterDate(relance.prevue_le)}`;
  const description = `la facture n° ${facture.numero} de ${facture.clients?.nom ?? "votre client"} (${formaterMontant(Number(facture.montant_ttc))}, échue le ${formaterDate(facture.echeance)})`;

  try {
    const apercu = composerRelance(contexte);

    await notifierUtilisateur(supabase, relance.user_id, {
      sujet: immediate
        ? `Relance prête pour la facture n° ${facture.numero}`
        : `Relance prévue ${quand} pour la facture n° ${facture.numero}`,
      texte: [
        immediate
          ? `Une relance est prête pour ${description}.`
          : `Relance prévue ${quand} pour ${description}.`,
        `Niveau ${relance.niveau} : ${LIBELLES_NIVEAU[relance.niveau]}.`,
        parametres.validation_relances
          ? immediate
            ? "Relisez-la, puis envoyez-la d’un clic depuis Dunly."
            : "Elle ne partira que si vous la validez."
          : immediate
            ? "La validation des relances est désactivée : elle part dès maintenant."
            : "Sans action de votre part, elle partira automatiquement.",
        "Déjà payée ? Marquez la facture comme payée : la relance sera annulée.",
        `Aperçu du message :\n\nObjet : ${apercu.sujet}\n\n${apercu.texte}`,
      ].join("\n\n"),
      liens: [
        { libelle: "Marquer payée", url: `${appUrl}/factures/${facture.id}` },
        { libelle: "Voir / modifier la relance", url: `${appUrl}/relances/${relance.id}` },
      ],
    });

    await supabase
      .from("relances")
      .update({ veille_notifiee_le: new Date().toISOString() })
      .eq("id", relance.id);
  } catch (erreur) {
    console.error("Échec de l'envoi de l'e-mail de la veille :", erreur);
    Sentry.captureException(erreur, {
      level: "warning",
      tags: { tache: "notification-veille" },
      extra: { relanceId: relance.id },
    });
  }
}

async function traiter(request: Request) {
  const { relanceId } = await request.json();

  if (!estUuid(relanceId)) {
    return Response.json({ resultat: "ignoré" });
  }

  // Le worker n'a pas d'utilisateur connecté : il utilise le client administrateur
  const supabase = creerClientAdmin();
  const contexte = await chargerContexteRelance(supabase, relanceId);

  // Idempotence : une relance absente, déjà rédigée ou plus en brouillon n'est pas réécrite
  if (!contexte || contexte.relance.statut !== "brouillon" || contexte.relance.contenu !== null) {
    return Response.json({ resultat: "ignoré" });
  }

  const { relance, facture } = contexte;
  Sentry.setUser({ id: relance.user_id });

  // La situation a pu changer depuis la tournée (paiement, pause, arrêt) :
  // on vérifie que la facture sera bien relançable le jour prévu
  if (!estRelancable(facture, relance.prevue_le)) {
    await supabase.from("relances").update({ statut: "annulee" }).eq("id", relance.id);
    return Response.json({ resultat: "annulée" });
  }

  try {
    // 1. Historique du client, calculé en SQL
    const { data: statistiques } = await supabase
      .from("statistiques_clients")
      .select("nombre_factures, nombre_retards, retard_moyen_jours")
      .eq("client_id", facture.client_id)
      .maybeSingle<StatistiquesClient>();

    // 2. Rédaction par l'IA, vérifiée, avec repli sur le modèle fixe
    const redaction = await redigerRelance(relance.niveau, statistiques ?? STATISTIQUES_VIDES, {
      iaAutorisee: true,
      trace: {
        id: relance.id,
        nom: "generation-relance",
        userId: relance.user_id,
        metadata: { niveau: relance.niveau, factureId: facture.id },
      },
    });

    const { data: misAJour, error } = await supabase
      .from("relances")
      .update({
        contenu: redaction.corps,
        origine_contenu: redaction.origine,
        message_generation: redaction.message,
      })
      .eq("id", relance.id)
      .is("contenu", null)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!misAJour) return Response.json({ resultat: "ignoré" });

    // 3. Prévenir l'utilisateur (relance prête, ou la veille de l'envoi)
    contexte.relance.contenu = redaction.corps;
    await notifierVeille(supabase, contexte);

    // 4. Validation désactivée et relance prévue aujourd'hui : elle part sans attendre la tournée
    if (!contexte.parametres.validation_relances && relance.prevue_le <= aujourdhuiParis()) {
      await publierTache(
        "/api/jobs/envoyer-relance",
        { relanceId: relance.id },
        { deduplicationId: `envoyer-${relance.id}-${relance.prevue_le}` }
      );
    }

    return Response.json({ resultat: "rédigée", origine: redaction.origine });
  } catch (erreur) {
    console.error("Échec de la préparation de la relance :", erreur);
    Sentry.captureException(erreur, {
      tags: { tache: "generation-relance" },
      extra: { relanceId: relance.id },
    });

    // Erreur de la base : QStash réessaiera
    return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
  }
}

export const POST = verifierSignatureQStash(traiter);
