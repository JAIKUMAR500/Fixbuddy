const store = new Map();

export function cacheGet(key) {
  const row = store.get(key);
  if (!row) return undefined;
  if (row.exp && row.exp < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return row.value;
}

export function cacheSet(key, value, ttlMs = 30000) {
  store.set(key, { value, exp: ttlMs ? Date.now() + ttlMs : 0 });
  return value;
}

export function cacheDel(key) {
  store.delete(key);
}

export function cacheWrap(key, ttlMs, fn) {
  const hit = cacheGet(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return Promise.resolve(fn()).then((value) => cacheSet(key, value, ttlMs));
}
