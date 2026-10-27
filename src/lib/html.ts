// Remplace les caractères spéciaux HTML : une donnée saisie par l'utilisateur
// ne doit jamais pouvoir injecter de balises dans l'e-mail
export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function paragraphesHtml(texte: string): string {
  return texte
    .split(/\n{2,}/)
    .map((paragraphe) => `<p>${echapperHtml(paragraphe).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
