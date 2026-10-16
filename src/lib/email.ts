import "server-only";
import { Resend } from "resend";
import { echapperHtml } from "@/lib/html";

export type Email = {
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
  repondreA?: string;
};

export type Redirection = {
  active: boolean;
  adresse: string | null;
  bloque: boolean;
};

// Garde-fou : hors production, aucun e-mail ne doit atteindre une vraie adresse,
// qu'il s'agisse d'un client relancé ou de l'utilisateur. Tous les envois sont
// alors redirigés vers EMAIL_REDIRECTION, et bloqués si elle n'est pas définie.
// En production, la même variable, si elle est définie, active un mode démonstration.
export function lireRedirection(): Redirection {
  const production = process.env.VERCEL_ENV === "production";
  const adresse = process.env.EMAIL_REDIRECTION?.trim() || null;

  return {
    active: adresse !== null,
    adresse,
    bloque: !production && adresse === null,
  };
}

export async function envoyerEmail(email: Email): Promise<string | undefined> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    throw new Error("La variable RESEND_API_KEY n'est pas définie.");
  }

  const expediteur = process.env.EMAIL_EXPEDITEUR || "Encaisse <onboarding@resend.dev>";
  const redirection = lireRedirection();

  if (redirection.bloque) {
    throw new Error(
      "Garde-fou : EMAIL_REDIRECTION doit être définie hors production. Envoi bloqué."
    );
  }

  const destinataire = redirection.adresse ?? email.destinataire;
  const sujet = redirection.active
    ? `[Test → ${email.destinataire}] ${email.sujet}`
    : email.sujet;
  const avertissement = redirection.active
    ? `<p style="padding:8px;background:#fef3c7;color:#92400e">Garde-fou : cet e-mail était destiné à ${echapperHtml(email.destinataire)}.</p>`
    : "";

  const resend = new Resend(cle);
  const { data, error } = await resend.emails.send({
    from: expediteur,
    to: [destinataire],
    subject: sujet,
    html: `${avertissement}${email.html}`,
    text: redirection.active
      ? `[Garde-fou : destiné à ${email.destinataire}]\n\n${email.texte}`
      : email.texte,
    replyTo: email.repondreA,
  });

  if (error) {
    throw new Error(`Envoi refusé par Resend : ${error.message}`);
  }

  return data?.id;
}
