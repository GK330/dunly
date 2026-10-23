import { describe, expect, it } from "vitest";
import {
  choisirTon,
  composerEmailRelance,
  MENTION_PENALITES,
  MODELES_RELANCE,
  niveauAPreparer,
  niveauDu,
  PHRASE_DEJA_REGLE,
  scoreDeRisque,
  verifierCorps,
  type ValeursRelance,
} from "@/lib/relances";

const VALEURS: ValeursRelance = {
  client: "Boulangerie Martin",
  numero: "2026-042",
  montant: "1 200,00 €",
  emise_le: "01/09/2026",
  echeance: "01/10/2026",
};

const CORPS_VALIDE =
  "Je me permets de revenir vers vous au sujet de la facture {{numero}} d’un montant de {{montant}}, arrivée à échéance le {{echeance}}. Il s’agit sans doute d’un oubli : pourriez-vous procéder à son règlement ?";

describe("niveauDu", () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [14, 1],
    [15, 2],
    [29, 2],
    [30, 3],
    [90, 3],
  ])("%i jours de retard → niveau %i", (jours, niveau) => {
    expect(niveauDu(jours)).toBe(niveau);
  });
});

describe("verifierCorps (anti-hallucination)", () => {
  it("accepte un corps qui n'utilise que les balises autorisées", () => {
    expect(verifierCorps(CORPS_VALIDE)).toEqual({ valide: true, raisons: [] });
  });

  it.each([
    ["un montant en chiffres", "Merci de régler les 1 200 € de la facture {{numero}} rapidement, nous comptons sur vous pour ce paiement."],
    ["une monnaie", "Merci de régler la somme due en euros pour la facture {{numero}}, nous comptons sur vous pour ce paiement."],
    ["une date", "Merci de régler la facture {{numero}} avant le quinze mars, nous comptons sur vous pour ce paiement attendu."],
    ["un mois", "Merci de régler la facture {{numero}} avant la fin de novembre, nous comptons sur vous pour ce paiement."],
    ["un jour de la semaine", "Merci de régler la facture {{numero}} d’ici vendredi, nous comptons sur vous pour ce paiement attendu."],
    ["une date relative", "Merci de régler la facture {{numero}} dès demain, nous comptons sur vous pour ce paiement attendu ici."],
    ["un nombre en lettres", "Merci de régler la facture {{numero}} sous trente jours, nous comptons sur vous pour ce paiement."],
    ["une balise inconnue", "Merci de régler la facture {{numero}} sur le compte {{iban}}, nous comptons sur vous pour ce paiement."],
    ["un lien", "Merci de régler la facture {{numero}} sur https://exemple.com/payer, nous comptons sur vous pour ce paiement."],
    ["une adresse e-mail", "Merci de régler la facture {{numero}} et d’écrire à compta@exemple.com, nous comptons sur vous pour cela."],
  ])("refuse un corps qui contient %s", (_cas, corps) => {
    expect(verifierCorps(corps).valide).toBe(false);
  });

  it("refuse un corps trop court", () => {
    expect(verifierCorps("Merci de payer.").valide).toBe(false);
  });

  it("les modèles fixes de repli passent eux-mêmes la vérification", () => {
    for (const modele of Object.values(MODELES_RELANCE)) {
      expect(verifierCorps(modele)).toEqual({ valide: true, raisons: [] });
    }
  });
});

describe("composerEmailRelance", () => {
  it("insère les valeurs de la base et la phrase « déjà réglé » à chaque niveau", () => {
    for (const niveau of [1, 2, 3] as const) {
      const email = composerEmailRelance({
        niveau,
        corps: CORPS_VALIDE,
        valeurs: VALEURS,
        lienPaiement: "https://dunly.test/payer/abc",
        signature: "Léa Martin",
      });

      expect(email.texte).toContain("facture 2026-042 d’un montant de 1 200,00 €");
      expect(email.texte).toContain(PHRASE_DEJA_REGLE);
      expect(email.texte).toContain("https://dunly.test/payer/abc");
      expect(email.texte).not.toContain("{{");
      expect(email.texte.includes(MENTION_PENALITES)).toBe(niveau === 3);
    }
  });

  it("rappelle les pénalités et l'indemnité de 40 € au niveau 3", () => {
    const email = composerEmailRelance({
      niveau: 3,
      corps: MODELES_RELANCE[3],
      valeurs: VALEURS,
      lienPaiement: null,
      signature: "",
    });

    expect(email.texte).toContain("indemnité forfaitaire pour frais de recouvrement de 40 €");
    expect(email.texte).not.toContain("Régler par carte");
  });

  it("échappe les valeurs dans la version HTML", () => {
    const email = composerEmailRelance({
      niveau: 1,
      corps: CORPS_VALIDE,
      valeurs: { ...VALEURS, numero: "<script>alert(1)</script>" },
      lienPaiement: null,
      signature: "Léa",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("ton et score de risque", () => {
  it("ton chaleureux pour un client fidèle à son premier retard", () => {
    expect(choisirTon(1, { nombre_factures: 8, nombre_retards: 1, retard_moyen_jours: 4 })).toContain(
      "chaleureux"
    );
  });

  it("ton ferme pour des retards répétés", () => {
    expect(choisirTon(1, { nombre_factures: 6, nombre_retards: 4, retard_moyen_jours: 25 })).toContain(
      "ferme"
    );
  });

  it("score de risque", () => {
    expect(scoreDeRisque({ nombre_factures: 5, nombre_retards: 0, retard_moyen_jours: 0 }).niveau).toBe("faible");
    expect(scoreDeRisque({ nombre_factures: 5, nombre_retards: 1, retard_moyen_jours: 8 }).niveau).toBe("moyen");
    expect(scoreDeRisque({ nombre_factures: 5, nombre_retards: 3, retard_moyen_jours: 12 }).niveau).toBe("eleve");
  });
});

describe("niveauAPreparer", () => {
  it("prépare la première relance dès le 3ᵉ jour de retard", () => {
    expect(niveauAPreparer(2, 0, null)).toBe(0);
    expect(niveauAPreparer(3, 0, null)).toBe(1);
  });

  it("ne saute jamais de niveau, même pour une facture saisie très en retard", () => {
    expect(niveauAPreparer(45, 0, null)).toBe(1);
    expect(niveauAPreparer(45, 1, 10)).toBe(2);
  });

  it("attend au moins une semaine après le dernier envoi", () => {
    expect(niveauAPreparer(20, 1, 3)).toBe(0);
    expect(niveauAPreparer(20, 1, 7)).toBe(2);
  });

  it("ne prépare rien quand le niveau dû est déjà envoyé", () => {
    expect(niveauAPreparer(10, 1, 20)).toBe(0);
    expect(niveauAPreparer(60, 3, 30)).toBe(0);
  });
});
