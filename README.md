# Dunly

## Présentation

Dunly est un outil anti-impayés pour les travailleurs indépendants : graphistes, développeurs, consultants…

**Lire les factures.** L’indépendant dépose ses factures en PDF. Un modèle d’IA les lit et relève le client, le montant et l’échéance. Le code valide ces champs, puis l’utilisateur les vérifie.

**Relancer les retards.** Dès qu’une facture a 3 jours de retard, Dunly prépare une relance et prévient l’indépendant par e-mail. Celui-ci la relit, puis l’envoie d’un clic avec « Valider et envoyer maintenant ».

- Les relances suivantes, à J+15 puis J+30, sont préparées chaque jour par une tournée planifiée. Elles partent sous la validation de l’indépendant.
- Le texte de chaque relance est rédigé par l’IA selon l’historique du client.
- Chaque relance contient un lien de paiement par carte.

**Lire les réponses.** Les réponses des clients sont classées par l’IA. Selon la catégorie, les relances sont mises en pause ou arrêtées.

**Suivre les encaissements.** Le tableau de bord indique :

- ce qui est encaissé ce mois-ci ;
- ce qui est en attente ou en retard ;
- ce qu’il faut mettre de côté pour l’URSSAF ;
- ce que l’indépendant peut se verser.

Le principe reprend celui des fiches de révision des TD : un utilisateur connecté fournit un contenu (le PDF d’une facture), un modèle d’IA hébergé le transforme en résultat structuré (les champs de la facture), et ce résultat est enregistré, rattaché à son auteur et consultable plus tard.

## Liens

- **Production :** <https://dunly-tau.vercel.app>
- **Page de statut (UptimeRobot) :** <https://stats.uptimerobot.com/BFFIWRvpQ7>
- **Vidéo de démonstration :** à compléter (lien accessible sans compte)

## Architecture

Le navigateur ne communique qu’avec le back Next.js, exécuté en fonctions serverless sur Vercel (région `cdg1`, Paris). Seul le back détient les clés d’API.

| Service | Rôle |
| --- | --- |
| Vercel | Hébergement, fonctions serverless, déploiement continu avec porte de qualité (lint, types, tests) |
| Groq (API compatible OpenAI) | Lecture des factures, rédaction des relances, classification des réponses |
| Supabase Database | Clients, factures, relances, réponses ; Row Level Security sur toutes les tables |
| Supabase Auth | Connexion sans mot de passe, par lien magique |
| Upstash Redis | Quotas par utilisateur (préfixe `dunly:`) et historique des contrôles de `/admin` |
| Upstash QStash | Traitements en arrière-plan et tournée quotidienne planifiée des relances |
| Resend | Envoi des relances et des notifications, réception des réponses (`<id>.resend.app`) |
| Stripe (mode test) | Paiement des factures par carte |

### Briques au choix et pourquoi

| Brique | Pourquoi elle est indispensable à Dunly |
| --- | --- |
| Stockage de fichiers (Supabase Storage) | Les factures sont des PDF : bucket privé `factures`, un dossier par utilisateur, 5 Mo maximum |
| Génération asynchrone (QStash) | La lecture d’un PDF, la rédaction et l’envoi des relances se font hors requête, avec nouvelles tentatives ; la tournée quotidienne est une planification QStash |
| Temps réel (Supabase Realtime) | Une facture passe de « Lecture en cours » à « À vérifier » sans rechargement ; relances et réponses s’affichent dès leur arrivée |
| Notifications par e-mail (Resend) | Cœur du produit : relances aux clients, « Relance prête », alertes de réponse et de paiement, sans bloquer le traitement en cas d’échec |
| Suivi des erreurs (Sentry) | Les workers tournent sans utilisateur : sans Sentry, un échec de relance passerait inaperçu |
| Observabilité de l’IA (Langfuse) | Chaque lecture, rédaction et classification est tracée (tokens, latence, coût) avec l’identifiant de la facture, de la relance ou de la réponse |
| Surveillance externe (UptimeRobot) | Route `/api/health` surveillée et page de statut publique |
| Gestion des secrets (Infisical) | Une trentaine de secrets, synchronisés vers Vercel en Production et en Preview |

Chaque brique est contrôlée dans `/admin`, page réservée aux administrateurs (`ADMIN_EMAILS`) :

