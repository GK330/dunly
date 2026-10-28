# Dunly

## Présentation

Dunly, c'est un outil pour les indépendants (graphistes, développeurs, consultants...) qui en ont marre de courir après leurs factures impayées.

Je suis parti d'un problème que beaucoup de freelances connaissent : quand un client ne paie pas, il faut le relancer, et c'est à la fois long et gênant. Du coup on repousse, et c'est la trésorerie qui trinque. Je voulais une application qui s'occupe de ça à la place de l'indépendant, sans pour autant envoyer des mails dans son dos.

Concrètement, voilà comment ça marche :

1. L'indépendant dépose ses factures en PDF. L'IA les lit et récupère le client, le numéro, le montant et l'échéance.
2. Quand une facture a 3 jours de retard, Dunly prépare une relance et prévient l'indépendant par mail. Il la relit et l'envoie avec le bouton "Valider et envoyer maintenant".
3. Les relances suivantes (à J+15 et J+30) sont préparées automatiquement chaque jour, mais aucune ne part sans validation.
4. Chaque relance contient un lien pour payer par carte. Quand le client paie, la facture passe en "Payée" toute seule et les relances s'arrêtent.
5. Si le client répond au mail ("je paie le 20", "j'ai déjà payé", "je conteste"...), l'IA classe sa réponse et les relances se mettent en pause ou s'arrêtent.

Il y a aussi un tableau de bord qui montre ce qui a été encaissé dans le mois, ce qui est en attente ou en retard, ce qu'il faut garder pour l'URSSAF et ce que l'indépendant peut se verser.

J'ai gardé le principe vu en TD avec les fiches de révision : un utilisateur connecté envoie un contenu (ici le PDF d'une facture), un modèle d'IA le transforme en résultat structuré (les champs de la facture), et ce résultat est enregistré et rattaché à son auteur.

## Adresse de production

- Application : https://dunly-tau.vercel.app
- Vidéo de démonstration : à compléter

## Architecture

Le navigateur ne parle qu'au back Next.js, qui tourne en serverless sur Vercel (région Paris, `cdg1`). Toutes les clés d'API restent côté serveur.

| Service | À quoi il me sert |
| --- | --- |
| Vercel | Hébergement, déploiement automatique à chaque push, avec lint, types, tests et build avant chaque mise en ligne |
| Groq | Le modèle d'IA : lecture des factures, rédaction des relances, classement des réponses |
| Supabase (base de données) | Clients, factures, relances, réponses, avec la Row Level Security sur toutes les tables |
| Supabase Auth | Connexion sans mot de passe, par lien magique |
| Upstash Redis | Les quotas par utilisateur et l'historique de la page `/admin` |
| Upstash QStash | Les traitements en arrière-plan et la tournée quotidienne des relances |
| Resend | L'envoi des relances et des notifications, et la réception des réponses des clients |
| Stripe (mode test) | Le paiement des factures par carte |

### Les briques au choix et pourquoi je les ai prises

- **Stockage de fichiers (Supabase Storage)** : les factures sont des PDF, il fallait bien les stocker quelque part. Elles sont dans un bucket privé, avec un dossier par utilisateur et 5 Mo maximum par fichier.
- **Génération asynchrone (QStash)** : lire un PDF ou rédiger une relance avec l'IA prend plusieurs secondes, donc je le fais en arrière-plan, avec de nouvelles tentatives si ça échoue. La tournée quotidienne des relances est aussi une planification QStash.
- **Temps réel (Supabase Realtime)** : quand on dépose une facture, on la voit passer de "Lecture en cours" au résultat sans recharger la page. Pareil pour les relances et les réponses.
- **Notifications par mail (Resend)** : c'est vraiment le cœur de l'appli. Ça sert aux relances, au mail "Relance prête" et aux alertes quand un client répond ou paie.
- **Suivi des erreurs (Sentry)** : mes traitements en arrière-plan tournent sans personne devant l'écran. Sans Sentry, une relance qui plante passerait complètement inaperçue.
- **Observabilité de l'IA (Langfuse)** : chaque appel au modèle est tracé (tokens, temps de réponse, coût), avec l'identifiant de la facture ou de la relance concernée.
- **Surveillance externe (UptimeRobot)** : il vérifie la route `/api/health` en continu, et il y a une page de statut publique : https://stats.uptimerobot.com/BFFIWRvpQ7.
- **Gestion des secrets (Infisical)** : j'ai une trentaine de variables d'environnement, donc je les gère dans Infisical, qui les synchronise avec Vercel.

