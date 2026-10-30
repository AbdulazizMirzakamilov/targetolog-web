const authSection = document.getElementById('auth-section');
const adminDashboard = document.getElementById('admin-dashboard');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');
const userDisplayEmail = document.getElementById('user-display-email');

const listPending = document.getElementById('list-pending');
const listApproved = document.getElementById('list-approved');
const listRejected = document.getElementById('list-rejected');
const badgePending = document.getElementById('badge-pending');
const badgeApproved = document.getElementById('badge-approved');
const badgeRejected = document.getElementById('badge-rejected');

const formManual = document.getElementById('form-manual-review');
const btnSaveManual = document.getElementById('btn-save-manual');

const tabs = document.querySelectorAll('.admin-tab');
const panels = {
  pending: document.getElementById('panel-pending'),
  approved: document.getElementById('panel-approved'),
  rejected: document.getElementById('panel-rejected'),
  create: document.getElementById('panel-create'),
};

function switchTab(tabName) {
  tabs.forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('is-active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  Object.entries(panels).forEach(([name, panel]) => {
    if (panel) panel.classList.toggle('is-active', name === tabName);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

const safeUrl = (url) => {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^https:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) return trimmed;
  return '';
};

function getToken() {
  return sessionStorage.getItem('admin_token');
}

function setToken(token) {
  if (token) sessionStorage.setItem('admin_token', token);
  else sessionStorage.removeItem('admin_token');
}

async function checkAuthAndLoad() {
  const token = getToken();
  if (!token) {
    authSection.style.display = 'block';
    adminDashboard.style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/api/admin', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      setToken(null);
      authSection.style.display = 'block';
      adminDashboard.style.display = 'none';
      return;
    }
    const data = await res.json();
    authSection.style.display = 'none';
    adminDashboard.style.display = 'block';
    userDisplayEmail.textContent = 'Администратор';
    renderDashboard(data.reviews || []);
  } catch (err) {
    authSection.style.display = 'block';
    adminDashboard.style.display = 'none';
  }
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.style.display = 'none';
  const pass = document.getElementById('admin-password').value;

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Вход...';

  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', password: pass })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Неверный пароль');
    }

    setToken(data.token);
    await checkAuthAndLoad();
  } catch (err) {
    authError.style.display = 'block';
    authError.textContent = err.message || 'Ошибка входа';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Войти в панель';
  }
});

btnLogout.addEventListener('click', () => {
  setToken(null);
  authSection.style.display = 'block';
  adminDashboard.style.display = 'none';
});

function renderDashboard(reviews) {
  const pending = [];
  const approved = [];
  const rejected = [];

  reviews.forEach((item) => {
    if (item.status === 'approved') approved.push(item);
    else if (item.status === 'rejected') rejected.push(item);
    else pending.push(item);
  });

  badgePending.textContent = pending.length;
  badgeApproved.textContent = approved.length;
  badgeRejected.textContent = rejected.length;

  renderList(listPending, pending, 'pending');
  renderList(listApproved, approved, 'approved');
  renderList(listRejected, rejected, 'rejected');
}

function renderList(container, items, listType) {
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: var(--color-muted); border: 1px dashed var(--admin-border); border-radius: var(--radius-md);">
        В этой категории нет отзывов
      </div>`;
    return;
  }

  container.innerHTML = items.map((rev) => {
    const dateStr = rev.createdAt
      ? new Date(rev.createdAt).toLocaleString('ru', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Недавно';

    const stars = '★'.repeat(Math.max(1, Math.min(5, rev.rating || 5))) +
                  '☆'.repeat(Math.max(0, 5 - (rev.rating || 5)));

    const langBadge = rev.lang ? `<span class="badge-lang">${esc(rev.lang)}</span>` : '';
    const sourceBadge = rev.source === 'manual'
      ? `<span class="badge-source">Вручную</span>`
      : `<span class="badge-source">С сайта</span>`;

    const statusBadge = `<span class="badge-status badge-status--${rev.status || 'pending'}">${rev.status || 'pending'}</span>`;

    let actionButtons = '';
    if (listType === 'pending') {
      actionButtons = `
        <button type="button" class="btn-sm btn-approve" data-action="approve" data-id="${rev.id}">✓ Одобрить</button>
        <button type="button" class="btn-sm btn-reject" data-action="reject" data-id="${rev.id}">✕ Отклонить</button>
        <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${rev.id}">🗑 Удалить</button>
      `;
    } else if (listType === 'approved') {
      actionButtons = `
        <button type="button" class="btn-sm btn-reject" data-action="reject" data-id="${rev.id}">Скрыть (в отклонённые)</button>
        <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${rev.id}">🗑 Удалить</button>
      `;
    } else if (listType === 'rejected') {
      actionButtons = `
        <button type="button" class="btn-sm btn-approve" data-action="approve" data-id="${rev.id}">✓ Восстановить (одобрить)</button>
        <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${rev.id}">🗑 Удалить навсегда</button>
      `;
    }

    const verifiedProofUrl = safeUrl(rev.photoUrl);

    return `
      <article class="admin-review-card" data-id="${rev.id}">
        <div class="admin-review-top">
          <div class="admin-review-info">
            <span class="admin-review-name">${esc(rev.name || 'Без имени')}</span>
            ${langBadge}
            ${sourceBadge}
            ${statusBadge}
          </div>
          <span class="admin-review-date">${esc(dateStr)}</span>
        </div>

        <div class="admin-review-stars">${stars}</div>

        <div class="admin-review-body">${esc(rev.text || '')}</div>

        ${verifiedProofUrl ? `
          <div class="admin-review-proof">
            <a href="${esc(verifiedProofUrl)}" target="_blank" rel="noopener noreferrer">
              <img src="${esc(verifiedProofUrl)}" alt="Скриншот отзыва" loading="lazy">
            </a>
          </div>
        ` : ''}

        <div class="admin-review-actions">
          ${actionButtons}
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.id;
      if (!id) return;

      const token = getToken();
      if (!token) return;

      if (action === 'approve') {
        await apiCall({ action: 'status', id, status: 'approved' });
      } else if (action === 'reject') {
        await apiCall({ action: 'status', id, status: 'rejected' });
      } else if (action === 'delete') {
        if (confirm('Удалить этот отзыв навсегда?')) {
          await apiCall({ action: 'delete', id });
        }
      }
      await checkAuthAndLoad();
    });
  });
}

async function apiCall(body) {
  const token = getToken();
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Ошибка запроса');
    }
  } catch (err) {
    alert(err.message);
  }
}

if (formManual) {
  formManual.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('manual-name').value.trim();
    const rating = parseInt(document.getElementById('manual-rating').value, 10) || 5;
    const lang = document.getElementById('manual-lang').value || 'ru';
    const text = document.getElementById('manual-text').value.trim();
    const rawPhotoUrl = document.getElementById('manual-photo').value.trim();
    const status = document.getElementById('manual-status').value || 'approved';

    if (!name || !text) {
      alert('Заполните обязательные поля');
      return;
    }

    btnSaveManual.disabled = true;
    btnSaveManual.textContent = 'Сохранение...';

    try {
      await apiCall({
        action: 'manual_create',
        name,
        rating,
        lang,
        text,
        photoUrl: rawPhotoUrl,
        status
      });

      formManual.reset();
      alert('Отзыв сохранён');
      switchTab(status);
      await checkAuthAndLoad();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      btnSaveManual.disabled = false;
      btnSaveManual.textContent = 'Сохранить отзыв';
    }
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

checkAuthAndLoad();
