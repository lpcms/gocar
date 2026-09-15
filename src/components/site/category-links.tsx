import type { SiteCategoryLink } from '@/lib/site-cars';

/**
 * Category filter of the fleet pages.
 *
 * The reference calls this a chip row, but it renders as two columns of plain
 * text links: 16/22, the active one in ink at weight 700 and every other in
 * the accent colour at weight 400. The reference gives them no hover state at
 * all; phase 2 adds the ink hover of the breadcrumb links (plan section 7.3).
 * Keyboard focus is covered by the site-wide focus ring.
 *
 * Each entry is a page of its own - /cars for "all", /cars/<slug> for a
 * category (client's decision 21.08.2026) - so the active entry is known on
 * the server and this is a server component: the filter carries no client
 * JavaScript, and a shared or crawled URL renders the same list of cars.
 */
export function CategoryLinks({ items, active }: { items: SiteCategoryLink[]; active: string }) {
  /**
   * Two balanced columns, as the reference splits them: six categories give
   * three and three, and an odd count puts the extra entry in the first
   * column.
   */
  const split = Math.ceil(items.length / 2);
  const columns = [items.slice(0, split), items.slice(split)];

  return (
    <div className="site-cat-filter">
      {columns.map((column, index) => (
        <div className="site-cat-filter-col" key={index === 0 ? 'first' : 'second'}>
          {column.map((item) => (
            <a
              className="site-cat-filter-item"
              key={item.slug}
              href={item.href}
              aria-current={item.slug === active ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}
