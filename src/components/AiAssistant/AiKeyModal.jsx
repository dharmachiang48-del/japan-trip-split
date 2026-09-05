import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, ShieldCheck, Check, Sparkles, AlertCircle } from 'lucide-react';
import { 
  getGeminiApiKey, saveGeminiApiKey, getGeminiModel, saveGeminiModel 
} from '../../utils/gemini';

export function AiKeyModal({ isOpen, onClose, onKeySaved }) {
  if (!isOpen) return null;

  const [key, setKey] = useState('');
  const [model, setModel] = useState('gemini-1.5-flash');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setKey(getGeminiApiKey());
    setModel(getGeminiModel());
    setSavedSuccess(false);
  }, [isOpen]);

  const handleSave = () => {
    saveGeminiApiKey(key);
    saveGeminiModel(model);
    setSavedSuccess(true);
    onKeySaved();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    saveGeminiApiKey('');
    setKey('');
    onKeySaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Key size={18} />
            </div>
            <h3 className="font-bold text-base">設定 Gemini 視覺 AI 金鑰</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs sm:text-sm">
          <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100 flex items-start gap-2.5 text-purple-900 text-xs">
            <ShieldCheck size={18} className="text-purple-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              API 金鑰僅保存在您的瀏覽器本地（LocalStorage），絕不會傳送給任何第三方伺服器，安全且隱私。
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Google Gemini API Key
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              AI 視覺模型選擇
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (推薦・極速且具高準確視覺理解)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash (最新一代多模態)</option>
            </select>
          </div>

          {/* 如何取得金鑰引導 */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>如何免費取得 API Key？</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-purple-600 hover:text-purple-700 font-bold inline-flex items-center gap-1"
              >
                <span>前往 Google AI Studio 申請</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>點擊上方連結登入 Google 帳號</li>
              <li>點擊「Create API key」按鈕即可免費生成</li>
              <li>複製金鑰並貼上在此即可立即啟用</li>
            </ol>
          </div>

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check size={16} />
              <span>設定已成功儲存！</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {key ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              清除金鑰 (切換回示範模式)
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95"
            >
              儲存並啟用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