- 17 contrôles (Vercel, IA, base, Auth, stockage, Redis, QStash, tournée des relances, Realtime, Resend, réception, Stripe, Sentry, UptimeRobot, Langfuse, Infisical, déploiement continu) ;
- un historique par environnement, rafraîchi automatiquement.

### Sécurité

- **Contrôle des requêtes :** `getUser()` côté serveur sur chaque route et chaque page, validation de toutes les entrées, messages d’erreur sans détail technique.
- **Clé secrète Supabase :** le client administrateur n’est utilisé que dans les workers, les webhooks et la page publique de paiement.
- **Garde-fou e-mail :** hors production, aucun e-mail ne part vers une vraie adresse. Tout est redirigé vers `EMAIL_REDIRECTION`, et l’envoi est bloqué si cette variable manque.
- **Signatures et idempotence :** les webhooks Stripe et Resend sont signés, les workers QStash vérifient la signature, et chaque traitement est idempotent.
- **Lien de paiement public :** jeton aléatoire de 64 caractères (jamais l’identifiant de la facture), montant toujours lu en base, ouvertures limitées. Seule une clé Stripe de test est acceptée.

### Quotas par utilisateur

Le quota du fournisseur d’IA est partagé : chaque utilisateur dispose de sa propre part (Upstash Redis, fenêtre glissante).

| Usage | Quota | Une fois le quota atteint |
| --- | --- | --- |
| Lecture de PDF | 10 par heure | Refus clair (429, `Retry-After`, quota restant affiché) |
| Rédaction de relance | 30 par jour | Modèle de texte fixe, signalé sur la relance |
| Classification de réponse | 50 par jour | Catégorie « autre » sans appel à l’IA, signalée à l’utilisateur |
| Ouverture d’un lien de paiement | 10 par heure et par lien | Page « Trop de tentatives » |

Si Redis est indisponible, l’application continue de fonctionner (fail open) et l’incident est journalisé.

## Modèle d’IA

- **Fournisseur :** Groq, offre gratuite sans carte bancaire.
- **Modèle :** `openai/gpt-oss-20b`, configuré par `AI_BASE_URL`, `AI_API_KEY` et `AI_MODEL`.
- **Justification :**
  - Il est rapide et gratuit.
  - Il gère les sorties structurées en JSON strict, indispensables aux trois usages.
  - Ses réponses suffisent pour extraire des champs et classer un e-mail.
  - Pour une meilleure rédaction des relances, il suffit de passer à `openai/gpt-oss-120b`, sans modifier le code.

L’IA ne décide jamais seule :

- **Lecture des factures :** les champs extraits sont validés par le code (montant, dates, e-mail). Une lecture fiable valide la facture ; sinon elle reste « À vérifier ». Dans les deux cas, l’utilisateur peut corriger.
- **Relances (anti-hallucination) :** l’IA n’écrit que le corps du message. Le montant, le numéro, les dates, le lien de paiement, les mentions légales et la signature sont insérés par le code depuis la base, via des balises (`{{montant}}`…). Un texte qui contient un chiffre, une monnaie, un mois, un jour, une date relative, un nombre en lettres, un lien ou une balise inconnue est remplacé par un modèle fixe.
- **Validation humaine :** par défaut, aucune relance ne part sans la validation de l’utilisateur (réglage `validation_relances`).
- **Réponses des clients :** le texte du client est placé entre des délimiteurs aléatoires et traité comme une donnée. Le modèle choisit une catégorie dans une liste fixe (JSON avec `enum`). Le serveur valide la réponse et utilise « autre » en cas de doute. Seul le code applique les actions, et jamais « marquer payée ».
- **Calculs du tableau de bord :** réalisés en TypeScript, en centimes. L’IA n’y intervient pas.

## Structure de données

Scripts versionnés, à exécuter dans l’ordre dans le SQL Editor de Supabase : `supabase/0001_socle.sql` puis `supabase/0002_fonctionnalites.sql`.

