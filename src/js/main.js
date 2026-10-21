// Меню на телефоне, плавное появление блоков, события кликов (задел под аналитику)
const header = document.querySelector('.site-header');
const btn = document.querySelector('.menu-btn');

if (btn && header) {
  const setOpen = (open) => {
    header.classList.toggle('is-menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

// Просмотр скриншотов кейсов (Lightbox)
const lb = document.getElementById('lightbox');
if (lb) {
  const lbImg = lb.querySelector('img');
  document.querySelectorAll('.case-shot-wrap, .case-shot img').forEach((el) => {
    el.addEventListener('click', () => {
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (img) {
        lbImg.src = img.src;
        lbImg.alt = img.alt;
        lb.showModal();
      }
    });
  });
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.closest('.lightbox-close')) lb.close();
  });
}

// Появление блоков: если IntersectionObserver недоступен, всё просто видно
const items = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add('is-in'));
}

// Клики с data-track отправляются как событие страницы; analytics.js (этап «SEO и аналитика») подпишется на него
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track]');
  if (el) document.dispatchEvent(new CustomEvent('site:track', { detail: { name: el.dataset.track } }));
});