Toutes ces briques sont vérifiées sur la page `/admin` (17 contrôles, avec un historique). Cette page n'est accessible qu'aux adresses mises dans `ADMIN_EMAILS`. Pour les autres comptes, elle renvoie une page introuvable.

## Modèle d'IA

J'utilise **Groq** avec le modèle **`openai/gpt-oss-20b`**, configuré avec les variables `AI_BASE_URL`, `AI_API_KEY` et `AI_MODEL`.

Je l'ai choisi parce qu'il est gratuit (pas besoin de carte bancaire), rapide, et surtout qu'il sait répondre en JSON strict, ce dont j'ai besoin pour mes trois usages. Pour lire des champs ou classer un mail, il suffit largement. Si je voulais des relances mieux écrites, je pourrais passer à `openai/gpt-oss-120b` sans changer une ligne de code.

Le plus important pour moi, c'est que l'IA ne décide jamais toute seule :

- **Lecture des factures** : chaque champ renvoyé par l'IA est vérifié par le code (montant, dates, mail). Si tout est complet et cohérent, la facture est validée directement. Sinon elle reste "À vérifier". Dans tous les cas, l'utilisateur peut corriger.
- **Relances** : c'est la partie qui m'a demandé le plus de réflexion. L'IA écrit uniquement le texte du message. Le montant, le numéro, les dates, le lien de paiement et la signature sont ajoutés par le code depuis la base, avec des balises comme `{{montant}}`. Si le texte de l'IA contient quand même un chiffre, une date, une monnaie, un lien ou une balise inconnue, je le jette et j'utilise un modèle fixe. Comme ça, l'IA ne peut pas inventer un montant. Dans l'éditeur, les balises s'affichent sous forme de pastilles avec leur vraie valeur, pour que l'utilisateur ne puisse pas les casser par erreur.
- **Validation** : par défaut, aucune relance ne part sans que l'utilisateur l'ait validée.
- **Réponses des clients** : le mail du client est mis entre des délimiteurs aléatoires et traité comme une simple donnée, pour éviter qu'un client glisse des instructions à l'IA dans son message. L'IA doit choisir une catégorie dans une liste fixe, le serveur vérifie sa réponse, et en cas de doute c'est "autre". Les actions sont faites par le code, et une facture n'est jamais marquée payée automatiquement à partir d'une réponse.
- **Tableau de bord** : les calculs sont faits en TypeScript, en centimes. L'IA n'intervient pas du tout.

## Structure de données

Les scripts SQL sont dans le dépôt et s'exécutent dans cet ordre dans le SQL Editor de Supabase : `supabase/0001_socle.sql` puis `supabase/0002_fonctionnalites.sql`.

| Table | Contenu | Liens |
| --- | --- | --- |
| `parametres` | Nom, signature, taux de cotisations, réglages des relances et du paiement par carte | une ligne par utilisateur |
| `clients` | Les clients de l'indépendant | `user_id` → `auth.users` |
| `factures` | Numéro, montant TTC, dates, statut (`en_attente` ou `payee`), brouillon, état de la lecture du PDF, jeton de paiement, pause ou arrêt des relances | `client_id` → `clients`, `user_id` |
| `relances` | Niveau (1 à 3), statut (`brouillon`, `validee`, `envoyee`, `annulee`), date prévue, texte avec les balises, origine du texte (IA, modèle ou utilisateur) | `facture_id` → `factures`, `user_id` |
| `reponses_clients` | Les réponses reçues, leur catégorie, la date promise, et si l'utilisateur a corrigé la catégorie | `facture_id`, `relance_id`, `user_id` |
| `evenements_stripe` | Les événements Stripe déjà traités, pour ne jamais compter un paiement deux fois | aucun |
| vue `statistiques_clients` | Nombre de factures, nombre de retards et retard moyen par client, calculés en SQL | `clients` |

