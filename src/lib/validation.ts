// Validation des données reçues par le back : le front n'est jamais une source de confiance.
// Ces fonctions servent aussi à vérifier les champs extraits par le modèle d'IA.

export class ErreurValidation extends Error {}

export const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FORMAT_EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function estUuid(valeur: unknown): valeur is string {
  return typeof valeur === "string" && FORMAT_UUID.test(valeur);
}

export function texteObligatoire(valeur: unknown, champ: string, max: number): string {
  const texte = typeof valeur === "string" ? valeur.trim() : "";

  if (!texte || texte.length > max) {
    throw new ErreurValidation(`${champ} est obligatoire (${max} caractères maximum).`);
  }

  return texte;
}

export function estEmail(valeur: string): boolean {
  return valeur.length <= 254 && FORMAT_EMAIL.test(valeur);
}

export function emailFacultatif(valeur: unknown): string | null {
  const texte = typeof valeur === "string" ? valeur.trim().toLowerCase() : "";
  if (!texte) return null;

  if (!estEmail(texte)) {
    throw new ErreurValidation("L'adresse e-mail n'est pas valide.");
  }

  return texte;
}

// Accepte 1234.5, "1234,50", "1 234,50 €" ou "1.234,50" : renvoie null si illisible
export function analyserMontant(valeur: unknown): number | null {
  if (typeof valeur === "number") {
    return Number.isFinite(valeur) ? Math.round(valeur * 100) / 100 : null;
  }

  if (typeof valeur !== "string") return null;

  let texte = valeur.replace(/[\s  €]|EUR/gi, "");
  if (!texte) return null;

  // « 1.234,50 » : le point sépare les milliers, la virgule les décimales
  if (texte.includes(",") && texte.includes(".")) {
    texte = texte.lastIndexOf(",") > texte.lastIndexOf(".")
      ? texte.replace(/\./g, "").replace(",", ".")
      : texte.replace(/,/g, "");
  } else {
    texte = texte.replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;
  return Math.round(Number(texte) * 100) / 100;
}

export function montantObligatoire(valeur: unknown, max: number): number {
  const montant = analyserMontant(valeur);

  if (montant === null || montant <= 0 || montant > max) {
    throw new ErreurValidation("Le montant TTC doit être un nombre positif, avec au plus deux décimales.");
  }

  return montant;
}

// Date au format AAAA-MM-JJ, réelle (pas de 31 février) et plausible
export function estDateISO(valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;

  const [annee, mois, jour] = valeur.split("-").map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));

  return (
    annee >= 2000 &&
    annee <= 2100 &&
    date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
  );
}

export function dateObligatoire(valeur: unknown, champ: string): string {
  if (!estDateISO(valeur)) {
    throw new ErreurValidation(`${champ} est obligatoire et doit être une date valide.`);
  }

  return valeur;
}

// Lit le corps JSON d'une requête : un corps illisible ou qui n'est pas un objet est refusé
export async function lireCorps(request: Request): Promise<Record<string, unknown>> {
  try {
    const corps = await request.json();
    if (typeof corps === "object" && corps !== null && !Array.isArray(corps)) {
      return corps;
    }
  } catch {
    // Traité ci-dessous
  }

  throw new ErreurValidation("Requête invalide.");
}
