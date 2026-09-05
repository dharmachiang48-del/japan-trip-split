// 瀏覽器本機大容量照片庫 (IndexedDB 儲存服務)
import { get, set, del } from 'idb-keyval';

const DB_PHOTOS_KEY = 'japan_trip_photos_vault';

/**
 * 壓縮過大的圖片，確保手機瀏覽器順暢不佔用過多記憶體
 */
export async function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 獲取所有照片
 */
export async function getAllPhotos() {
  try {
    const photos = await get(DB_PHOTOS_KEY);
    return photos || [];
  } catch (err) {
    console.error('Failed to get photos from IndexedDB', err);
    return [];
  }
}

/**
 * 新增一張照片
 */
export async function addPhoto(photo) {
  try {
    const current = await getAllPhotos();
    const newPhoto = {
      id: photo.id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: photo.title || '未命名照片',
      category: photo.category || 'menu', // 'menu' (菜單), 'receipt' (收據), 'tag' (商品標價), 'note' (備忘)
      imageData: photo.imageData, // Base64 data URL
      note: photo.note || '',
      createdAt: photo.createdAt || new Date().toISOString()
    };
    const updated = [newPhoto, ...current];
    await set(DB_PHOTOS_KEY, updated);
    return newPhoto;
  } catch (err) {
    console.error('Failed to add photo to IndexedDB', err);
    throw err;
  }
}

/**
 * 刪除照片
 */
export async function deletePhoto(photoId) {
  try {
    const current = await getAllPhotos();
    const updated = current.filter(p => p.id !== photoId);
    await set(DB_PHOTOS_KEY, updated);
    return true;
  } catch (err) {
    console.error('Failed to delete photo from IndexedDB', err);
    return false;
  }
}

/**
 * 更新照片資訊
 */
export async function updatePhoto(photoId, updates) {
  try {
    const current = await getAllPhotos();
    const updated = current.map(p => p.id === photoId ? { ...p, ...updates } : p);
    await set(DB_PHOTOS_KEY, updated);
    return true;
  } catch (err) {
    console.error('Failed to update photo in IndexedDB', err);
    return false;
  }
}
