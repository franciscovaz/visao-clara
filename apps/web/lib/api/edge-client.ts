import { supabase } from '../supabase/client';

export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: unknown
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body,
  });

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }

  return data;
}
