export const localStore = {
  get(key, fallback = null) {
    if (typeof window === "undefined") return fallback;
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota and serialization errors in MVP mode.
    }
  },
};
