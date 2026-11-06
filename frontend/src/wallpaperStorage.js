export async function wallpaperStorage(action, key, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('mowu-appearance', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('wallpapers');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('浏览器不允许保存壁纸，请检查存储设置'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('wallpapers', action === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('wallpapers');
      const request = action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(value, key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(Error('壁纸保存失败，可能是浏览器存储空间不足'));
      transaction.onabort = () => reject(Error('壁纸保存已中断'));
    });
  } finally { db.close(); }
}
