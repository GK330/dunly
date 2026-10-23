import "server-only";
import { envoyerEmail } from "@/lib/email";
import { echapperHtml, paragraphesHtml } from "@/lib/html";
import type { ClientAdmin } from "@/lib/supabase/admin";

// E-mails envoyés à l'indépendant lui-même. Le garde-fou de envoyerEmail s'applique aussi.

export async function adresseUtilisateur(supabase: ClientAdmin, userId: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  const adresse = data.user?.email;

  if (error || !adresse) {
    throw new Error("Adresse e-mail de l'utilisateur introuvable.");
  }

  return adresse;
}

type Lien = { libelle: string; url: string };

export async function notifierUtilisateur(
  supabase: ClientAdmin,
  userId: string,
  message: { sujet: string; texte: string; liens: Lien[] }
) {
  const destinataire = await adresseUtilisateur(supabase, userId);

  const boutons = message.liens
    .map(
      (lien) =>
        `<a href="${echapperHtml(lien.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px">${echapperHtml(lien.libelle)}</a>`
    )
    .join("");

  await envoyerEmail({
    destinataire,
    sujet: message.sujet,
    html: `${paragraphesHtml(message.texte)}\n<p>${boutons}</p>`,
    texte: `${message.texte}\n\n${message.liens.map((l) => `${l.libelle} : ${l.url}`).join("\n")}`,
  });
}
