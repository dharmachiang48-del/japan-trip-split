// 匯率工具函數模組 (Currency & FX Utilities)

export const DEFAULT_JPY_TO_TWD_RATE = 0.215; // 預設安全基準匯率

const RATE_CACHE_KEY = 'japan_trip_fx_cache';

/**
 * 抓取最新即時日幣兌台幣匯率 (公開免金鑰 API，附備援機制)
 */
export async function fetchLiveJpyTwdRate() {
  try {
    // 優先使用 open.er-api
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (data && data.rates && data.rates.TWD) {
      const rate = parseFloat(data.rates.TWD.toFixed(4));
      saveCachedRate(rate);
      return { rate, source: 'API (最新即時)', updateTime: new Date().toISOString() };
    }
    throw new Error('Invalid rate format');
  } catch (err) {
    console.warn('First rate API failed, trying fallback...', err);
    try {
      // 備援 API: exchangerate-api v4
      const res2 = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
      const data2 = await res2.json();
      if (data2 && data2.rates && data2.rates.TWD) {
        const rate = parseFloat(data2.rates.TWD.toFixed(4));
        saveCachedRate(rate);
        return { rate, source: 'API (備援即時)', updateTime: new Date().toISOString() };
      }
    } catch (err2) {
      console.warn('Fallback rate API failed too, using cached or default', err2);
    }
  }

  // 若均失敗則讀取快取或預設值
  const cached = getCachedRate();
  return {
    rate: cached ? cached.rate : DEFAULT_JPY_TO_TWD_RATE,
    source: cached ? '快取匯率' : '系統預設',
    updateTime: cached ? cached.updateTime : new Date().toISOString()
  };
}

export function saveCachedRate(rate) {
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({
      rate,
      updateTime: new Date().toISOString()
    }));
  } catch (e) {
    console.error(e);
  }
}

export function getCachedRate() {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return null;
}

/**
 * 將指定金額依匯率設定換算為台幣 (TWD)
 * @param {number} amount - 金額數值
 * @param {'JPY' | 'TWD'} currency - 幣別
 * @param {number} rate - 當前套用匯率 (1 JPY = x TWD)
 * @returns {number} 折合新台幣 (四捨五入整數)
 */
export function convertToTwd(amount, currency, rate) {
  if (!amount || isNaN(amount)) return 0;
  if (currency === 'TWD') return Math.round(amount);
  return Math.round(amount * (rate || DEFAULT_JPY_TO_TWD_RATE));
}

/**
 * 格式化台幣
 */
export function formatTWD(num) {
  if (num === undefined || num === null || isNaN(num)) return 'NT$ 0';
  return `NT$ ${Math.round(num).toLocaleString('zh-TW')}`;
}

/**
 * 格式化日幣
 */
export function formatJPY(num) {
  if (num === undefined || num === null || isNaN(num)) return '¥ 0';
  return `¥ ${Math.round(num).toLocaleString('ja-JP')}`;
}
