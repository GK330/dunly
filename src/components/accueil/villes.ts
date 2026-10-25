// Partagé entre le globe (composant client) et la page d'accueil (composant serveur)

export type Coordonnees = [number, number];

export const PARIS: Coordonnees = [48.8566, 2.3522];

// Villes reliées à Paris : des relances qui partent partout dans le monde
export const VILLES: { nom: string; position: Coordonnees }[] = [
  { nom: "Montréal", position: [45.5017, -73.5673] },
  { nom: "Dakar", position: [14.7167, -17.4677] },
  { nom: "Abidjan", position: [5.36, -4.0083] },
  { nom: "Casablanca", position: [33.5731, -7.5898] },
  { nom: "Bruxelles", position: [50.8503, 4.3517] },
  { nom: "Genève", position: [46.2044, 6.1432] },
  { nom: "New York", position: [40.7128, -74.006] },
  { nom: "Kinshasa", position: [-4.4419, 15.2663] },
  { nom: "Dubaï", position: [25.2048, 55.2708] },
  { nom: "Tokyo", position: [35.6762, 139.6503] },
  { nom: "São Paulo", position: [-23.5505, -46.6333] },
];
