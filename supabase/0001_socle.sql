-- =====================================================================
-- Encaisse · 0001_socle.sql
-- Structure de données du socle. À exécuter une seule fois, dans le
-- SQL Editor de Supabase, sur un projet vide.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Date du jour à Paris : les échéances sont des dates françaises, alors
-- que la base fonctionne en UTC. « En retard » se calcule toujours avec
-- cette fonction, il n'est jamais stocké.
-- ---------------------------------------------------------------------
create or replace function public.aujourdhui()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

-- ---------------------------------------------------------------------
-- Paramètres de l'indépendant : une ligne par utilisateur
-- ---------------------------------------------------------------------
create table public.parametres (
  user_id           uuid primary key default auth.uid()
                    references auth.users (id) on delete cascade,
  nom_affiche       text not null default ''
                    check (char_length(nom_affiche) <= 100),
  signature         text not null default ''
                    check (char_length(signature) <= 500),
  -- Part de l'encaissé à mettre de côté pour l'URSSAF (0.246 = 24,6 %)
  taux_cotisations  numeric(5, 4) not null default 0.246
                    check (taux_cotisations >= 0 and taux_cotisations < 1),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clients de l'indépendant
-- ---------------------------------------------------------------------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  nom         text not null check (char_length(nom) between 1 and 150),
  email       text check (email is null or char_length(email) <= 254),
  created_at  timestamptz not null default now()
);

create index clients_user_id_idx on public.clients (user_id);

-- ---------------------------------------------------------------------
-- Factures
-- Une facture importée depuis un PDF reste un brouillon tant que
-- l'utilisateur n'a pas vérifié et validé les champs extraits par l'IA.
-- ---------------------------------------------------------------------
create table public.factures (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  client_id          uuid references public.clients (id) on delete restrict,
  numero             text check (numero is null or char_length(numero) between 1 and 50),
  montant_ttc        numeric(12, 2) check (montant_ttc is null or montant_ttc > 0),
  emise_le           date,
  echeance           date,
  statut             text not null default 'en_attente'
                     check (statut in ('en_attente', 'payee')),
  payee_le           timestamptz,
  brouillon          boolean not null default false,
  -- Lecture du PDF par l'IA : null pour une facture saisie à la main
  fichier_chemin     text,
  etat_analyse       text check (etat_analyse in ('en_cours', 'prete', 'erreur')),
  message_erreur     text,
  donnees_extraites  jsonb,
  created_at         timestamptz not null default now(),

  -- Une facture payée a toujours une date de paiement, et inversement
  constraint factures_paiement_coherent
    check ((statut = 'payee') = (payee_le is not null)),

  -- Une facture validée est complète
  constraint factures_validee_complete
    check (
      brouillon
      or (client_id is not null and numero is not null and montant_ttc is not null
          and emise_le is not null and echeance is not null)
    ),

  constraint factures_dates_coherentes
    check (echeance is null or emise_le is null or echeance >= emise_le)
);

create index factures_user_id_idx on public.factures (user_id);
create index factures_client_id_idx on public.factures (client_id);

-- Un numéro de facture est unique pour un même indépendant
create unique index factures_numero_unique
  on public.factures (user_id, numero)
  where numero is not null and not brouillon;

-- ---------------------------------------------------------------------
-- Relances : créées uniquement par le serveur (tâche quotidienne)
-- ---------------------------------------------------------------------
create table public.relances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  facture_id  uuid not null references public.factures (id) on delete cascade,
  niveau      smallint not null check (niveau between 1 and 3),
  envoyee_le  timestamptz,
  created_at  timestamptz not null default now(),

  -- Idempotence : une seule relance par niveau et par facture
  unique (facture_id, niveau)
);

create index relances_user_id_idx on public.relances (user_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chacun n'accède qu'à ses propres données
-- ---------------------------------------------------------------------
alter table public.parametres enable row level security;
alter table public.clients enable row level security;
alter table public.factures enable row level security;
alter table public.relances enable row level security;

-- Paramètres
create policy "Chacun lit ses paramètres"
  on public.parametres for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun crée ses paramètres"
  on public.parametres for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Chacun modifie ses paramètres"
  on public.parametres for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Clients
create policy "Chacun lit ses clients"
  on public.clients for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun crée ses clients"
  on public.clients for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Chacun modifie ses clients"
  on public.clients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Chacun supprime ses clients"
  on public.clients for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Factures : le client rattaché doit appartenir au même utilisateur
create policy "Chacun lit ses factures"
  on public.factures for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun crée ses factures"
  on public.factures for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.id = client_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "Chacun modifie ses factures"
  on public.factures for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.id = client_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "Chacun supprime ses factures"
  on public.factures for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Relances : lecture et modification seulement, la création est réservée au serveur
create policy "Chacun lit ses relances"
  on public.relances for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun modifie ses relances"
  on public.relances for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Stockage des factures en PDF : bucket privé, un dossier par utilisateur
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('factures', 'factures', false, 5242880, array['application/pdf']);

create policy "Chacun dépose ses factures dans son dossier"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'factures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Chacun lit ses propres factures"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'factures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Chacun supprime ses propres factures"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'factures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------
-- Temps réel : le tableau des factures se met à jour sans rechargement
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.factures;
