import React, { useState } from 'react';
import { 
  ArrowUpDown, RefreshCw, PlusCircle, Check, Percent, 
  Sparkles, DollarSign, Calculator as CalcIcon 
} from 'lucide-react';
import { formatTWD, formatJPY } from '../utils/currency';
import { MemberAvatar } from './MemberAvatar';

export function QuickFxCalculator({
  currentRate,
  rateSource,
  refreshRate,
  onAddExpenseWithAmount,
  members = []
}) {
  // 換算方向：'JPY_TO_TWD' 或 'TWD_TO_JPY'
  const [direction, setDirection] = useState('JPY_TO_TWD');
  // 匯率模式：'live' (即時), 'custom' (自訂), 'direct_twd' (直接台幣不轉)
  const [rateMode, setRateMode] = useState('live');
  const [customRate, setCustomRate] = useState(currentRate.toString());
  const [inputAmount, setInputAmount] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [taxNotice, setTaxNotice] = useState('');
  const [splitOption, setSplitOption] = useState('all'); // 'all', 'custom_amounts'

  // 取得有效計算匯率
  const activeRate = rateMode === 'direct_twd'
    ? 1.0
    : (rateMode === 'custom' ? (parseFloat(customRate) || currentRate) : currentRate);

  const num = parseFloat(inputAmount) || 0;

  // 計算結果
  let convertedAmount = 0;
  if (rateMode === 'direct_twd') {
    convertedAmount = num;
  } else if (direction === 'JPY_TO_TWD') {
    convertedAmount = Math.round(num * activeRate);
  } else {
    convertedAmount = activeRate > 0 ? Math.round(num / activeRate) : 0;
  }

  // 快捷金額按鈕
  const presets = direction === 'JPY_TO_TWD'
    ? [500, 1000, 3000, 5500, 10000, 30000]
    : [100, 500, 1000, 3000, 5000, 10000];

  // 日本消費稅計算
  const applyTax = (taxPercent, label) => {
    if (num <= 0) return;
    const withTax = Math.round(num * (1 + taxPercent / 100));
    setInputAmount(withTax.toString());
    setTaxNotice(`已套用 ${label} (+${taxPercent}%)`);
    setTimeout(() => setTaxNotice(''), 3000);
  };

  const applyTaxFree = () => {
    if (num <= 0) return;
    // 日本退稅公式：含稅價 / 1.10
    const taxFree = Math.round(num / 1.10);
    setInputAmount(taxFree.toString());
    setTaxNotice(`已套用免稅試算 (扣除 10% 消費稅)`);
    setTimeout(() => setTaxNotice(''), 3000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshRate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-24 animate-in fade-in">
      {/* 頂部匯率模式選擇卡片 */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <CalcIcon className="text-rose-500" size={20} />
            匯率轉換設定
          </h3>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 p-1"
            title="刷新最新即時匯率"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-rose-500' : ''} />
            <span>更新匯率</span>
          </button>
        </div>

        {/* 三種模式分頁按鈕 */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setRateMode('live')}
            className={`py-2 rounded-xl transition-all ${
              rateMode === 'live'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            當下即時匯率
          </button>
          <button
            onClick={() => setRateMode('custom')}
            className={`py-2 rounded-xl transition-all ${
              rateMode === 'custom'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            自訂輸入匯率
          </button>
          <button
            onClick={() => setRateMode('direct_twd')}
            className={`py-2 rounded-xl transition-all ${
              rateMode === 'direct_twd'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            直接台幣計價
          </button>
        </div>

        {/* 模式詳細說明與自訂欄位 */}
        <div className="pt-1 text-xs">
          {rateMode === 'live' && (
            <div className="flex items-center justify-between text-slate-500 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
              <span>現行即時匯率基準：</span>
              <span className="font-bold text-rose-600 text-sm">
                1 JPY = NT$ {currentRate.toFixed(4)}
              </span>
            </div>
          )}

          {rateMode === 'custom' && (
            <div className="flex items-center justify-between gap-3 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
              <span className="text-slate-700 font-medium">1 JPY 換算台幣：</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">NT$</span>
                <input
                  type="number"
                  step="0.0001"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-24 px-2 py-1 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {rateMode === 'direct_twd' && (
            <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100 text-blue-800">
              💡 <strong>直接台幣模式</strong>：不進行任何匯率換算（1:1），適用於行前已刷卡扣款的機票、JR Pass 或行程套票。
            </div>
          )}
        </div>
      </div>

      {/* 雙向計算轉換主卡片 */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-4">
        {/* 輸入區塊 */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
            <span>
              {direction === 'JPY_TO_TWD' ? '🇯🇵 日圓金額 (JPY)' : '🇹🇼 新台幣金額 (TWD)'}
            </span>
            {rateMode !== 'direct_twd' && (
              <button
                onClick={() => setDirection(d => d === 'JPY_TO_TWD' ? 'TWD_TO_JPY' : 'JPY_TO_TWD')}
                className="flex items-center gap-1 text-rose-600 hover:text-rose-700 active:scale-95 transition-transform"
              >
                <ArrowUpDown size={14} />
                <span>切換換算方向</span>
              </button>
            )}
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
              {direction === 'JPY_TO_TWD' ? '¥' : 'NT$'}
            </span>
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0"
              autoFocus
              className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-3xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {taxNotice && (
            <p className="text-xs text-rose-600 font-medium mt-1 animate-in fade-in">
              ✨ {taxNotice}
            </p>
          )}
        </div>

        {/* 日本消費稅試算按鈕 (僅在日幣轉台幣時顯示) */}
        {direction === 'JPY_TO_TWD' && rateMode !== 'direct_twd' && (
          <div className="pt-1">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
              <Percent size={12} />
              <span>日本消費稅試算快捷鍵</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => applyTax(10, '10% 內用稅')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                title="日本內用、一般商品標準消費稅 10%"
              >
                +10% 內用稅
              </button>
              <button
                onClick={() => applyTax(8, '8% 輕減稅')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                title="超商飲料便當、外帶食品輕減稅率 8%"
              >
                +8% 外帶稅
              </button>
              <button
                onClick={applyTaxFree}
                className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-xl transition-colors"
                title="滿 5,000 日圓退稅試算 (扣除 10% 稅)"
              >
                免稅退稅試算
              </button>
            </div>
          </div>
        )}

        {/* 快捷金額晶片 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
            快速填入金額：
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {presets.map(p => (
              <button
                key={p}
                onClick={() => setInputAmount(p.toString())}
                className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl whitespace-nowrap font-medium transition-colors"
              >
                {direction === 'JPY_TO_TWD' ? `¥${p.toLocaleString()}` : `NT$ ${p.toLocaleString()}`}
              </button>
            ))}
          </div>
        </div>

        {/* 結果展示大區塊 */}
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200/80 rounded-2xl p-5 text-center space-y-1">
          <div className="text-xs font-semibold text-rose-600">
            {rateMode === 'direct_twd'
              ? '台幣金額'
              : (direction === 'JPY_TO_TWD' ? '折合新台幣約' : '折合日圓約')}
          </div>
          <div className="text-4xl font-black text-rose-700 tracking-tight">
            {rateMode === 'direct_twd'
              ? formatTWD(convertedAmount)
              : (direction === 'JPY_TO_TWD' ? formatTWD(convertedAmount) : formatJPY(convertedAmount))}
          </div>
          <div className="text-[11px] text-slate-400">
            {rateMode === 'direct_twd'
              ? '（免換算模式）'
              : `（依照匯率 1 JPY = NT$ ${activeRate.toFixed(4)} 計算）`}
          </div>
        </div>

        {/* 帶入分帳分攤方式選擇 */}
        {num > 0 && onAddExpenseWithAmount && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>分帳方式：</span>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => setSplitOption('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    splitOption === 'all'
                      ? 'bg-white text-rose-600 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  👥 全員均攤
                </button>
                <button
                  type="button"
                  onClick={() => setSplitOption('custom_amounts')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    splitOption === 'custom_amounts'
                      ? 'bg-white text-rose-600 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  💰 自訂各自分攤金額
                </button>
              </div>
            </div>

            {splitOption === 'custom_amounts' && (
              <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl text-xs text-rose-800">
                💡 點擊下方「將此金額帶入分帳記帳」後，即可直接在記帳視窗內為每位成員輸入分攤金額（例如 110 元中 A 負擔 50 元、B 負擔 60 元）。
              </div>
            )}
          </div>
        )}

        {/* 帶入分帳按鈕 */}
        {num > 0 && onAddExpenseWithAmount && (
          <button
            onClick={() => onAddExpenseWithAmount({
              amount: num,
              currency: direction === 'JPY_TO_TWD' ? 'JPY' : 'TWD',
              rate: activeRate,
              splitMode: splitOption,
              splitMemberIds: members.map(m => m.id),
              note: ''
            })}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-rose-200 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <PlusCircle size={18} />
            <span>將此金額帶入分帳記帳</span>
          </button>
        )}
      </div>
    </div>
  );
}
