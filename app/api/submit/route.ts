import { NextRequest, NextResponse } from 'next/server';

const maybeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = maybeUrl?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const edgeFunctionEndpoint = `${supabaseUrl}/functions/v1/submit-text`;

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || typeof (body as { text?: unknown }).text !== 'string') {
    return NextResponse.json({ error: 'Expected JSON body: { "text": string }' }, { status: 400 });
  }

  const { text } = body as { text: string };

  try {
    const response = await fetch(edgeFunctionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ text }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'submit-text edge function failed',
          status: response.status,
          details: payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload ?? {}, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to invoke submit-text edge function', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

