import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type SubmissionRow = {
  id: string;
  text: string;
  created_at: string;
  embedding: number[] | null;
};

type SubmitBody = {
  text: string;
};

const EMBEDDING_SIZE = 1536;

function generateDemoEmbedding(text: string): number[] {
  const normalized = text.normalize('NFKD').toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) % 1000000;
  }

  const embedding = new Array<number>(EMBEDDING_SIZE);

  for (let i = 0; i < EMBEDDING_SIZE; i += 1) {
    const value = ((hash + i * 9973) % 2000) / 1000 - 1; // Range [-1, 1)
    embedding[i] = Number(value.toFixed(6));
  }

  return embedding;
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: SubmitBody;

  try {
    const raw = await request.json();

    if (typeof raw !== 'object' || raw === null || typeof (raw as SubmitBody).text !== 'string') {
      throw new Error('Invalid payload');
    }

    body = raw as SubmitBody;
  } catch {
    return jsonResponse({ error: 'Expected JSON body: { "text": string }' }, { status: 400 });
  }

  const text = body.text.trim();

  if (!text) {
    return jsonResponse({ error: 'Text must be a non-empty string' }, { status: 400 });
  }

  try {
    const { data: inserted, error: insertError } = await supabase
      .from('submissions')
      .insert({ text })
      .select()
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error('Failed to insert submission');
    }

    const embedding = generateDemoEmbedding(text);

    const { data: updated, error: updateError } = await supabase
      .from('submissions')
      .update({ embedding })
      .eq('id', inserted.id)
      .select()
      .single<SubmissionRow>();

    if (updateError || !updated) {
      throw updateError ?? new Error('Failed to update embedding');
    }

    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    console.error('submit-text error', error);
    return jsonResponse(
      {
        error: 'submit-text function failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

