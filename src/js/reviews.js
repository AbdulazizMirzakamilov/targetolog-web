const reviewsContainer = document.getElementById('reviews-list');
const modal = document.getElementById('review-modal');
const openBtn = document.getElementById('open-review-modal');
const form = document.getElementById('review-form');
const successBox = document.getElementById('review-success');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (url) => {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^https:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) return trimmed;
  return '';
};

async function loadReviews() {
  if (!reviewsContainer) return;
  const lang = reviewsContainer.dataset.reviewsLang || 'ru';

  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];

    if (reviews.length === 0) {
      reviewsContainer.innerHTML = `
        <div class="reviews-empty">
          <p class="muted">Пока здесь нет отзывов. Станьте первым, кто поделится результатами!</p>
        </div>`;
      return;
    }

    const items = reviews.map((item) => {
      const rating = Math.max(1, Math.min(5, Number(item.rating) || 5));
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const dateStr = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      const initial = (item.name || 'К').trim().charAt(0).toUpperCase();
      const verifiedProof = safeUrl(item.photoUrl);

      return `
        <article class="review-card">
          <div class="review-card-head">
            <div class="review-avatar" aria-hidden="true">${esc(initial)}</div>
            <div class="review-meta">
              <strong class="review-author">${esc(item.name)}</strong>
              ${dateStr ? `<span class="review-date">${esc(dateStr)}</span>` : ''}
            </div>
            <div class="review-stars" aria-label="Оценка ${rating} из 5">${stars}</div>
          </div>
          <p class="review-text">${esc(item.text)}</p>
          ${verifiedProof ? `<div class="review-proof"><img src="${esc(verifiedProof)}" alt="Скриншот отзыва" loading="lazy"></div>` : ''}
        </article>
      `;
    });

    reviewsContainer.innerHTML = items.join('');
  } catch (err) {
    reviewsContainer.innerHTML = `
      <div class="reviews-empty">
        <p class="muted">Пока здесь нет отзывов. Станьте первым, кто поделится результатами!</p>
      </div>`;
  }
}

if (modal && openBtn) {
  openBtn.addEventListener('click', () => {
    if (form) form.style.display = 'block';
    if (successBox) successBox.style.display = 'none';
    modal.showModal();
  });

  const closeBtn = modal.querySelector('.review-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', () => modal.close());

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

if (form && modal) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const honeypot = form.elements['website']?.value;
    if (honeypot) {
      form.style.display = 'none';
      if (successBox) successBox.style.display = 'block';
      return;
    }

    const lastSubmitTime = localStorage.getItem('review_submitted_at');
    if (lastSubmitTime && Date.now() - Number(lastSubmitTime) < 300000) {
      alert('Вы уже отправили отзыв. Отправка следующего отзыва возможна через 5 минут.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Отправить';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    const name = form.elements['name']?.value?.trim() || 'Аноним';
    const rating = parseInt(form.elements['rating']?.value || '5', 10);
    const text = form.elements['text']?.value?.trim() || '';
    const lang = reviewsContainer?.dataset.reviewsLang || 'ru';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rating, text, lang })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Ошибка при отправке');
      }

      localStorage.setItem('review_submitted_at', String(Date.now()));
      form.reset();
      form.style.display = 'none';
      if (successBox) successBox.style.display = 'block';
    } catch (err) {
      alert(err.message || 'Произошла ошибка при отправке. Пожалуйста, попробуйте снова.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
}

loadReviews();
