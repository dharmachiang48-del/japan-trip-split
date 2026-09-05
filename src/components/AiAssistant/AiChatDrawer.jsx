import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Sparkles, Key, Bot, User, RefreshCw, 
  HelpCircle, ChevronRight, CornerDownLeft, Image as ImageIcon 
} from 'lucide-react';
import { 
  queryGeminiVision, QUICK_PROMPTS, getGeminiApiKey 
} from '../../utils/gemini';

export function AiChatDrawer({
  isOpen,
  onClose,
  activePhoto,
  onOpenKeyModal
}) {
  if (!isOpen) return null;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    setHasKey(Boolean(getGeminiApiKey()));
    // 初始化歡迎訊息
    if (activePhoto) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: `👋 哈囉！我是你的**日本旅遊 AI 視覺助手**！\n我已經載入你指定的照片：**「${activePhoto.title || '旅程照片'}」**。\n\n你可以直接詢問我關於這張照片的任何問題（例如翻譯日文菜單、詢問推薦菜色、檢查牛肉或海鮮過敏原、分析收據稅金等），或直接點擊下方的快捷提問膠囊！`
        }
      ]);
    }
  }, [activePhoto, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // 發送訊息給 AI
  const handleSendMessage = async (textToSend) => {
    const question = (textToSend || inputText).trim();
    if (!question || isThinking || !activePhoto) return;

    setInputText('');

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: question
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsThinking(true);

    try {
      const reply = await queryGeminiVision({
        imageDataBase64: activePhoto.imageData,
        question,
        history: messages.slice(1) // 排除開頭歡迎語
      });

      setMessages([
        ...newHistory,
        {
          id: `ai_${Date.now()}`,
          role: 'model',
          text: reply
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newHistory,
        {
          id: `ai_err_${Date.now()}`,
          role: 'model',
          text: `⚠️ 抱歉，解析照片時遇到問題：\n${err.message || '請確認網路連線或 API Key 設定'}\n\n您可以點擊上方齒輪檢查 API Key 設定。`
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // 格式化簡易 Markdown（支援粗體、條列與換行）
  const renderFormattedText = (content) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // 判斷引號引用
      if (line.startsWith('> ')) {
        return (
          <blockquote key={index} className="border-l-4 border-purple-400 pl-3 py-1 my-1.5 bg-purple-50/60 rounded-r text-xs text-purple-900 font-medium">
            {line.replace(/^>\s*/, '')}
          </blockquote>
        );
      }

      // 判斷條列項目
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ');
      const cleanLine = isBullet ? line.trim().substring(2) : line;

      // 粗體替換
      const parts = cleanLine.split(/(\*\*.*?\*\*|\*.*?\*)/g);

      return (
        <p key={index} className={`${isBullet ? 'ml-3 list-disc my-0.5' : 'my-1'} text-xs sm:text-sm leading-relaxed`}>
          {isBullet && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mr-2 -translate-y-0.5"></span>}
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-purple-950">{part.slice(2, -2)}</strong>;
            } else if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx} className="italic text-slate-600">{part.slice(1, -1)}</em>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md sm:max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* 頂部 Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base truncate">AI 照片問答助手</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-medium">
                  {hasKey ? 'Gemini 視覺模式' : '示範模式'}
                </span>
              </div>
              <p className="text-[11px] text-purple-200 truncate">
                根據照片為您翻譯、解讀食材與拆解收據
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onOpenKeyModal}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-colors text-purple-200 hover:text-white"
              title="設定 Gemini API Key"
            >
              <Key size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-colors text-purple-200 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 當前綁定的照片縮圖橫幅 */}
        {activePhoto && (
          <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center gap-3">
            <img
              src={activePhoto.imageData}
              alt="Context"
              className="w-12 h-12 rounded-xl object-cover border border-purple-200 shadow-sm shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                當前檢視中相片
              </span>
              <h4 className="font-bold text-slate-800 text-xs truncate">
                {activePhoto.title}
              </h4>
            </div>
          </div>
        )}

        {/* 快捷提問膠囊 (Quick Prompts) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles size={12} className="text-purple-600" />
            <span>點擊快捷提問：</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.id}
                onClick={() => handleSendMessage(qp.prompt)}
                disabled={isThinking}
                className="px-2.5 py-1 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-200 rounded-xl whitespace-nowrap font-medium transition-all shadow-2xs active:scale-95 text-xs"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* 對話訊息歷史 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {messages.map((msg) => {
            const isAi = msg.role === 'model';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isAi ? 'justify-start' : 'justify-end'}`}
              >
                {isAi && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Bot size={15} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-sm ${
                    isAi
                      ? 'bg-white text-slate-800 border border-slate-200'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  }`}
                >
                  {isAi ? renderFormattedText(msg.text) : msg.text}
                </div>

                {!isAi && (
                  <div className="w-7 h-7 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    你
                  </div>
                )}
              </div>
            );
          })}

          {/* AI 思考中動畫 */}
          {isThinking && (
            <div className="flex gap-2.5 items-center text-xs text-purple-700 font-medium animate-pulse bg-purple-50/70 p-3 rounded-2xl border border-purple-100 w-fit">
              <RefreshCw size={14} className="animate-spin text-purple-600" />
              <span>AI 正在專注閱讀相片文字並組織回答中...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 底部輸入列 */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="問問這張照片（例：有加牛肉嗎？辣度如何？）..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isThinking}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl shadow-sm shadow-purple-200 disabled:opacity-40 transition-all active:scale-95 shrink-0"
            >
              <Send size={16} />
            </button>
          </form>

          {!hasKey && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>現為離線示範模式</span>
              <button
                type="button"
                onClick={onOpenKeyModal}
                className="text-purple-600 hover:underline font-semibold"
              >
                輸入免費 Gemini Key 解鎖任意相片提問
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
