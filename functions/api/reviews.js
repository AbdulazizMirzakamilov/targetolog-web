const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.REVIEWS_KV) {
    return new Response(JSON.stringify({ reviews: [] }), { headers: corsHeaders });
  }

  try {
    const raw = await env.REVIEWS_KV.get('public_approved_reviews');
    const reviews = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ reviews }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch reviews', reviews: [] }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.REVIEWS_KV) {
    return new Response(JSON.stringify({ error: 'Database not bound' }), {
      status: 503,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();

    if (body.website) {
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const name = String(body.name || 'Аноним').trim().slice(0, 60);
    const text = String(body.text || '').trim().slice(0, 1000);
    const rating = Math.max(1, Math.min(5, parseInt(body.rating, 10) || 5));
    const lang = ['ru', 'uz', 'en'].includes(body.lang) ? body.lang : 'ru';

    if (!name || !text) {
      return new Response(JSON.stringify({ error: 'Имя и текст отзыва обязательны' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateKey = `rate_${clientIp}`;
    const lastSubmit = await env.REVIEWS_KV.get(rateKey);

    if (lastSubmit) {
      return new Response(JSON.stringify({ error: 'Слишком частая отправка. Повторите через 5 минут.' }), {
        status: 429,
        headers: corsHeaders
      });
    }

    const id = 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const newReview = {
      id,
      name,
      rating,
      text,
      lang,
      status: 'pending',
      source: 'public',
      createdAt: new Date().toISOString()
    };

    await env.REVIEWS_KV.put(`item_${id}`, JSON.stringify(newReview));
    await env.REVIEWS_KV.put(rateKey, '1', { expirationTtl: 300 });

    return new Response(JSON.stringify({ success: true, id }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: corsHeaders
    });
  }
}
