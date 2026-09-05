// Google Gemini 視覺多模態 AI 助手服務 (AI Vision Assistant)

const GEMINI_API_KEY_STORAGE = 'japan_trip_gemini_key';
const GEMINI_MODEL_STORAGE = 'japan_trip_gemini_model';

export const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

export function getGeminiApiKey() {
  return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
}

export function saveGeminiApiKey(key) {
  if (key) {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  }
}

export function getGeminiModel() {
  return localStorage.getItem(GEMINI_MODEL_STORAGE) || DEFAULT_GEMINI_MODEL;
}

export function saveGeminiModel(model) {
  localStorage.setItem(GEMINI_MODEL_STORAGE, model);
}

/**
 * 預設快捷提問範本膠囊 (Quick Prompt Pills)
 */
export const QUICK_PROMPTS = [
  {
    id: 'translate_menu',
    label: '🍱 日文菜單翻譯',
    prompt: '請幫我辨識並翻譯這張菜單上的所有菜色為繁體中文，並附上標價與簡短口感介紹。'
  },
  {
    id: 'recommend',
    label: '⭐ 店家招牌推薦',
    prompt: '根據這張菜單，通常日本人最推薦點哪一道招牌菜？有哪些必吃亮點？'
  },
  {
    id: 'allergen',
    label: '⚠️ 食材與過敏原分析',
    prompt: '請詳細檢查這道菜或菜單，是否含有牛肉、豬肉、海鮮、花生、蛋奶或辛辣成分？'
  },
  {
    id: 'receipt_breakdown',
    label: '🧾 收據明細與稅率拆解',
    prompt: '請幫我列出這張收據的個別品項、數量、單價，以及 10% 內用稅或 8% 外帶輕減稅與總計金額。'
  },
  {
    id: 'how_to_order',
    label: '🗣️ 日文點餐會話',
    prompt: '如果我想點這道菜，請提供實用的日文點餐句子與羅馬拼音念法。'
  }
];

/**
 * 發送照片與提問至 Google Gemini 視覺模型
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.imageDataBase64 - 照片 Base64 Data URL (e.g. data:image/jpeg;base64,...)
 * @param {string} params.question - 使用者提問
 * @param {Array} [params.history] - 前後文對話記錄
 * @returns {Promise<string>} AI 回覆 Markdown 字串
 */
export async function queryGeminiVision({ apiKey, imageDataBase64, question, history = [] }) {
  const activeKey = apiKey || getGeminiApiKey();

  // 若使用者尚未填寫 API Key，使用離線智慧展示模式
  if (!activeKey) {
    return generateDemoResponse(question);
  }

  // 擷取純 base64 與 mimeType
  let mimeType = 'image/jpeg';
  let base64Data = imageDataBase64;
  if (imageDataBase64.startsWith('data:')) {
    const parts = imageDataBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    base64Data = parts[1];
  }

  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;

  const systemInstruction = `你是一位專業且熱情貼心的「日本自由行與美食視覺 AI 導遊助手」。
你擅長辨識日本菜單、便利商店標籤、藥妝店成分表、店家消費明細與景點票券。
請以親切、易讀、條理分明的繁體中文（台灣用語習慣）回答。
回答時請：
1. 針對照片中的具體內容回答，如有日文請附上對應繁體中文翻譯與假名/羅馬拼音。
2. 標記價格與份量，並貼心提示食用方式或可能含有的過敏原（如牛肉、蝦蟹甲殼類、堅果）。
3. 語氣熱情友善，排版善用粗體、條列點清單或表格。`;

  // 組合 Gemini contents payload
  const contents = [];

  // 加入歷史訊息 (若有)
  history.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  });

  // 加入當前提問與圖片
  contents.push({
    role: 'user',
    parts: [
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      },
      {
        text: `${systemInstruction}\n\n使用者提問：${question}`
      }
    ]
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${response.status} 錯誤`;
      throw new Error(`Gemini API 回應異常：${msg}`);
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) {
      throw new Error('未取得 Gemini 的有效文字回應，可能受到安全防護機制過濾。');
    }

    return replyText;
  } catch (error) {
    console.error('Gemini Vision Query Error:', error);
    throw error;
  }
}

/**
 * 智慧展示模式 (未填寫 API Key 時的預覽回覆)
 */
function generateDemoResponse(question) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`💡 **【AI 助手示範模式】**\n\n您詢問了：「*${question}*」\n\n📌 **這是一張日本旅遊相片範例解析：**\n- **主要品項**：日式豚骨拉麵（特製とんこつラーメン）\n- **日幣價格**：¥980（含稅 10% 約 NT$ 210）\n- **主要食材**：自家熬製濃郁豚骨高湯、炙燒叉燒肉 2 片、糖心蛋（味玉）、青蔥、特選海苔。\n- **過敏原提醒**：含有大豆、小麥、豬肉製品；無牛肉成分。\n- **實用點餐日語**：\n  - 「これをお願いします (Kore o onegaishimasu)」👉 *我要點這個*\n  - 「麺かためで (Men katame de)」👉 *麵條要偏硬*\n\n> 🔑 **提示**：若要進行真實圖片的多模態即時深度解析，請點擊上方 **「設定 API Key」** 輸入您的 Google Gemini API Key（可在 Google AI Studio 免費申請取得），即可無限享受專屬旅遊 AI 視覺諮詢！`);
    }, 600);
  });
}
