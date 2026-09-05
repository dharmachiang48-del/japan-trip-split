import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Users, Wifi, Globe, Share2, Sparkles, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// 公開免密碼 Cloudflare 加密外網 Tunnel
const DEFAULT_TUNNEL_HOST = 'https://because-registrar-brokers-earthquake.trycloudflare.com';
const LOCAL_LAN_HOST = 'http://192.168.68.72:3000';

export function RoomShareModal({
  isOpen,
  onClose,
  roomId,
  onSwitchRoom,
  syncStatus,
  onlineCount
}) {
  if (!isOpen) return null;

  // 連線模式：'tunnel' (外網，4G/5G/免同Wi-Fi推薦) 或 'lan' (同 Wi-Fi 區網)
  const [connectMode, setConnectMode] = useState('tunnel');
  const [copied, setCopied] = useState(false);
  const [newRoomInput, setNewRoomInput] = useState(roomId);

  // 取得目標分享網址（絕不使用 localhost，確保手機掃碼必能開啟）
  const getShareUrl = () => {
    let baseUrl = '';

    if (connectMode === 'tunnel') {
      baseUrl = DEFAULT_TUNNEL_HOST;
    } else {
      // 區網模式
      baseUrl = LOCAL_LAN_HOST;
    }

    // 若使用者本來就是從外部 domain 開啟，優先保留當前網域名稱
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('room', roomId);
      return currentUrl.toString();
    }

    return `${baseUrl}/?room=${encodeURIComponent(roomId)}`;
  };

  const shareUrl = getShareUrl();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSwitchRoomSubmit = (e) => {
    e.preventDefault();
    const cleanId = newRoomInput.trim().toUpperCase();
    if (cleanId && cleanId !== roomId) {
      onSwitchRoom(cleanId);
    }
  };

  const isConnected = syncStatus === 'connected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center text-white">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base">邀請旅伴掃碼加入房間</h3>
              <p className="text-[11px] text-slate-300">手機打開相機一掃，即可即時共同記帳</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-center">
          {/* 連線模式切換分頁 */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setConnectMode('tunnel')}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                connectMode === 'tunnel'
                  ? 'bg-white text-rose-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe size={14} />
              <span>外網 (4G/5G 推薦)</span>
            </button>
            <button
              type="button"
              onClick={() => setConnectMode('lan')}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                connectMode === 'lan'
                  ? 'bg-white text-blue-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wifi size={14} />
              <span>同 Wi-Fi 區網</span>
            </button>
          </div>

          {/* 模式提示說明 */}
          <div className="text-xs text-slate-500">
            {connectMode === 'tunnel' ? (
              <p className="bg-rose-50 text-rose-800 p-2.5 rounded-xl border border-rose-100 text-[11px]">
                ✨ <strong>免同 Wi-Fi</strong>：旅伴使用自己的 4G/5G 或國外 eSIM 行動網路，拿起手機相機掃描均可直接連線！
              </p>
            ) : (
              <p className="bg-blue-50 text-blue-800 p-2.5 rounded-xl border border-blue-100 text-[11px]">
                📶 <strong>同 Wi-Fi 模式</strong>：手機與電腦需連上相同 Wi-Fi（如飯店/隨身機熱點），且電腦需設為私人網路。
              </p>
            )}
          </div>

          {/* QR Code 主體 */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/80 inline-block shadow-inner mx-auto">
            <div className="p-3.5 bg-white rounded-2xl shadow-sm inline-block">
              <QRCodeSVG
                value={shareUrl}
                size={190}
                level="M"
                includeMargin={false}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-bold block mt-2">
              📱 請旅伴開啟手機內建相機掃碼
            </span>
          </div>

          {/* 房間代碼與連結文字 */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">旅程房間代碼：</span>
              <span className="font-mono font-black text-rose-600 text-sm">
                {roomId}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-slate-400 font-medium truncate max-w-[200px] text-[10px]">
                {shareUrl}
              </span>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-[11px] flex items-center gap-0.5 shrink-0"
              >
                <span>開新分頁測試</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* 複製連結按鈕 */}
          <button
            onClick={handleCopyLink}
            className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-200'
                : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-200'
            }`}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copied ? '已複製手機專用邀請連結！' : '複製手機專用邀請連結 (貼至 LINE)'}</span>
          </button>

          {/* 切換或建立新房間 */}
          <form onSubmit={handleSwitchRoomSubmit} className="pt-3 border-t border-slate-100 text-left space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">
              切換或建立其他旅程房間：
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRoomInput}
                onChange={(e) => setNewRoomInput(e.target.value)}
                placeholder="例如：OSAKA-2026"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                disabled={!newRoomInput.trim() || newRoomInput.trim().toUpperCase() === roomId}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold disabled:opacity-40 transition-colors"
              >
                切換
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              💡 只要輸入相同房間代碼，所有人就能即時同步同一份記帳與分帳數據。
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
