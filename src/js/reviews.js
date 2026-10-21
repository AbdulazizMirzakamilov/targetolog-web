// Загрузка одобренных отзывов и форма добавления нового отзыва
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { firebaseConfig, isConfigured } from './firebase-config.js';

const reviewsContainer = document.getElementById('reviews-list');
const modal = document.getElementById('review-modal');
const openBtn = document.getElementById('open-review-modal');
const form = document.getElementById('review-form');
const successBox = document.getElementById('review-success');

// Инициализация Firebase, если ключи указаны
let db = null;
if (isConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (err) {
    console.warn('Firebase init error:', err);
  }
}

// 1. Загрузка отзывов
async function loadReviews() {
  if (!reviewsContainer) return;
  const lang = reviewsContainer.dataset.reviewsLang || 'ru';

  if (!db) {
    // Демонстрационный или заглушечный режим
    reviewsContainer.innerHTML = `
      <div class="reviews-empty">
        <p class="muted">Отзывы клиентов будут отображаться здесь после настройки Firebase.</p>
      </div>`;
    return;
  }

  try {
    // Запрашиваем одобренные отзывы без составного индекса (сортируем в памяти JS)
    const q = query(
      collection(db, 'reviews'),
      where('status', '==', 'approved'),
      limit(50)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      reviewsContainer.innerHTML = `
        <div class="reviews-empty">
          <p class="muted">Пока здесь нет отзывов. Станьте первым, кто поделится впечатлениями!</p>
        </div>`;
      return;
    }

    const docsList = [];
    snap.forEach((doc) => {
      docsList.push({ id: doc.id, ...doc.data() });
    });

    // Сортировка по времени от новых к старым
    docsList.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

    const items = docsList.map((data) => {
      const stars = '★'.repeat(Math.max(1, Math.min(5, data.rating || 5))) +
                    '☆'.repeat(Math.max(0, 5 - (data.rating || 5)));
      const dateStr = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

      return `
        <article class="review-card" data-reveal>
          <div class="review-card-head">
            <div>
              <strong class="review-author">${esc(data.name)}</strong>
              ${dateStr ? `<span class="review-date">${esc(dateStr)}</span>` : ''}
            </div>
            <div class="review-stars" aria-label="Оценка ${data.rating} из 5">${stars}</div>
          </div>
          <p class="review-text">${esc(data.text)}</p>
          ${data.photoUrl ? `<div class="review-proof"><img src="${esc(data.photoUrl)}" alt="Скриншот отзыва" loading="lazy"></div>` : ''}
        </article>
      `;
    });

    reviewsContainer.innerHTML = items.join('');
  } catch (err) {
    console.error('Ошибка загрузки отзывов:', err);
    reviewsContainer.innerHTML = `
      <div class="reviews-empty">
        <p class="muted">Не удалось загрузить отзывы. Попробуйте позже.</p>
      </div>`;
  }
}

// 2. Модальное окно
if (openBtn && modal) {
  openBtn.addEventListener('click', () => {
    if (form) form.reset();
    if (successBox) successBox.style.display = 'none';
    if (form) form.style.display = 'grid';
    modal.showModal();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.review-modal-close')) {
      modal.close();
    }
  });
}

// 3. Отправка отзыва
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Защита от спам-ботов: если скрытое поле заполнено — игнорируем
    const honeypot = form.elements['website']?.value;
    if (honeypot) {
      modal.close();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const name = form.elements['name']?.value.trim();
    const text = form.elements['text']?.value.trim();
    const ratingInput = form.querySelector('input[name="rating"]:checked');
    const rating = ratingInput ? parseInt(ratingInput.value, 10) : 5;
    const lang = document.documentElement.lang || 'ru';

    if (!name || !text || name.length > 60 || text.length > 1000) {
      alert('Пожалуйста, заполните имя (до 60 симв.) и текст отзыва (до 1000 симв.).');
      return;
    }

    if (!db) {
      alert('База данных Firebase ещё не подключена. Сохранение временно недоступно.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        name,
        text,
        rating,
        lang,
        status: 'pending',
        source: 'public',
        createdAt: serverTimestamp()
      });

      form.style.display = 'none';
      if (successBox) successBox.style.display = 'block';

      // Автоматическое закрытие через 3 секунды
      setTimeout(() => {
        if (modal.open) modal.close();
      }, 3500);
    } catch (err) {
      console.error('Ошибка сохранения отзыва:', err);
      alert('Не удалось отправить отзыв. Пожалуйста, попробуйте позже.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить отзыв';
      }
    }
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

loadReviews();
