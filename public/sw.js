/**
 * Self-retiring service worker.
 *
 * The public site used to be Framer snapshots, and every one of them
 * registered a worker here that rewrote requests for framerusercontent.com,
 * fonts.gstatic.com and ga.jspm.io to local copies. Phase 2 replaced those
 * pages with our own render, which serves its fonts from /fonts and never
 * touches an external Framer host, so the worker has nothing left to do -
 * but it stays registered in the browser of everyone who visited before the
 * migration, and only the site can tell it to go.
 *
 * This version therefore does one thing: it unregisters itself and clears
 * anything the old one cached. A returning visitor picks it up on their next
 * navigation, it removes itself, and the file can be deleted from the project
 * once enough time has passed for that to have happened.
 *
 * The URL must not change - a browser only ever re-fetches the worker it
 * already has registered.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      /**
       * The old worker kept no cache of its own, but clearing is cheap and
       * covers a build that did.
       */
      try {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      } catch {
        /** Storage may be unavailable; unregistering still matters. */
      }
      await self.registration.unregister();
      /**
       * Reload the open tabs once, so they leave the control of a worker that
       * no longer exists instead of running uncontrolled until the next
       * navigation.
       */
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url).catch(() => {});
      }
    })()
  );
});

/**
 * No fetch handler on purpose: while this version is active every request must
 * go straight to the network.
 */
