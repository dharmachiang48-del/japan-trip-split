export function roomStorageKey(roomId, field) {
  return `japan_trip_${roomId}_${field}`;
}

function parseArray(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error('Failed to parse room cache:', error);
    return fallback;
  }
}

export function loadCachedRoom(roomId, defaults, storage = localStorage) {
  const titleKey = roomStorageKey(roomId, 'title');
  const membersKey = roomStorageKey(roomId, 'members');
  const expensesKey = roomStorageKey(roomId, 'expenses');
  const versionKey = roomStorageKey(roomId, 'version');

  let tripTitle = storage.getItem(titleKey);
  let membersValue = storage.getItem(membersKey);
  let expensesValue = storage.getItem(expensesKey);

  if (!tripTitle && !membersValue && !expensesValue && roomId === 'TOKYO-2026') {
    tripTitle = storage.getItem('japan_trip_title');
    membersValue = storage.getItem('japan_trip_members');
    expensesValue = storage.getItem('japan_trip_expenses');
    if (tripTitle) storage.setItem(titleKey, tripTitle);
    if (membersValue) storage.setItem(membersKey, membersValue);
    if (expensesValue) storage.setItem(expensesKey, expensesValue);
  }

  return {
    tripTitle: tripTitle || defaults.tripTitle,
    members: parseArray(membersValue, defaults.members),
    expenses: parseArray(expensesValue, defaults.expenses),
    version: Number(storage.getItem(versionKey)) || 0
  };
}

export function saveServerRoom(roomId, data, storage = localStorage) {
  storage.setItem(roomStorageKey(roomId, 'title'), data.tripTitle);
  storage.setItem(roomStorageKey(roomId, 'members'), JSON.stringify(data.members));
  storage.setItem(roomStorageKey(roomId, 'expenses'), JSON.stringify(data.expenses));
  storage.setItem(roomStorageKey(roomId, 'version'), String(Number(data.version) || 0));
}

export function shouldApplyServerVersion(localVersion, serverVersion) {
  return Number(serverVersion) >= Number(localVersion || 0);
}
