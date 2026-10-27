# Dunly

## Présentation

Dunly est un outil anti-impayés pour les travailleurs indépendants (graphistes, développeurs, consultants…). L’idée m’est venue d’un constat simple : quand on est seul, relancer un client qui ne paie pas est à la fois pénible et gênant, alors on repousse, et la trésorerie en souffre.

Avec Dunly, l’indépendant dépose ses factures en PDF. Un modèle d’IA les lit et relève le client, le numéro, le montant et l’échéance. Je vérifie ensuite chaque champ dans le code avant de l’enregistrer.

Dès qu’une facture a trois jours de retard, Dunly prépare une relance et prévient l’indépendant par e-mail, puisqu’il n’est pas forcément sur l’application à ce moment-là. Il relit la relance et l’envoie d’un clic avec « Valider et envoyer maintenant ». Les relances suivantes (J+15, J+30) sont préparées chaque jour par une tournée planifiée, mais rien ne part sans sa validation. Chaque relance contient un lien de paiement par carte. Quand le client répond (« je paie le 20 », « déjà réglé », « je conteste »), sa réponse est classée par l’IA et les relances se mettent en pause ou s’arrêtent.

Le tableau de bord résume le mois : ce qui est encaissé, ce qui est en attente ou en retard, ce qu’il faut mettre de côté pour l’URSSAF, et ce que l’indépendant peut se verser.

J’ai repris le principe des fiches de révision des TD : un utilisateur connecté fournit un contenu (le PDF d’une facture), un modèle d’IA hébergé le transforme en résultat structuré (les champs de la facture), et ce résultat est enregistré, rattaché à son auteur et consultable plus tard.

## Adresse de production

- Application : <https://dunly-tau.vercel.app>
- Page de statut (UptimeRobot) : <https://stats.uptimerobot.com/BFFIWRvpQ7>
- Vidéo de démonstration : à compléter

## Architecture

Le navigateur ne parle qu’au back Next.js, qui tourne en fonctions serverless sur Vercel (région `cdg1`, Paris). Les clés d’API ne quittent jamais le serveur.

| Service | Rôle |
| --- | --- |
| Vercel | Hébergement, fonctions serverless, déploiement continu avec porte de qualité (lint, types, tests, build) |
| Groq | Modèle d’IA : lecture des factures, rédaction des relances, classification des réponses |
| Supabase Database | Clients, factures, relances, réponses, avec Row Level Security sur toutes les tables |
| Supabase Auth | Connexion sans mot de passe, par lien magique |
| Upstash Redis | Quotas par utilisateur et historique des contrôles de `/admin` |
| Upstash QStash | Traitements en arrière-plan et tournée quotidienne des relances |
| Resend | Envoi des relances et des notifications, réception des réponses des clients |
| Stripe (mode test) | Paiement des factures par carte |

### Briques au choix et pourquoi

| Brique | Pourquoi je l’ai prise |
| --- | --- |
| Stockage de fichiers (Supabase Storage) | Les factures sont des PDF : je les range dans un bucket privé, un dossier par utilisateur, 5 Mo maximum |
| Génération asynchrone (QStash) | Lire un PDF ou rédiger une relance prend plusieurs secondes : je le fais hors requête, avec de nouvelles tentatives en cas d’échec. La tournée quotidienne est une planification QStash |
| Temps réel (Supabase Realtime) | La facture passe de « Lecture en cours » au résultat sans recharger la page ; relances et réponses apparaissent dès leur arrivée |
| Notifications par e-mail (Resend) | C’est le cœur du produit : relances aux clients, e-mail « Relance prête », alertes de réponse et de paiement |
| Suivi des erreurs (Sentry) | Mes workers tournent sans utilisateur devant l’écran : sans Sentry, une relance qui échoue passerait inaperçue |
| Observabilité de l’IA (Langfuse) | Chaque appel au modèle est tracé (tokens, latence, coût) avec l’identifiant de la facture ou de la relance |
| Surveillance externe (UptimeRobot) | La route `/api/health` est surveillée en continu, avec une page de statut publique |
| Gestion des secrets (Infisical) | J’ai une trentaine de secrets : ils sont centralisés dans Infisical et synchronisés vers Vercel |

Chaque brique a son contrôle dans `/admin`, une page réservée aux adresses listées dans `ADMIN_EMAILS` (un autre compte obtient une page introuvable). Elle compte 17 contrôles, avec un historique et un rafraîchissement automatique.

### Sécurité

