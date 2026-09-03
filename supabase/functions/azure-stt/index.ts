// ═══════════════════════════════════════════════════════════════════
// azure-stt — server-side proxy for Azure Speech-to-Text (zh-CN).
//
// WHY: the Azure key must never ship in the public site bundle (GitHub
// push-protection blocks it, and a leaked key bills our subscription).
// The client POSTs a short WAV here; we call Azure with the key held in
// a function secret and return the recognized text. Char→tone mapping
// stays client-side.
//
// DEPLOY (Supabase dashboard):
//   1. Edge Functions → Deploy new function → name: azure-stt → paste this.
//   2. Function settings → DISABLE "Enforce JWT verification"
//      (the app uses its own auth, not Supabase Auth JWTs).
//   3. Edge Functions → Secrets → add:
//        AZURE_SPEECH_KEY    = <the key>
//        AZURE_SPEECH_REGION = eastus
// ═══════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS })
  }

  const key = Deno.env.get('AZURE_SPEECH_KEY')
  const region = Deno.env.get('AZURE_SPEECH_REGION') ?? 'eastus'
  if (!key) {
    return new Response(JSON.stringify({ error: 'AZURE_SPEECH_KEY secret not set' }), { status: 500, headers: CORS })
  }

  const audio = await req.arrayBuffer()
  // Single-syllable clips are ~1s; anything huge is not ours.
  if (audio.byteLength < 44 || audio.byteLength > 2_000_000) {
    return new Response(JSON.stringify({ error: 'bad audio size' }), { status: 400, headers: CORS })
  }

  try {
    const azure = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=zh-CN&format=simple`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        },
        body: audio,
      },
    )
    if (!azure.ok) {
      return new Response(JSON.stringify({ error: `azure ${azure.status}` }), { status: 502, headers: CORS })
    }
    const data = await azure.json()
    return new Response(
      JSON.stringify({ text: data?.DisplayText ?? data?.Text ?? null, status: data?.RecognitionStatus ?? null }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: CORS })
  }
})
