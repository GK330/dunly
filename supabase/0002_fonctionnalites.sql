-- =====================================================================
-- Dunly · 0002_fonctionnalites.sql
-- Relances personnalisées, paiement par carte et réponses des clients.
-- À exécuter une seule fois dans le SQL Editor de Supabase, après 0001.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Relances : contenu rédigé par l'IA (ou modèle fixe), cycle de validation
--   brouillon → validee → envoyee, ou annulee à tout moment
-- ---------------------------------------------------------------------
alter table public.relances
  add column statut text not null default 'brouillon'
    check (statut in ('brouillon', 'validee', 'envoyee', 'annulee')),
  add column prevue_le date,
  -- Corps du message avec ses balises ({{numero}}, {{montant}}…) : les vraies
  -- valeurs sont insérées par le code au moment de l'envoi, depuis la base
  add column contenu text check (contenu is null or char_length(contenu) <= 3000),
  add column origine_contenu text
    check (origine_contenu in ('ia', 'modele', 'utilisateur')),
  add column message_generation text,
  add column veille_notifiee_le timestamptz;

update public.relances
  set prevue_le = coalesce(envoyee_le::date, created_at::date),
      statut = case when envoyee_le is not null then 'envoyee' else 'brouillon' end
  where prevue_le is null;

alter table public.relances alter column prevue_le set not null;

-- Une relance annulée (paiement promis, pause…) peut être recréée au même niveau plus tard :
-- l'unicité ne porte plus que sur les relances non annulées
alter table public.relances drop constraint relances_facture_id_niveau_key;

create unique index relances_niveau_unique
  on public.relances (facture_id, niveau)
  where statut <> 'annulee';

create index relances_a_traiter_idx
  on public.relances (prevue_le)
  where statut in ('brouillon', 'validee');

-- ---------------------------------------------------------------------
-- Factures : lien de paiement et contrôle des relances
-- ---------------------------------------------------------------------
alter table public.factures
  -- Jeton aléatoire et non devinable (64 caractères hexadécimaux), jamais l'id de la facture
  add column jeton_paiement text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  add column lien_ouvert_le timestamptz,
  add column stripe_session_id text,
  add column payee_par_carte boolean not null default false,
  add column relances_en_pause_jusqu_au date,
  add column relances_arretees boolean not null default false;

-- ---------------------------------------------------------------------
-- Paramètres de l'indépendant
-- ---------------------------------------------------------------------
alter table public.parametres
  -- Activé : aucune relance ne part sans validation. Désactivé : envoi automatique le lendemain
  add column validation_relances boolean not null default true,
  -- Désactivable à cause des frais Stripe
  add column paiement_carte_actif boolean not null default true;

-- ---------------------------------------------------------------------
-- Réponses des clients aux relances, classées par l'IA dans une liste fixe
-- ---------------------------------------------------------------------
create table public.reponses_clients (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  facture_id                uuid not null references public.factures (id) on delete cascade,
  relance_id                uuid references public.relances (id) on delete set null,
  expediteur                text not null check (char_length(expediteur) <= 320),
  sujet                     text check (sujet is null or char_length(sujet) <= 500),
  corps                     text not null check (char_length(corps) <= 20000),
  -- null tant que la classification n'est pas faite
  categorie                 text check (categorie in
                              ('promesse_paiement', 'deja_paye', 'contestation', 'demande_delai', 'autre')),
  date_promise              date,
  action_appliquee          text,
  corrigee_par_utilisateur  boolean not null default false,
  -- Idempotence : un même e-mail reçu deux fois n'est enregistré qu'une fois
  email_resend_id           text unique,
  recue_le                  timestamptz not null default now()
);

create index reponses_clients_user_id_idx on public.reponses_clients (user_id);
create index reponses_clients_facture_id_idx on public.reponses_clients (facture_id);

-- ---------------------------------------------------------------------
-- Événements Stripe déjà traités : un même événement livré deux fois
-- ne produit aucun effet supplémentaire
-- ---------------------------------------------------------------------
create table public.evenements_stripe (
  id        text primary key,
  type      text not null,
  recu_le   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Historique de paiement par client, calculé en SQL et transmis à l'IA
-- pour adapter le ton des relances. security_invoker : la vue applique
-- la Row Level Security de l'utilisateur qui l'interroge.
-- ---------------------------------------------------------------------
create view public.statistiques_clients
with (security_invoker = on) as
select
  c.id as client_id,
  c.user_id,
  count(f.id)::int as nombre_factures,
  (count(f.id) filter (where r.jours_retard > 0))::int as nombre_retards,
  coalesce(round(avg(r.jours_retard) filter (where r.jours_retard > 0)), 0)::int
    as retard_moyen_jours
from public.clients c
left join public.factures f
  on f.client_id = c.id and not f.brouillon
left join lateral (
  select case
    when f.statut = 'payee'
      then greatest(0, (f.payee_le at time zone 'Europe/Paris')::date - f.echeance)
    else greatest(0, public.aujourdhui() - f.echeance)
  end as jours_retard
) r on f.id is not null
group by c.id, c.user_id;

-- ---------------------------------------------------------------------
-- Row Level Security sur les nouvelles tables
-- ---------------------------------------------------------------------
alter table public.reponses_clients enable row level security;
alter table public.evenements_stripe enable row level security;

-- Réponses : insérées uniquement par le serveur (webhook), lues et corrigées par l'utilisateur
create policy "Chacun lit les réponses de ses clients"
  on public.reponses_clients for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun corrige les réponses de ses clients"
  on public.reponses_clients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Événements Stripe : aucune politique, seul le serveur (clé secrète) y accède

-- ---------------------------------------------------------------------
-- Temps réel : relances et réponses apparaissent sans rechargement
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.relances;
alter publication supabase_realtime add table public.reponses_clients;
