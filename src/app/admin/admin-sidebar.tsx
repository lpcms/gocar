'use client';

import { usePathname } from 'next/navigation';

const NAV: Array<[string, string]> = [
  ['/admin', 'Обзор'],
  ['/admin/cars', 'Автомобили'],
  ['/admin/categories', 'Категории'],
  ['/admin/extras', 'Опции заказа'],
  ['/admin/translations', 'Переводы'],
  ['/admin/media', 'Изображения'],
  ['/admin/reviews', 'Отзывы'],
  ['/admin/settings', 'Настройки'],
  ['/admin/leads', 'Заявки'],
  ['/admin/login-attempts', 'Попытки входа']
];

/**
 * Client-side sidebar: reads the current path with usePathname so the
 * active section highlight always matches the URL that's actually shown.
 * Previous server-side approaches (middleware header, Referer fallback)
 * lagged by one navigation under Next 15's caching.
 */
export function AdminSidebar() {
  const path = usePathname() ?? '';
  function isActive(href: string): boolean {
    if (href === '/admin') return path === '/admin' || path === '/admin/';
    return path === href || path.startsWith(`${href}/`);
  }
  return (
    <aside className="a-side">
      <div className="a-logo">
        Go<em>Car</em> Админ
      </div>
      <nav className="a-nav">
        {NAV.map(([href, label]) => (
          <a key={href} href={href} className={isActive(href) ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>
      <form action="/api/admin/logout" method="post">
        <button type="submit" className="a-btn ghost" style={{ width: '100%' }}>
          Выйти
        </button>
      </form>
    </aside>
  );
}
