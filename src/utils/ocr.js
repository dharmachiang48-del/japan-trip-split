// 前端照片價格 OCR 辨識模組 (Tesseract.js OCR & Price Extractor)
import { createWorker } from 'tesseract.js';

/**
 * 即時掃描需要連續看到同一個價格，才把它視為穩定結果。
 */
export function updatePriceStability(previous, detectedPrices, requiredMatches = 2) {
  const candidateAmount = detectedPrices?.[0]?.amount ?? null;
  if (!candidateAmount) {
    return { candidateAmount: null, consecutiveMatches: 0, stableAmount: null };
  }

  const consecutiveMatches = previous?.candidateAmount === candidateAmount
    ? previous.consecutiveMatches + 1
    : 1;

  return {
    candidateAmount,
    consecutiveMatches,
    stableAmount: consecutiveMatches >= requiredMatches ? candidateAmount : null
  };
}

/**
 * 分別追蹤同一畫面中的每一個價格；未出現在新畫面的價格會被移除。
 */
export function updatePriceCandidatesStability(previousCandidates = [], detectedPrices = [], requiredMatches = 2) {
  const previousByAmount = new Map(
    previousCandidates.map((candidate) => [candidate.amount, candidate])
  );

  return detectedPrices.map((price) => {
    const previous = previousByAmount.get(price.amount);
    const consecutiveMatches = previous ? previous.consecutiveMatches + 1 : 1;
    return {
      ...price,
      consecutiveMatches,
      isStable: consecutiveMatches >= requiredMatches
    };
  });
}

/**
 * 建立可重複使用的 OCR 掃描器。即時相機模式會共用同一個 worker，
 * 避免每一幀都重新下載與啟動辨識引擎。
 */
export async function createPriceScanner({
  onProgress = () => {},
  createWorkerImpl = createWorker
} = {}) {
  let activeProgress = onProgress;
  let terminated = false;

  activeProgress({ status: 'initializing', progress: 0.1, message: '啟動辨識引擎中...' });
  const worker = await createWorkerImpl('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        activeProgress({
          status: 'recognizing',
          progress: 0.2 + (message.progress || 0) * 0.75,
          message: `辨識文字中... (${Math.round((message.progress || 0) * 100)}%)`
        });
      }
    }
  });

  return {
    async scan(imageSource, nextOnProgress = onProgress) {
      if (terminated) throw new Error('辨識引擎已關閉');
      activeProgress = nextOnProgress;
      activeProgress({ status: 'processing', progress: 0.15, message: '讀取日幣價格中...' });

      const { data: { text } } = await worker.recognize(imageSource);
      const detectedPrices = extractPricesFromText(text);
      activeProgress({ status: 'complete', progress: 1, message: '辨識完成！' });
      return { rawText: text, detectedPrices };
    },

    async terminate() {
      if (terminated) return;
      terminated = true;
      await worker.terminate();
    }
  };
}

/**
 * 辨識圖片中的日文字與數字，並自動萃取可能的價格數字
 * @param {string | File} imageSource
 * @param {Function} onProgress 回報進度回呼函式
 * @returns {Promise<{ rawText: string, detectedPrices: Array<{ amount: number, label: string }> }>}
 */
export async function scanPriceFromImage(imageSource, onProgress = () => {}) {
  let scanner = null;
  try {
    scanner = await createPriceScanner({ onProgress });
    return await scanner.scan(imageSource, onProgress);
  } catch (err) {
    console.error('OCR Error:', err);
    throw err;
  } finally {
    if (scanner) {
      try { await scanner.terminate(); } catch (e) {}
    }
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
