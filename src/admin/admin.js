// Панель управления отзывами (Firebase Auth + Firestore)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { firebaseConfig, isConfigured } from '/assets/firebase-config.js';

// DOM элементы
const authSection = document.getElementById('auth-section');
const adminDashboard = document.getElementById('admin-dashboard');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const unconfiguredWarn = document.getElementById('auth-unconfigured-warn');
const btnLogout = document.getElementById('btn-logout');
const userDisplayEmail = document.getElementById('user-display-email');

// Списки и счетчики
const listPending = document.getElementById('list-pending');
const listApproved = document.getElementById('list-approved');
const listRejected = document.getElementById('list-rejected');
const badgePending = document.getElementById('badge-pending');
const badgeApproved = document.getElementById('badge-approved');
const badgeRejected = document.getElementById('badge-rejected');

// Форма добавления вручную
const formManual = document.getElementById('form-manual-review');
const btnSaveManual = document.getElementById('btn-save-manual');

// Табы
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
    if (panel) {
      panel.classList.toggle('is-active', name === tabName);
    }
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
  });
});

// Проверка конфигурации
if (!isConfigured()) {
  authSection.style.display = 'block';
  if (unconfiguredWarn) unconfiguredWarn.style.display = 'block';
  console.warn('Firebase не настроен. Заполните src/js/firebase-config.js');
}

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error('Ошибка инициализации Firebase:', e);
}

// 1. Авторизация
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authSection.style.display = 'none';
      adminDashboard.style.display = 'block';
      userDisplayEmail.textContent = user.email || 'Администратор';
      initReviewsSubscription();
    } else {
      adminDashboard.style.display = 'none';
      authSection.style.display = 'block';
    }
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-password').value;

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Вход...';

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      console.error(err);
      authError.style.display = 'block';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        authError.textContent = 'Неверный email или пароль. Проверьте правильность ввода.';
      } else if (err.code === 'auth/too-many-requests') {
        authError.textContent = 'Слишком много неудачных попыток входа. Попробуйте чуть позже.';
      } else {
        authError.textContent = `Ошибка входа: ${err.message}`;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Войти в панель';
    }
  });

  btnLogout.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Ошибка при выходе:', err);
    }
  });
}

// 2. Подписка на коллекцию отзывов в реальном времени
let unsubscribe = null;
function initReviewsSubscription() {
  if (unsubscribe || !db) return;

  const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));

  unsubscribe = onSnapshot(q, (snapshot) => {
    const pending = [];
    const approved = [];
    const rejected = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const item = { id: docSnap.id, ...data };
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
  }, (error) => {
    console.error('Ошибка получения отзывов:', error);
    if (error.code === 'permission-denied') {
      alert('Ошибка доступа: проверьте правила firestore.rules и права пользователя в Firebase.');
    }
  });
}

// 3. Рендеринг карточек отзывов
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
    const dateStr = rev.createdAt?.toDate
      ? rev.createdAt.toDate().toLocaleString('ru', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

        ${rev.photoUrl ? `
          <div class="admin-review-proof">
            <a href="${esc(rev.photoUrl)}" target="_blank" rel="noopener">
              <img src="${esc(rev.photoUrl)}" alt="Скриншот отзыва" loading="lazy">
            </a>
          </div>
        ` : ''}

        <div class="admin-review-actions">
          ${actionButtons}
        </div>
      </article>
    `;
  }).join('');

  // Обработчики кликов по кнопкам действий
  container.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.id;
      if (!id) return;

      if (action === 'approve') {
        await updateReviewStatus(id, 'approved');
      } else if (action === 'reject') {
        await updateReviewStatus(id, 'rejected');
      } else if (action === 'delete') {
        if (confirm('Вы уверены, что хотите окончательно удалить этот отзыв?')) {
          await deleteReview(id);
        }
      }
    });
  });
}

// 4. Действия с документами Firestore
async function updateReviewStatus(id, status) {
  if (!db) return;
  try {
    const docRef = doc(db, 'reviews', id);
    await updateDoc(docRef, { status });
  } catch (err) {
    console.error('Ошибка обновления статуса:', err);
    alert('Не удалось обновить статус: ' + err.message);
  }
}

async function deleteReview(id) {
  if (!db) return;
  try {
    const docRef = doc(db, 'reviews', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Ошибка удаления отзыва:', err);
    alert('Не удалось удалить отзыв: ' + err.message);
  }
}

// 5. Добавление отзыва вручную (из Telegram / Instagram)
if (formManual) {
  formManual.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!db) {
      alert('Firebase не подключен!');
      return;
    }

    const name = document.getElementById('manual-name').value.trim();
    const rating = parseInt(document.getElementById('manual-rating').value, 10) || 5;
    const lang = document.getElementById('manual-lang').value || 'ru';
    const text = document.getElementById('manual-text').value.trim();
    const photoUrl = document.getElementById('manual-photo').value.trim();
    const status = document.getElementById('manual-status').value || 'approved';

    if (!name || !text) {
      alert('Заполните обязательные поля: имя и текст');
      return;
    }

    btnSaveManual.disabled = true;
    btnSaveManual.textContent = 'Сохранение...';

    try {
      const reviewData = {
        name,
        rating,
        lang,
        text,
        status,
        source: 'manual',
        createdAt: serverTimestamp()
      };
      if (photoUrl) {
        reviewData.photoUrl = photoUrl;
      }

      await addDoc(collection(db, 'reviews'), reviewData);

      formManual.reset();
      alert('Отзыв успешно добавлен!');
      switchTab(status);
    } catch (err) {
      console.error('Ошибка добавления отзыва:', err);
      alert('Ошибка при сохранении: ' + err.message);
    } finally {
      btnSaveManual.disabled = false;
      btnSaveManual.textContent = 'Сохранить отзыв';
    }
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
