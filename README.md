# Сайт таргетолога

HTML + Tailwind CSS (CLI) + JS, языки ru/uz. Хостинг: Cloudflare Pages. Принятые решения — в ТЗ проекта.

## Запуск

```bash
npm install
npm run dev      # http://localhost:3000, пересборка при изменениях
npm run build    # готовый сайт в dist/
```

## Где что менять

| Что | Где |
|---|---|
| Тексты ru/uz | `src/locales/ru.json`, `uz.json` |
| Кейсы | `src/data/cases.json` (скриншот: файл в `public/img/`, путь `/img/имя.webp`) |
| Разметка | `src/template/index.template.html` |
| Цвета, шрифты, отступы | `src/css/input.css` (блоки `@theme` и `:root`) |
| Адрес сайта, имя, Telegram, Instagram | `site.config.json` |
| Включить отзывы | `site.config.json` → `features.reviews: true` (после этапа Firebase) |
| Новый язык | файл `src/locales/en.json` и код языка в `langs` в `site.config.json` |

Сборка печатает предупреждения о незаполненном (`REPLACE_ME` и `[ЗАПОЛНИТЬ…]`).

## Узбекский текст
Апострофы набраны символами `‘` и `’` (U+2018, U+2019): в шрифте Manrope нет ʻ и ʼ, а эти знаки есть. Не заменяйте их на обычный `'`.

## Деплой (Cloudflare Pages)
Build command: `npm run build`, output directory: `dist`. `siteUrl` в `site.config.json` заменить на реальный адрес `*.pages.dev`.
