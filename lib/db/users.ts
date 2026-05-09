import { supabase } from './client.js';

export type UserRow = {
  wallet_address: string;
  created_at: number;
  updated_at: number;
  risk_preferences: Record<string, unknown>;
};

// Insert if new, otherwise just bump updated_at and keep created_at stable.
export async function ensureUser(wallet: string): Promise<UserRow> {
  const now = Date.now();
  const existing = await getUser(wallet);
  if (existing) {
    const { data, error } = await supabase()
      .from('users')
      .update({ updated_at: now })
      .eq('wallet_address', wallet)
      .select()
      .single();
    if (error) throw new Error(`ensureUser update(${wallet}): ${error.message}`);
    return data as UserRow;
  }
  const { data, error } = await supabase()
    .from('users')
    .insert({
      wallet_address: wallet,
      created_at: now,
      updated_at: now,
      risk_preferences: {},
    })
    .select()
    .single();
  if (error) throw new Error(`ensureUser insert(${wallet}): ${error.message}`);
  return data as UserRow;
}

export async function getUser(wallet: string): Promise<UserRow | null> {
  const { data, error } = await supabase()
    .from('users')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle();
  if (error) throw new Error(`getUser(${wallet}): ${error.message}`);
  return (data as UserRow) ?? null;
}

export async function setRiskPreferences(
  wallet: string,
  prefs: Record<string, unknown>,
): Promise<UserRow | null> {
  const { data, error } = await supabase()
    .from('users')
    .update({ risk_preferences: prefs, updated_at: Date.now() })
    .eq('wallet_address', wallet)
    .select()
    .maybeSingle();
  if (error) throw new Error(`setRiskPreferences(${wallet}): ${error.message}`);
  return (data as UserRow) ?? null;
}
