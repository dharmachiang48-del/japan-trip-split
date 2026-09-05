// 前端照片價格 OCR 辨識模組 (Tesseract.js OCR & Price Extractor)
import { createWorker } from 'tesseract.js';

/**
 * 辨識圖片中的日文字與數字，並自動萃取可能的價格數字
 * @param {string | File} imageSource
 * @param {Function} onProgress 回報進度回呼函式
 * @returns {Promise<{ rawText: string, detectedPrices: Array<{ amount: number, label: string }> }>}
 */
export async function scanPriceFromImage(imageSource, onProgress = () => {}) {
  let worker = null;
  try {
    onProgress({ status: 'initializing', progress: 0.1, message: '啟動辨識引擎中...' });

    worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          onProgress({
            status: 'recognizing',
            progress: 0.2 + (m.progress || 0) * 0.75,
            message: `辨識文字中... (${Math.round((m.progress || 0) * 100)}%)`
          });
        }
      }
    });

    onProgress({ status: 'processing', progress: 0.9, message: '解析日幣價格數字中...' });

    const { data: { text } } = await worker.recognize(imageSource);
    await worker.terminate();
    worker = null;

    // 解析文字中的價格標籤與數字
    const detectedPrices = extractPricesFromText(text);

    onProgress({ status: 'complete', progress: 1.0, message: '辨識完成！' });

    return {
      rawText: text,
      detectedPrices
    };
  } catch (err) {
    console.error('OCR Error:', err);
    if (worker) {
      try { await worker.terminate(); } catch (e) {}
    }
    throw err;
  }
}

/**
 * 利用正則表達式從 OCR 文字中過濾日幣價格
 */
export function extractPricesFromText(text) {
  if (!text) return [];

  const prices = new Map();

  // 1. 匹配如 ¥1,500, 1500円, ￥2,980, 1,980 (税込)
  const regexPatterns = [
    /[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})/g,
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*(?:円|yen)/gi,
    /税込\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})/gi,
    /(?:合計|小計|TOTAL)\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})/gi,
    /([0-9]{1,3}(?:,[0-9]{3})+)/g // 任何帶逗號的數字
  ];

  regexPatterns.forEach((pattern, pIndex) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1] ? match[1].replace(/,/g, '') : match[0].replace(/,/g, '');
      const amount = parseInt(numStr, 10);

      // 合理日幣金額區間（通常介於 50 到 1,000,000 日圓）
      if (!isNaN(amount) && amount >= 50 && amount <= 2000000) {
        let label = `¥${amount.toLocaleString()}`;
        if (pIndex === 2) label += ' (含稅)';
        if (pIndex === 3) label += ' (總計)';
        
        if (!prices.has(amount)) {
          prices.set(amount, { amount, label, confidence: pIndex < 4 ? 0.9 : 0.6 });
        }
      }
    }
  });

  // 依照出現合理性或金額大小排序
  const result = Array.from(prices.values());
  result.sort((a, b) => b.amount - a.amount);
  return result;
}
