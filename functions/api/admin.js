const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  const secret = env.ADMIN_SECRET || 'targetolog_admin_supersecret_2026';
  return token === secret;
}

async function rebuildPublicApprovedCache(kv) {
  const listRes = await kv.list({ prefix: 'item_' });
  const approved = [];
  for (const key of listRes.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      const item = JSON.parse(raw);
      if (item.status === 'approved') approved.push(item);
    }
  }
  approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  await kv.put('public_approved_reviews', JSON.stringify(approved));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.REVIEWS_KV) {
    return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 503, headers: corsHeaders });
  }

  if (!verifyAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    const listRes = await env.REVIEWS_KV.list({ prefix: 'item_' });
    const all = [];
    for (const key of listRes.keys) {
      const raw = await env.REVIEWS_KV.get(key.name);
      if (raw) all.push(JSON.parse(raw));
    }
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return new Response(JSON.stringify({ reviews: all }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.REVIEWS_KV) {
    return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 503, headers: corsHeaders });
  }

  try {
    const body = await request.json();

    if (body.action === 'login') {
      const password = String(body.password || '');
      const expectedPassword = env.ADMIN_PASSWORD || 'kamila2026!';
      const secret = env.ADMIN_SECRET || 'targetolog_admin_supersecret_2026';

      if (password === expectedPassword) {
        return new Response(JSON.stringify({ success: true, token: secret }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ error: 'Неверный пароль администратора' }), { status: 401, headers: corsHeaders });
    }

    if (!verifyAuth(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    if (body.action === 'status') {
      const { id, status } = body;
      const key = `item_${id}`;
      const raw = await env.REVIEWS_KV.get(key);
      if (!raw) return new Response(JSON.stringify({ error: 'Review not found' }), { status: 404, headers: corsHeaders });

      const item = JSON.parse(raw);
      item.status = status;
      await env.REVIEWS_KV.put(key, JSON.stringify(item));
      await rebuildPublicApprovedCache(env.REVIEWS_KV);
      return new Response(JSON.stringify({ success: true, item }), { headers: corsHeaders });
    }

    if (body.action === 'delete') {
      const { id } = body;
      await env.REVIEWS_KV.delete(`item_${id}`);
      await rebuildPublicApprovedCache(env.REVIEWS_KV);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (body.action === 'manual_create') {
      const { name, rating, lang, text, photoUrl, status } = body;
      const id = 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const item = {
        id,
        name: String(name).slice(0, 60),
        rating: Math.max(1, Math.min(5, parseInt(rating, 10) || 5)),
        lang: lang || 'ru',
        text: String(text).slice(0, 1000),
        status: status || 'approved',
        source: 'manual',
        createdAt: new Date().toISOString()
      };
      if (photoUrl && /^https:\/\/[^\s$.?#].[^\s]*$/i.test(photoUrl)) {
        item.photoUrl = photoUrl;
      }
      await env.REVIEWS_KV.put(`item_${id}`, JSON.stringify(item));
      await rebuildPublicApprovedCache(env.REVIEWS_KV);
      return new Response(JSON.stringify({ success: true, item }), { status: 201, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
