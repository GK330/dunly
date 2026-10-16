import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { ClientAdmin } from "@/lib/supabase/admin";

export const TAILLE_MAX_PDF = 5 * 1024 * 1024;

// Chemin d'un PDF déposé par le navigateur : dossier de l'utilisateur, nom aléatoire
export function estCheminPdfValide(chemin: unknown, userId: string): chemin is string {
  return (
    typeof chemin === "string" &&
    new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`, "i").test(chemin)
  );
}

export async function extraireTextePdf(supabase: ClientAdmin, chemin: string): Promise<string> {
  const { data, error } = await supabase.storage.from("factures").download(chemin);

  if (error || !data) {
    throw new Error(`Téléchargement impossible : ${error?.message ?? "fichier introuvable"}`);
  }

  const pdf = await getDocumentProxy(new Uint8Array(await data.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