- Chaque route et chaque page vérifie la session côté serveur avec `getUser()`. Toutes les entrées sont validées, et les messages d’erreur ne donnent aucun détail technique.
- Le client administrateur (clé secrète Supabase) ne sert que dans les workers, les webhooks et la page publique de paiement, là où il n’y a pas d’utilisateur connecté.
- Garde-fou e-mail : hors production, aucun e-mail ne peut partir vers une vraie adresse. Tout est redirigé vers `EMAIL_REDIRECTION`, et l’envoi est bloqué si cette variable manque.
- Les webhooks Stripe et Resend sont signés, les workers vérifient la signature de QStash, et tous les traitements sont idempotents (un message reçu deux fois ne fait rien de plus).
- Le lien de paiement utilise un jeton aléatoire de 64 caractères, jamais l’identifiant de la facture, et le montant est toujours relu en base. Seule une clé Stripe de test est acceptée.

### Quotas par utilisateur

Le quota du fournisseur d’IA est partagé entre tous les utilisateurs : j’en donne une part à chacun, sur une fenêtre glissante (Upstash Redis).

| Usage | Quota | Une fois le quota atteint |
| --- | --- | --- |
| Lecture de PDF | 2 par heure | Refus clair, avec le temps à attendre ; le PDF déposé est supprimé |
| Rédaction de relance | 30 par jour | Modèle de texte fixe, signalé sur la relance |
| Classification de réponse | 50 par jour | Catégorie « autre » sans appel à l’IA, signalée à l’utilisateur |
| Ouverture d’un lien de paiement | 10 par heure et par lien | Page « Trop de tentatives » |

J’ai volontairement mis la lecture de PDF à 2 par heure pour pouvoir montrer le refus dans la démonstration. Si Redis tombe en panne, l’application continue de fonctionner (fail open) et l’incident est journalisé.

## Modèle d’IA

- **Fournisseur :** Groq, dont l’offre gratuite ne demande pas de carte bancaire.
- **Modèle :** `openai/gpt-oss-20b`, configuré par `AI_BASE_URL`, `AI_API_KEY` et `AI_MODEL`.
- **Pourquoi ce modèle :** il est rapide, gratuit, et il gère les sorties en JSON strict, dont j’ai besoin pour mes trois usages. Pour extraire des champs ou classer un e-mail, sa qualité suffit. Si je voulais des relances mieux rédigées, il suffirait de passer à `openai/gpt-oss-120b`, sans toucher au code.

Je ne laisse jamais l’IA décider seule :

- **Lecture des factures :** le code valide chaque champ extrait (montant, dates, e-mail). Une lecture complète et fiable valide la facture, sinon elle reste « À vérifier ». Dans les deux cas, l’utilisateur peut corriger.
- **Relances :** l’IA n’écrit que le corps du message. Le montant, le numéro, les dates, le lien de paiement, les mentions légales et la signature sont insérés par le code depuis la base, grâce à des balises (`{{montant}}`…). Si le texte de l’IA contient un chiffre, une monnaie, une date, un nombre en lettres, un lien ou une balise inconnue, je le remplace par un modèle fixe. Dans l’éditeur, les balises s’affichent en pastilles avec leur vraie valeur, et ne peuvent pas être abîmées.
- **Validation humaine :** par défaut, aucune relance ne part sans que l’utilisateur l’ait validée.
- **Réponses des clients :** le texte du client est placé entre des délimiteurs aléatoires et traité comme une simple donnée (protection contre l’injection de consignes). Le modèle doit choisir une catégorie dans une liste fixe ; le serveur vérifie sa réponse et utilise « autre » en cas de doute. Seul le code applique les actions, et il ne marque jamais une facture comme payée.
- **Calculs du tableau de bord :** faits en TypeScript, en centimes. L’IA n’y touche pas.

## Structure de données

Les scripts sont versionnés et s’exécutent dans l’ordre dans le SQL Editor de Supabase : `supabase/0001_socle.sql`, puis `supabase/0002_fonctionnalites.sql`.