| Table | Rôle | Relations |
| --- | --- | --- |
| `parametres` | Nom, signature, taux de cotisations, `validation_relances`, `paiement_carte_actif` | 1 ligne par utilisateur |
| `clients` | Clients de l’indépendant | `user_id` → `auth.users` |
| `factures` | Numéro, montant TTC, dates, statut (`en_attente`, `payee`), brouillon, état de la lecture du PDF (`etat_analyse`), jeton de paiement, pause ou arrêt des relances | `client_id` → `clients`, `user_id` |
| `relances` | Niveau (1 à 3), statut (`brouillon`, `validee`, `envoyee`, `annulee`), date prévue, corps avec balises, origine (`ia`, `modele`, `utilisateur`) | `facture_id` → `factures`, `user_id` |
| `reponses_clients` | Réponses reçues, catégorie, date promise, correction par l’utilisateur | `facture_id`, `relance_id`, `user_id` |
| `evenements_stripe` | Événements Stripe déjà traités (idempotence) | aucune |
| Vue `statistiques_clients` | Nombre de factures et de retards, retard moyen, calculés en SQL (`security_invoker`) | `clients` |

« En retard » n’est jamais stocké. Il se calcule : statut `en_attente` et échéance dépassée, à la date de Paris.

**Règles de sécurité :**

- La Row Level Security est activée sur toutes les tables.
- Chaque utilisateur ne lit et ne modifie que ses propres lignes (`(select auth.uid()) = user_id`).
- Une facture ne peut être rattachée qu’à un client du même utilisateur.
- Les tables écrites par le serveur (`relances` en création, `reponses_clients` en création, `evenements_stripe`) n’ont pas de politique d’insertion côté utilisateur.
- Le bucket `factures` est privé, et chacun n’accède qu’à son propre dossier.

## Lancer le projet en local

**Prérequis :** Node.js 22 ou supérieur, un compte sur chaque service et la CLI Infisical (facultative).

Sous Windows PowerShell, dans trois terminaux :

```powershell
npm install
Copy-Item .env.example .env.local   # puis compléter les valeurs (ou utiliser Infisical)

npx @upstash/qstash-cli dev          # terminal 1 : QStash local (tâches de fond)
npm run dev:secrets                  # terminal 2 : l'application, secrets injectés par Infisical
                                     #   (ou : npm run dev avec .env.local)
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # terminal 3, facultatif : paiements
```

Avant chaque envoi de code, la même porte de qualité que Vercel :

```powershell
npm run lint; if ($?) { npm run typecheck }; if ($?) { npm test }
```

**Variables d’environnement :**

- **Liste complète :** voir `.env.example`, sans valeur.
- **En local :** `EMAIL_REDIRECTION` est obligatoire. Elle doit être l’adresse du compte Resend tant qu’aucun domaine n’est vérifié.

**Tests automatisés (Vitest) :**

- calculs du tableau de bord et statut « en retard » ;
- lecture des montants et des dates, validation des champs extraits ;
- niveaux de relance et délai entre deux envois ;
- anti-hallucination des relances ;
- liste fixe et actions de la classification.

## Méthode de travail

- Un commit par étape du sujet, en français.
- À partir de l’étape 5, chaque étape est développée sur sa propre branche (`etape-5-relances`, `etape-6-paiement`…), puis fusionnée par pull request.
- La branche `main` est protégée : pull request obligatoire et vérification Vercel (lint, types, tests, construction) réussie avant toute fusion.

## Limites et améliorations possibles

- **Stripe Connect :** l’argent arrive sur un seul compte Stripe, en mode test. En production, chaque indépendant doit être payé directement sur son propre compte : il faut Stripe Connect (comptes connectés, onboarding KYC, `transfer_data` ou paiements directs).
- **Domaine d’envoi :** sans domaine vérifié chez Resend, les e-mails ne peuvent partir que vers l’adresse du compte, et arrivent souvent dans les spams. Un domaine vérifié (SPF, DKIM) réglerait les deux problèmes.
- **Webhooks en local :** Resend ne peut pas joindre un poste local. Le paiement et la réception des réponses se testent donc en production (mode test), ou en local avec la CLI Stripe.
- **Mentions légales :** l’indemnité forfaitaire de 40 € ne s’applique qu’entre professionnels. Il faudrait distinguer les clients particuliers.
- **Une seule base :** le local, les prévisualisations et la production partagent la même base Supabase et le même Redis (seul l’historique de `/admin` est séparé). Les prévisualisations ne sont pas pleinement fonctionnelles, car QStash ne peut pas joindre un déploiement protégé.
- **Tarifs :** la section Tarifs de la page d’accueil est une simulation. Aucun abonnement n’est vendu.
- **Pistes d’amélioration :**
  - relances par SMS ;
  - export comptable ;
  - lecture des PDF scannés (OCR) ;
  - comparaison des modèles d’IA avec les scores Langfuse ;
  - prise en compte des corrections de catégorie pour améliorer la consigne.
