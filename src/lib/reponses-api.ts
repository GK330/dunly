import "server-only";
import { ErreurValidation } from "@/lib/validation";

// Réponses communes aux routes de l'application : jamais de détail technique pour l'utilisateur

export function reponseNonConnecte(action: string) {
  return Response.json(
    { erreur: `Votre session a expiré. Reconnectez-vous pour ${action}.` },
    { status: 401 }
  );
}

export function reponseIntrouvable(element: string) {
  return Response.json({ erreur: `${element} introuvable.` }, { status: 404 });
}

// Traduit une erreur de la base de données en message clair.
// Les codes sont ceux de PostgreSQL : 23505 doublon, 23503 clé étrangère,
// 23514 contrainte check, 42501 refus de la Row Level Security.
export function reponseErreurBase(
  erreur: unknown,
  contexte: string,
  messages: { doublon?: string; reference?: string } = {}
) {
  if (erreur instanceof ErreurValidation) {
    return Response.json({ erreur: erreur.message }, { status: 400 });
  }

  const code = (erreur as { code?: string } | null)?.code;

  if (code === "23505") {
    return Response.json(
      { erreur: messages.doublon ?? "Cet élément existe déjà." },
      { status: 409 }
    );
  }

  if (code === "23503") {
    return Response.json(
      { erreur: messages.reference ?? "Cet élément est lié à d’autres données." },
      { status: 409 }
    );
  }

  if (code === "23514" || code === "42501") {
    return Response.json(
      { erreur: "Les données envoyées sont incohérentes ou ne vous appartiennent pas." },
      { status: 400 }
    );
  }

  console.error(`${contexte} :`, erreur);
  return Response.json(
    { erreur: "L'opération a échoué. Réessayez plus tard." },
    { status: 500 }
  );
}
