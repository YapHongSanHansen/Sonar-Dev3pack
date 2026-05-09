-- SONAR — Supabase Postgres schema.
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- Idempotent: safe to re-run; uses IF NOT EXISTS / CREATE OR REPLACE.

create table if not exists users (
  wallet_address    text primary key,
  created_at        bigint not null,
  updated_at        bigint not null,
  risk_preferences  jsonb  not null default '{}'::jsonb
);

create table if not exists risk_logs (
  id            bigserial primary key,
  wallet        text not null references users(wallet_address) on delete cascade,
  session_id    uuid not null unique,
  risk_score    integer not null,
  reasons       jsonb not null,
  scenario      text,
  domain        text,
  counterparty  text,
  timestamp     bigint not null,
  outcome       text not null default 'pending'
);

create index if not exists idx_risk_logs_wallet    on risk_logs(wallet);
create index if not exists idx_risk_logs_timestamp on risk_logs(timestamp);

create table if not exists behavioral_data (
  wallet_address      text primary key references users(wallet_address) on delete cascade,
  sample_size         integer not null,
  window_days         integer not null,
  avg_transfer_sol    double precision not null,
  max_transfer_sol    double precision not null,
  tx_per_day          double precision not null,
  top_counterparties  jsonb not null,
  top_programs        jsonb not null,
  active_hours_utc    jsonb not null,
  chains              jsonb not null,
  computed_at         bigint not null
);

-- Cooldown sessions live here so they survive between serverless invocations.
-- expires_at / confirm_token_expires_at are ms epoch (matches Date.now() in JS).
create table if not exists cooldown_sessions (
  session_id                uuid primary key,
  wallet                    text not null,
  expires_at                bigint not null,
  acknowledged_at           bigint,
  confirm_token             uuid,
  confirm_token_expires_at  bigint,
  attempts                  integer not null default 0,
  verdict                   jsonb not null,
  created_at                bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists idx_cooldown_expires_at on cooldown_sessions(expires_at);

-- Convenience: drop sessions older than 1 hour past expiry. Run manually or
-- schedule via Supabase: Database → Functions → "Schedule a function" if you
-- want it automated. Not required for correctness — reads filter by expiry.
create or replace function prune_expired_cooldowns() returns void
language sql
as $$
  delete from cooldown_sessions
   where expires_at < ((extract(epoch from now()) * 1000)::bigint - 3600000);
$$;
