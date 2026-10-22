import { describe, expect, it } from "vitest";
import { normaliserExtraction } from "@/lib/extraction";
import { aujourdhuiParis, joursDeRetard, statutAffiche } from "@/lib/facture";
import { calculerIndicateurs } from "@/lib/tableau-de-bord";
import { analyserMontant, estDateISO } from "@/lib/validation";

describe("analyserMontant", () => {
  it.each([
    ["1234.5", 1234.5],
    ["1 234,56 €", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    [99.999, 100],
    ["douze", null],
    ["12,345", null],
    ["", null],
  ])("%s → %s", (entree, attendu) => {
    expect(analyserMontant(entree)).toBe(attendu);
  });
});

describe("estDateISO", () => {
  it("refuse les dates impossibles ou mal formées", () => {
    expect(estDateISO("2026-02-28")).toBe(true);
    expect(estDateISO("2026-02-30")).toBe(false);
    expect(estDateISO("16/10/2026")).toBe(false);
    expect(estDateISO("1999-12-31")).toBe(false);
  });
});

describe("en retard : calculé, jamais stocké", () => {
  const facture = { brouillon: false, statut: "en_attente" as const, echeance: "2026-10-10" };

  it("en retard le lendemain de l'échéance", () => {
    expect(statutAffiche(facture, "2026-10-10")).toBe("en_attente");
    expect(statutAffiche(facture, "2026-10-11")).toBe("en_retard");
    expect(joursDeRetard(facture, "2026-10-16")).toBe(6);
  });

  it("une facture payée n'est jamais en retard", () => {
    expect(statutAffiche({ ...facture, statut: "payee" }, "2026-12-01")).toBe("payee");
  });

  it("la date du jour est celle de Paris", () => {
    expect(aujourdhuiParis(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
  });
});

describe("calculerIndicateurs", () => {
  const base = { brouillon: false, payee_le: null, echeance: "2026-11-30" };

  it("calcule encaissé, attente, retard, URSSAF et « tu peux te verser » en centimes", () => {
    const indicateurs = calculerIndicateurs(
      [
        { ...base, montant_ttc: 1000.1, statut: "payee", payee_le: "2026-10-05T10:00:00Z" },
        { ...base, montant_ttc: 500.2, statut: "payee", payee_le: "2026-10-31T23:30:00Z" },
        { ...base, montant_ttc: 300, statut: "payee", payee_le: "2026-09-15T10:00:00Z" },
        { ...base, montant_ttc: 250, statut: "en_attente" },
        { ...base, montant_ttc: 120.55, statut: "en_attente", echeance: "2026-10-01" },
        { ...base, montant_ttc: 999, statut: "en_attente", brouillon: true },
      ],
      0.246,
      "2026-10-16"
    );

    // Le paiement du 31/10 à 23 h 30 UTC tombe le 1er novembre à Paris : hors mois
    expect(indicateurs.encaisseCeMois).toBe(1000.1);
    expect(indicateurs.enAttente).toBe(250);
    expect(indicateurs.enRetard).toBe(120.55);
    expect(indicateurs.aMettreDeCote).toBe(246.02);
    expect(indicateurs.tuPeuxTeVerser).toBe(754.08);
    expect(indicateurs.nombreEnRetard).toBe(1);
  });
});

describe("normaliserExtraction", () => {
  const reponse = {
    client_nom: "Boulangerie Martin",
    client_email: "compta@boulangerie-martin.fr",
    numero: "2026-042",
    montant_ttc: "1 200,00",
    emise_le: "2026-09-01",
    echeance: "",
  };

  it("valide les champs et déduit une échéance à 30 jours si elle manque", () => {
    const extraction = normaliserExtraction(reponse);
    expect(extraction).toMatchObject({
      montant_ttc: 1200,
      echeance: "2026-10-01",
      echeance_deduite: true,
      champs_a_verifier: [],
    });
  });

  it("écarte les valeurs invalides proposées par l'IA et les signale", () => {
    const extraction = normaliserExtraction({
      ...reponse,
      client_email: "pas-une-adresse",
      montant_ttc: "-50",
      echeance: "2026-08-01",
    });

    expect(extraction.client_email).toBeNull();
    expect(extraction.montant_ttc).toBeNull();
    expect(extraction.champs_a_verifier).toEqual(
      expect.arrayContaining(["e-mail du client", "montant TTC", "échéance"])
    );
  });
});
