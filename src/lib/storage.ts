// localStorage can throw (private mode, blocked storage); fall back to memory for the session.
const memory = new Map<string, string>();

export function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeStore(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // memory fallback already updated
  }
}

const DEVICE_KEY = "devbros.deviceId";
const ADMIN_KEY = "devbros.adminToken";

/** A private random id that makes check-in idempotent per phone. Never shown or sent to the display. */
export function getDeviceId(): string {
  let id = readStore(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    writeStore(DEVICE_KEY, id);
  }
  return id;
}

/** Forget this phone's registration: future check-ins start fresh. */
export function resetDeviceId(): string {
  const id = crypto.randomUUID();
  writeStore(DEVICE_KEY, id);
  return id;
}

export const getAdminToken = () => readStore(ADMIN_KEY);
export const setAdminToken = (token: string | null) => writeStore(ADMIN_KEY, token);
