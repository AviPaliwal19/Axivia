const CACHE_NAME = 'axivia-v8';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap'
];

// ─── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to reload so they get the new version immediately
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// ─── FETCH (cache-first) ───────────────────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            try { cache.put(e.request, clone); } catch (_) {}
          });
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// ─── PERIODIC BACKGROUND SYNC ──────────────────────────────────
// Chrome for Android fires this periodically (even when app is closed)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'axivia-callback-check') {
    e.waitUntil(checkAndNotifyCallbacks());
  }
});

// ─── MESSAGE FROM APP ──────────────────────────────────────────
// App posts callback data here whenever logs are saved
self.addEventListener('message', async e => {
  if (!e.data) return;
  if (e.data.type === 'SYNC_CALLBACKS') {
    await idbSet('pending_callbacks', e.data.callbacks);
  }
  if (e.data.type === 'CHECK_NOW') {
    await checkAndNotifyCallbacks();
  }
});

// ─── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

// ─── INDEXEDDB HELPERS ─────────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('axivia-sw-db', 1);
    req.onupgradeneeded = ev => ev.target.result.createObjectStore('kv');
    req.onsuccess = ev => resolve(ev.target.result);
    req.onerror  = ev => reject(ev.target.error);
  });
}
async function idbGet(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction('kv','readonly').objectStore('kv').get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}
async function idbSet(key, val) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction('kv','readwrite').objectStore('kv').put(val, key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

// ─── CORE: CHECK & NOTIFY ──────────────────────────────────────
async function checkAndNotifyCallbacks() {
  const callbacks   = await idbGet('pending_callbacks') || [];
  const fired       = await idbGet('fired_notifications') || {};

  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  // "tomorrow" in local time
  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  const tomorrow = tmr.toISOString().split('T')[0];

  let changed = false;

  for (const cb of callbacks) {
    const date = cb.callbackDate || cb.followupDate;
    if (!date) continue;

    // ── Notify on the CALLBACK DAY ──────────────────────────
    const keyToday = `${cb.id}-${date}-today`;
    if (date === today && !fired[keyToday]) {
      await self.registration.showNotification('📞 Callback Due Today — Axivia', {
        body: `${cb.name || 'Lead'} · ${cb.phone || 'No number'}`,
        icon:  './icon-192.png',
        badge: './icon-192.png',
        tag:   keyToday,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
          { action: 'open', title: 'Open App' },
          { action: 'dismiss', title: 'Dismiss' }
        ],
        data: { url: './' }
      });
      fired[keyToday] = true;
      changed = true;
    }

    // ── Notify the EVENING BEFORE (advance warning) ─────────
    const keyTomorrow = `${cb.id}-${date}-tomorrow`;
    if (date === tomorrow && !fired[keyTomorrow]) {
      // Only fire if it's evening (after 17:00 local time)
      // Note: SW runs in UTC, so 11:30 UTC ≈ 17:00 IST
      const hourUTC = now.getUTCHours();
      if (hourUTC >= 11) {
        await self.registration.showNotification('📅 Callback Reminder — Axivia', {
          body: `Tomorrow: ${cb.name || 'Lead'} · ${cb.phone || 'No number'}`,
          icon:  './icon-192.png',
          badge: './icon-192.png',
          tag:   keyTomorrow,
          vibrate: [100, 50, 100],
          data: { url: './' }
        });
        fired[keyTomorrow] = true;
        changed = true;
      }
    }
  }

  if (changed) await idbSet('fired_notifications', fired);
}
