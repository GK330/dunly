import "server-only";
import { Resend } from "resend";
import { FORMAT_UUID } from "@/lib/validation";

// Réception des réponses des clients par Resend (adresse <id>.resend.app, sans nom de domaine).
// Chaque relance part avec sa propre adresse de réponse : relance-<id de la relance>@<domaine>.

// Clé distincte de RESEND_API_KEY : lire les e-mails reçus demande un accès complet,
// alors que l'envoi se contente d'une clé limitée. Une clé par usage.
export function creerClientReception(): Resend {
  const cle = process.env.RESEND_API_KEY_RECEPTION;
  if (!cle) {
    throw new Error("La variable RESEND_API_KEY_RECEPTION n'est pas définie.");
  }
  return new Resend(cle);
}

export function adresseReponse(relanceId: string): string | undefined {
  const domaine = process.env.EMAIL_DOMAINE_RECEPTION?.trim();
  return domaine ? `relance-${relanceId}@${domaine}` : undefined;
}

// Retrouve l'identifiant de la relance dans les adresses de destination
export function relanceDepuisDestinataires(adresses: string[]): string | null {
  for (const adresse of adresses) {
    const correspondance = /relance-([0-9a-f-]{36})@/i.exec(adresse);
    if (correspondance && FORMAT_UUID.test(correspondance[1])) {
      return correspondance[1].toLowerCase();
    }
  }
  return null;
}

// Texte brut d'un e-mail HTML, à défaut de version texte
export function texteDepuisHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}