| Table | Rôle | Relations |
| --- | --- | --- |
| `parametres` | Nom, signature, taux de cotisations, validation des relances, paiement par carte | 1 ligne par utilisateur |
| `clients` | Clients de l’indépendant | `user_id` → `auth.users` |
| `factures` | Numéro, montant TTC, dates, statut (`en_attente`, `payee`), brouillon, état de la lecture du PDF, jeton de paiement, pause ou arrêt des relances | `client_id` → `clients`, `user_id` |
| `relances` | Niveau (1 à 3), statut (`brouillon`, `validee`, `envoyee`, `annulee`), date prévue, corps avec balises, origine du texte (`ia`, `modele`, `utilisateur`) | `facture_id` → `factures`, `user_id` |
| `reponses_clients` | Réponses reçues, catégorie, date promise, correction par l’utilisateur | `facture_id`, `relance_id`, `user_id` |
| `evenements_stripe` | Événements Stripe déjà traités, pour ne jamais compter un paiement deux fois | aucune |
| Vue `statistiques_clients` | Nombre de factures et de retards, retard moyen, calculés en SQL (`security_invoker`) | `clients` |

Le statut « en retard » n’est jamais stocké : il se calcule à partir du statut `en_attente` et de l’échéance, à la date de Paris.

**Règles de sécurité :**

- La Row Level Security est activée sur toutes les tables : chaque utilisateur ne voit et ne modifie que ses propres lignes (`(select auth.uid()) = user_id`).
- Une facture ne peut être rattachée qu’à un client du même utilisateur.
- Les tables remplies par le serveur (`relances` et `reponses_clients` en création, `evenements_stripe`) n’ont pas de politique d’insertion côté utilisateur.
- Le bucket `factures` est privé, et chacun n’accède qu’à son propre dossier.

## Lancer le projet en local

**Prérequis :** Node.js 22 ou plus, un compte sur chaque service, et la CLI Infisical (facultative).

Sous Windows PowerShell, dans trois terminaux :

```powershell
npm install
Copy-Item .env.example .env.local   # puis compléter les valeurs (ou passer par Infisical)

npx @upstash/qstash-cli dev          # terminal 1 : QStash en local, pour les tâches de fond
npm run dev:secrets                  # terminal 2 : l'application, avec les secrets d'Infisical
                                     #   (ou npm run dev avec .env.local)
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # terminal 3, facultatif : paiements
```

Avant chaque envoi de code, je lance la même porte de qualité que Vercel :

```powershell
npm run lint; if ($?) { npm run typecheck }; if ($?) { npm test }
```

**Variables d’environnement :** la liste complète, sans valeur, est dans `.env.example`. En local, `EMAIL_REDIRECTION` est obligatoire ; tant qu’aucun domaine n’est vérifié chez Resend, ce doit être l’adresse du compte Resend.

**Tests :** Vitest couvre les calculs du tableau de bord et du retard, la lecture des montants et des dates, les niveaux de relance, la protection contre les hallucinations, la vérification du texte modifié par l’utilisateur et la classification des réponses.

**Méthode de travail :** un commit par étape du sujet. À partir de l’étape 5, chaque étape a sa propre branche, fusionnée par pull request ; `main` est protégée (pull request obligatoire, vérification Vercel réussie avant toute fusion).

## Limites et améliorations possibles

- **Stripe Connect :** aujourd’hui, l’argent arrive sur un seul compte Stripe, en mode test. Pour un vrai produit, chaque indépendant devrait être payé directement sur son compte, ce qui demande Stripe Connect (comptes connectés, vérification d’identité, transferts).
- **Domaine d’envoi :** sans domaine vérifié chez Resend, les e-mails ne partent que vers l’adresse du compte et arrivent souvent dans les spams. Un domaine à moi, avec SPF et DKIM, réglerait les deux problèmes.
- **Webhooks en local :** Resend ne peut pas joindre mon poste, donc je teste le paiement et la réception des réponses en production (en mode test), ou en local avec la CLI Stripe.
- **Mentions légales :** l’indemnité forfaitaire de 40 € ne s’applique qu’entre professionnels. Il faudrait distinguer les clients particuliers.
- **Une seule base :** le local, les prévisualisations et la production partagent la même base Supabase et le même Redis (seul l’historique de `/admin` est séparé). Les prévisualisations ne sont donc pas pleinement fonctionnelles, car QStash ne peut pas joindre un déploiement protégé.
- **Texte d’origine :** quand l’utilisateur modifie une relance, le texte proposé par l’IA n’est pas conservé.
- **Tarifs :** la section Tarifs de la page d’accueil est une simulation, aucun abonnement n’est vendu.
- **Ce que j’ajouterais ensuite :** des relances par SMS, un export comptable, la lecture des PDF scannés (OCR), la comparaison de plusieurs modèles avec les scores de Langfuse, et l’utilisation des corrections de catégorie pour améliorer la consigne donnée à l’IA.
