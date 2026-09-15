import { getDb } from '@/lib/db';
import CacheButton from './cache-button';

/**
 * Admin dashboard: quick stats. CRUD sections arrive in v3.2+.
 */
export default function AdminHome() {
  const db = getDb();
  const cars = (db.prepare('SELECT COUNT(*) AS n FROM cars').get() as unknown as { n: number }).n;
  const categories = (
    db.prepare('SELECT COUNT(*) AS n FROM categories').get() as unknown as { n: number }
  ).n;
  const extras = (
    db.prepare('SELECT COUNT(*) AS n FROM extras').get() as unknown as { n: number }
  ).n;
  const translations = (
    db.prepare('SELECT COUNT(DISTINCT key) AS n FROM translations').get() as unknown as { n: number }
  ).n;
  const images = (
    db.prepare('SELECT COUNT(*) AS n FROM media').get() as unknown as { n: number }
  ).n;
  const newLeads = (
    db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'").get() as unknown as { n: number }
  ).n;
  const attempts = (
    db.prepare('SELECT COUNT(*) AS n FROM login_attempts').get() as unknown as { n: number }
  ).n;
  const stats: Array<[number, string]> = [
    [cars, 'Автомобилей'],
    [categories, 'Категорий'],
    [extras, 'Опций заказа'],
    [translations, 'Переводов'],
    [images, 'Изображений'],
    [newLeads, 'Новых заявок'],
    [attempts, 'Записей в журнале входа']
  ];
  interface RecentLead { id: number; type: string; name: string; grand_total: number | null; created_at: string; }
  const recent = db
    .prepare("SELECT id, type, name, grand_total, created_at FROM leads WHERE status = 'new' ORDER BY id DESC LIMIT 5")
    .all() as unknown as RecentLead[];
  return (
    <div>
      <h1>Обзор</h1>
      <div className="a-stats">
        {stats.map(([n, l]) => (
          <div className="a-stat" key={l}>
            <div className="n">{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
        <CacheButton/>
      </div>
      {recent.length > 0 && (
        <div className="a-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b>Новые заявки</b>
            <a className="a-btn ghost" href="/admin/leads">Все заявки</a>
          </div>
          <table className="a-table">
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 40 }}>#{r.id}</td>
                  <td>{r.type === 'booking' ? 'заказ' : 'контакт'}</td>
                  <td>{r.name}</td>
                  <td>{r.grand_total !== null ? `$${r.grand_total}` : '—'}</td>
                  <td style={{ color: '#7a7f89', fontSize: 12 }}>{r.created_at}</td>
                  <td style={{ width: 100 }}><a className="a-btn" href={`/admin/leads/${r.id}`}>Открыть</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
