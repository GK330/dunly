import { controleBase } from "@/lib/controles";
import { executerControle } from "@/lib/statut";

export const dynamic = "force-dynamic";

const ENTETES = { "Cache-Control": "no-store" };

export async function GET() {
  // Interrupteur de démonstration, pour tester la chaîne d'alerte d'UptimeRobot
  if (process.env.SIMULER_PANNE === "true") {
    return Response.json({ statut: "indisponible" }, { status: 503, headers: ENTETES });
  }

  let base = await executerControle(controleBase);

  // Premier appel après une période d'inactivité : le démarrage à froid de la fonction
  // peut dépasser le délai du contrôle. Une seconde tentative évite une fausse alerte.
  if (base.statut === "en_panne") {
    base = await executerControle(controleBase);
  }
  const disponible = base.statut !== "en_panne";

  return Response.json(
    { statut: disponible ? "ok" : "indisponible", verifieLe: new Date().toISOString() },
    { status: disponible ? 200 : 503, headers: ENTETES }
  );
}