Le statut "en retard" n'est pas stocké dans la base. Je le calcule à partir du statut `en_attente` et de la date d'échéance, avec la date de Paris.

Côté sécurité :

- la Row Level Security est activée sur toutes les tables, chaque utilisateur ne voit et ne modifie que ses lignes (`(select auth.uid()) = user_id`) ;
- une facture ne peut être rattachée qu'à un client du même utilisateur ;
- les tables remplies par le serveur (création des relances et des réponses, événements Stripe) n'ont pas de politique d'insertion pour les utilisateurs ;
- le bucket `factures` est privé, et chacun n'a accès qu'à son dossier.

## Lancer le projet en local

Il faut Node.js 22 ou plus, un compte sur chaque service, et éventuellement la CLI Infisical.

Sous Windows (PowerShell), j'utilise trois terminaux :

```powershell
npm install
Copy-Item .env.example .env.local   # puis remplir les valeurs (ou utiliser Infisical)

npx @upstash/qstash-cli dev          # terminal 1 : QStash en local, pour les traitements en arrière-plan
npm run dev:secrets                  # terminal 2 : l'application, avec les secrets d'Infisical
                                     #   (ou npm run dev si on utilise .env.local)
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # terminal 3, seulement pour tester les paiements
```

Avant chaque push, je lance les mêmes vérifications que Vercel :

```powershell
npm run lint; if ($?) { npm run typecheck }; if ($?) { npm test }
```

Toutes les variables d'environnement sont listées (sans valeur) dans `.env.example`. En local, `EMAIL_REDIRECTION` est obligatoire, et tant qu'on n'a pas de domaine vérifié chez Resend, il faut y mettre l'adresse de son compte Resend.

## Limites et améliorations possibles

- **Stripe Connect** : pour l'instant, tout l'argent arrive sur un seul compte Stripe en mode test. Dans un vrai produit, chaque indépendant devrait recevoir l'argent directement sur son compte, ce qui demande Stripe Connect (comptes connectés, vérification d'identité...).
- **Domaine pour les mails** : comme je n'ai pas de domaine vérifié chez Resend, les mails ne peuvent partir que vers l'adresse de mon compte, et ils arrivent souvent dans les spams. Avec mon propre domaine (et SPF / DKIM), ça réglerait les deux problèmes.
- **Tests en local** : Resend ne peut pas envoyer ses webhooks sur mon PC, donc j'ai testé le paiement et la réception des réponses directement en production (en mode test).
- **Mentions légales** : l'indemnité de 40 € pour retard de paiement ne concerne que les clients professionnels. Il faudrait gérer différemment les particuliers.
- **Une seule base** : le local, les prévisualisations et la production utilisent la même base Supabase et le même Redis (seul l'historique de `/admin` est séparé). Les prévisualisations Vercel ne marchent donc pas complètement, parce que QStash ne peut pas accéder à un déploiement protégé.
- **Texte d'origine** : quand l'utilisateur modifie une relance, le texte proposé par l'IA n'est pas gardé.
- **Tarifs** : la section Tarifs de la page d'accueil est juste une simulation, rien n'est vendu.

Si je continuais le projet, j'ajouterais les relances par SMS, un export pour le comptable, la lecture des PDF scannés (OCR), et j'utiliserais les corrections de catégorie faites par les utilisateurs pour améliorer la consigne donnée à l'IA.
