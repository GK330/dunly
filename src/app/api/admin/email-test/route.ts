import { estAdministrateur } from "@/lib/admin";
import { envoyerEmail, lireRedirection } from "@/lib/email";
import { creerClientServeur } from "@/lib/supabase/server";

// Envoie un e-mail de test à l'administrateur, pour vérifier Resend et le garde-fou
export async function POST() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !estAdministrateur(user.email)) {
    return Response.json({ erreur: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  try {
    const redirection = lireRedirection();
    await envoyerEmail({
      destinataire: user.email,
      sujet: "E-mail de test d'Encaisse",
      html: "<p>Si vous lisez ce message, l'envoi d'e-mails par Resend fonctionne.</p>",
      texte: "Si vous lisez ce message, l'envoi d'e-mails par Resend fonctionne.",
    });

    return Response.json({
      message: redirection.active
        ? `E-mail envoyé, redirigé par le garde-fou vers ${redirection.adresse}.`
        : `E-mail envoyé à ${user.email}.`,
    });
  } catch (erreur) {
    console.error("Échec de l'e-mail de test :", erreur);
    return Response.json(
      { erreur: erreur instanceof Error ? erreur.message : "Envoi impossible." },
      { status: 502 }
    );
  }
}
