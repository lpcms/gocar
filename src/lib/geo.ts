/**
 * Geographic coordinates of the office, as the admin pastes them.
 *
 * Google Maps hands out a pair like "48.6208, 22.2879" (right-click on the
 * point -> the first line of the menu), and that is the form the Настройки ->
 * Контакты -> Координаты field expects. A semicolon or a space instead of the
 * comma is accepted too, because that is what a paste from other sources looks
 * like.
 *
 * The pair feeds the GeoCoordinates of the AutoRental entity in the JSON-LD,
 * which is what puts the business on the map in the local pack.
 */

/** One point on the globe. */
export type GeoPoint = { lat: number; lng: number };

/**
 * Parse a pasted coordinate pair, or null when the value is empty, malformed
 * or outside the range of real coordinates. Nothing invalid may reach the
 * markup: a wrong pair puts the business in the wrong place.
 */
export function parseGeo(raw: string): GeoPoint | null {
  const parts = raw
    .trim()
    .split(/[,;\s]+/)
    .filter((part) => part !== '');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0] ?? '');
  const lng = Number(parts[1] ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
