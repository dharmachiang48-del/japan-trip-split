import React, { useEffect, useState } from 'react';
import { Camera, Users, RefreshCw, Sparkles, SlidersHorizontal, Key } from 'lucide-react';
import { formatTWD } from '../utils/currency';

export function Header({
  tripTitle,
  setTripTitle,
  currentRate,
  rateSource,
  refreshRate,
  onOpenOcr,
  onOpenMembers,
  onOpenAiKey,
  hasApiKey,
  roomId,
  syncStatus,
  syncError,
  onlineCount,
  onOpenRoomShare
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tripTitle);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isEditingTitle) setDraftTitle(tripTitle);
  }, [tripTitle, isEditingTitle]);

  const beginTitleEdit = () => {
    setDraftTitle(tripTitle);
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== tripTitle) setTripTitle(nextTitle);
    else setDraftTitle(tripTitle);
    setIsEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setDraftTitle(tripTitle);
    setIsEditingTitle(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshRate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo & Trip Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-sm shadow-rose-200 shrink-0">
            <span className="text-lg">🗾</span>
          </div>

          <div className="min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitleEdit();
                  if (e.key === 'Escape') cancelTitleEdit();
                }}
                autoFocus
                className="font-bold text-slate-800 text-base border-b-2 border-rose-500 bg-transparent outline-none px-1 py-0.5"
              />
            ) : (
              <h1
                onClick={beginTitleEdit}
                className="font-bold text-slate-800 text-base sm:text-lg truncate cursor-pointer hover:text-rose-600 transition-colors flex items-center gap-1.5"
                title="點擊修改旅程名稱"
              >
                {tripTitle}
                <span className="text-xs text-slate-400 font-normal">✎</span>
              </h1>
            )}
            
            {/* Live Exchange Rate Badge */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="inline-flex items-center gap-1 font-medium bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">
                1 JPY ≈ NT$ {currentRate.toFixed(4)}
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="hover:text-slate-700 transition-colors p-0.5 rounded"
                title={`更新匯率 (來源: ${rateSource})`}
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-rose-600' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Room Live Sync Button */}
          <button
            onClick={onOpenRoomShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
            title={syncError || '多人即時連線房間設定與 QR Code'}
          >
            <span className={`w-2 h-2 rounded-full ${
              syncError
                ? 'bg-rose-500'
                : syncStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : syncStatus === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
            }`} />
            <span className="hidden sm:inline font-mono">{roomId}</span>
            <span className="text-[10px] text-slate-500">
              {syncError ? '未儲存' : `(${onlineCount}人)`}
            </span>
          </button>

          {/* OCR Quick Price Scan Button */}
          <button
            onClick={onOpenOcr}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl text-xs sm:text-sm font-medium shadow-sm shadow-rose-200 transition-all active:scale-95"
            title="拍照識別價格並自動換匯"
          >
            <Camera size={16} />
            <span className="hidden sm:inline">拍照辨識價格</span>
            <span className="sm:hidden">拍價</span>
          </button>

          {/* Members Button */}
          <button
            onClick={onOpenMembers}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative"
            title="管理旅伴成員"
          >
            <Users size={18} />
          </button>

          {/* AI Settings Button */}
          <button
            onClick={onOpenAiKey}
            className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors relative"
            title="AI 助手設定 (Gemini API)"
          >
            <Sparkles size={18} className={hasApiKey ? 'text-purple-600' : 'text-slate-400'} />
            {hasApiKey && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
