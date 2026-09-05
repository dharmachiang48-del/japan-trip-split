import React, { useState } from 'react';
import { 
  ArrowRight, Copy, Check, Share2, Scale, 
  TrendingUp, TrendingDown, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { calculateSettlement, generateLineSettlementText } from '../utils/settlement';
import { formatTWD, formatJPY } from '../utils/currency';
import { MemberAvatar } from './MemberAvatar';

export function SettlementView({ tripTitle, members, expenses }) {
  const [copied, setCopied] = useState(false);
  const [showRawLineText, setShowRawLineText] = useState(false);

  const { memberBalances, transfers, totalSpentTwd, totalSpentJpy } = calculateSettlement(members, expenses);

  const handleCopyLineText = () => {
    const text = generateLineSettlementText(tripTitle, members, expenses);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto animate-in fade-in">
      {/* 總覽開銷卡片 */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Scale size={15} className="text-rose-400" />
              旅程分帳結算中心
            </span>
            <span>{members.length} 位旅伴 • {expenses.length} 筆明細</span>
          </div>

          <div>
            <div className="text-xs text-slate-400">旅程總結算金額</div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-0.5">
              {formatTWD(totalSpentTwd)}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 pt-2 border-t border-slate-700">
            <div>
              日幣總額：<span className="font-semibold text-rose-300">{formatJPY(totalSpentJpy)}</span>
            </div>
            <span>•</span>
            <div>
              每人均攤：<span className="font-semibold text-emerald-300">{formatTWD(members.length > 0 ? totalSpentTwd / members.length : 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 最佳清算轉帳建議 (誰該付誰多少錢) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              🤝 最佳結算轉帳方案
            </h3>
            <p className="text-[11px] text-slate-400">已自動套用演算法消除三角債務，以最少筆數結清</p>
          </div>

          <button
            onClick={handleCopyLineText}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              copied
                ? 'bg-emerald-500 text-white shadow-emerald-200'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95 shadow-emerald-100'
            }`}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? '已複製 LINE 結算文字！' : '複製 LINE 結算清單'}</span>
          </button>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h4 className="font-bold text-emerald-800 text-sm">帳目已完美平衡！</h4>
            <p className="text-xs text-emerald-600">目前沒有任何人需要額外轉帳或補款。</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transfers.map((t, idx) => (
              <div
                key={idx}
                className="bg-slate-50 hover:bg-rose-50/40 p-4 rounded-2xl border border-slate-200 transition-colors flex items-center justify-between gap-3"
              >
                {/* 付款方 */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <MemberAvatar member={members.find(m => m.id === t.fromId) || { name: t.fromName }} size="md" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 block">轉帳人</span>
                    <span className="font-bold text-slate-800 text-sm truncate block">
                      {t.fromName}
                    </span>
                  </div>
                </div>

                {/* 金額與箭頭 */}
                <div className="flex flex-col items-center shrink-0 px-2">
                  <span className="font-black text-rose-600 text-sm sm:text-base">
                    {formatTWD(t.amount)}
                  </span>
                  <div className="flex items-center text-slate-400 text-xs mt-0.5">
                    <span className="text-[10px] mr-1">轉給</span>
                    <ArrowRight size={14} className="text-rose-500" />
                  </div>
                </div>

                {/* 收款方 */}
                <div className="flex items-center gap-2.5 min-w-0 text-right justify-end">
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 block">收款人</span>
                    <span className="font-bold text-slate-800 text-sm truncate block">
                      {t.toName}
                    </span>
                  </div>
                  <MemberAvatar member={members.find(m => m.id === t.toId) || { name: t.toName }} size="md" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 個人收支明細卡片 */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
          📊 每位旅伴收支明細
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memberBalances.map((b) => {
            const isCreditor = b.netTwd > 0;
            const isDebtor = b.netTwd < 0;

            return (
              <div
                key={b.member.id}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar member={b.member} size="sm" />
                    <span className="font-bold text-slate-800 text-sm">{b.member.name}</span>
                  </div>

                  {/* 狀態標籤 */}
                  {isCreditor ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                      <TrendingUp size={12} />
                      應收 {formatTWD(b.netTwd)}
                    </span>
                  ) : isDebtor ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                      <TrendingDown size={12} />
                      應付 {formatTWD(Math.abs(b.netTwd))}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
                      已結平
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 text-slate-500">
                  <div>
                    <span>代付總額：</span>
                    <div className="font-semibold text-slate-800">{formatTWD(b.paidTwd)}</div>
                  </div>
                  <div>
                    <span>應攤總額：</span>
                    <div className="font-semibold text-slate-800">{formatTWD(b.shareTwd)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LINE 結算訊息預覽切換 */}
      <div className="bg-slate-100/70 rounded-2xl p-4 border border-slate-200 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-600">LINE 群組發布文字預覽</span>
          <button
            onClick={() => setShowRawLineText(s => !s)}
            className="text-rose-600 hover:text-rose-700 font-medium"
          >
            {showRawLineText ? '隱藏預覽' : '展開檢視'}
          </button>
        </div>

        {showRawLineText && (
          <pre className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed animate-in fade-in">
            {generateLineSettlementText(tripTitle, members, expenses)}
          </pre>
        )}
      </div>
    </div>
  );
}
