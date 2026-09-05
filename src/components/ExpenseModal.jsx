import React, { useState, useEffect } from 'react';
import { X, Check, Utensils, Train, Ticket, ShoppingBag, Hotel, MoreHorizontal, DollarSign } from 'lucide-react';
import { CATEGORIES } from '../data/defaultData';
import { convertToTwd, formatTWD } from '../utils/currency';
import { MemberAvatar } from './MemberAvatar';

const ICON_MAP = {
  Utensils,
  Train,
  Ticket,
  ShoppingBag,
  Hotel,
  MoreHorizontal
};

export function ExpenseModal({
  isOpen,
  onClose,
  onSave,
  editingExpense,
  members,
  currentDefaultRate
}) {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [rateMode, setRateMode] = useState('default'); // 'default', 'custom'
  const [customRate, setCustomRate] = useState(currentDefaultRate.toString());
  const [category, setCategory] = useState('food');
  const [payerId, setPayerId] = useState(members[0]?.id || '');
  const [splitMode, setSplitMode] = useState('all'); // 'all': 全員均攤, 'custom_amounts': 自訂各自分攤金額
  const [splitAmounts, setSplitAmounts] = useState({}); // { [memberId]: string }
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (editingExpense) {
      setTitle(editingExpense.title || '');
      setAmount(editingExpense.amount ? editingExpense.amount.toString() : '');
      setCurrency(editingExpense.currency || 'JPY');
      if (editingExpense.rate && editingExpense.rate !== currentDefaultRate) {
        setRateMode('custom');
        setCustomRate(editingExpense.rate.toString());
      } else {
        setRateMode('default');
        setCustomRate(currentDefaultRate.toString());
      }
      setCategory(editingExpense.category || 'food');
      const pId = editingExpense.payerId || members[0]?.id || '';
      setPayerId(pId);

      if (editingExpense.splitAmounts && Object.keys(editingExpense.splitAmounts).length > 0) {
        setSplitMode('custom_amounts');
        const amountsMap = {};
        Object.entries(editingExpense.splitAmounts).forEach(([k, v]) => {
          amountsMap[k] = v.toString();
        });
        setSplitAmounts(amountsMap);
      } else if (editingExpense.splitMode === 'custom_amounts') {
        setSplitMode('custom_amounts');
        setSplitAmounts({});
      } else {
        setSplitMode('all');
        setSplitAmounts({});
      }

      setDate(editingExpense.date || new Date().toISOString().split('T')[0]);
      setNote(editingExpense.note || '');
    } else {
      // 預設新增狀態
      setTitle('');
      setAmount('');
      setCurrency('JPY');
      setRateMode('default');
      setCustomRate(currentDefaultRate.toString());
      setCategory('food');
      setPayerId(members[0]?.id || '');
      setSplitMode('all');
      setSplitAmounts({});
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
    }
  }, [editingExpense, isOpen, members, currentDefaultRate]);

  const activeRate = currency === 'TWD' 
    ? 1.0 
    : (rateMode === 'custom' ? (parseFloat(customRate) || currentDefaultRate) : currentDefaultRate);

  const numAmount = parseFloat(amount) || 0;
  const estimatedTwd = convertToTwd(numAmount, currency, activeRate);
  const perPersonTwd = members.length > 0 ? Math.round(estimatedTwd / members.length) : 0;

  // 自訂金額加總與剩餘差額計算
  const totalAllocated = members.reduce((sum, m) => {
    const val = parseFloat(splitAmounts[m.id]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const remainingDiff = Math.round((numAmount - totalAllocated) * 100) / 100;

  // 自訂金額輸入變更
  const handleAmountChangeForMember = (mId, val) => {
    setSplitAmounts(prev => ({
      ...prev,
      [mId]: val
    }));
  };

  // 快捷：平均預填
  const handleAutoDistributeAmounts = () => {
    if (numAmount <= 0 || members.length === 0) return;
    const isJpy = currency === 'JPY';
    const base = isJpy ? Math.floor(numAmount / members.length) : Math.floor((numAmount / members.length) * 100) / 100;
    const newMap = {};
    let runningSum = 0;
    members.forEach((m, idx) => {
      if (idx === members.length - 1) {
        const lastVal = isJpy ? (numAmount - runningSum) : Math.round((numAmount - runningSum) * 100) / 100;
        newMap[m.id] = lastVal.toString();
      } else {
        newMap[m.id] = base.toString();
        runningSum += base;
      }
    });
    setSplitAmounts(newMap);
  };

  // 快捷：將剩餘金額補入指定成員
  const handleFillRemainingToMember = (mId) => {
    if (remainingDiff <= 0) return;
    const cur = parseFloat(splitAmounts[mId]) || 0;
    const updated = Math.round((cur + remainingDiff) * 100) / 100;
    setSplitAmounts(prev => ({
      ...prev,
      [mId]: updated.toString()
    }));
  };

  // 快捷：清空自訂分攤金額
  const handleClearSplitAmounts = () => {
    setSplitAmounts({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || numAmount <= 0) {
      alert('請輸入支出項目名稱與正確金額');
      return;
    }

    let finalSplitAmounts = null;
    let finalSplitMemberIds = members.map(m => m.id);

    if (splitMode === 'custom_amounts') {
      if (Math.abs(numAmount - totalAllocated) > 0.01) {
        alert(`各成員分攤金額總和 (${totalAllocated}) 必須等於總消費金額 (${numAmount})！\n目前差額：${(numAmount - totalAllocated).toFixed(2)}`);
        return;
      }

      finalSplitAmounts = {};
      finalSplitMemberIds = [];
      members.forEach(m => {
        const val = parseFloat(splitAmounts[m.id]);
        if (!isNaN(val) && val > 0) {
          finalSplitAmounts[m.id] = val;
          finalSplitMemberIds.push(m.id);
        }
      });

      if (finalSplitMemberIds.length === 0) {
        alert('請至少為一位成員設定分攤金額');
        return;
      }
    }

    const payload = {
      id: editingExpense ? editingExpense.id : `exp_${Date.now()}`,
      title: title.trim(),
      amount: numAmount,
      currency,
      rate: activeRate,
      category,
      payerId,
      splitMemberIds: finalSplitMemberIds,
      splitAmounts: finalSplitAmounts,
      splitMode,
      date,
      note: note.trim()
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg">
            {editingExpense ? '編輯支出紀錄' : '記一筆日本旅遊支出'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 支出名稱 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              項目名稱 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例：敘敘苑燒肉、西瓜卡加值、HARBS 蛋糕"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              required
            />
          </div>

          {/* 金額與幣別切換 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">
                消費金額 <span className="text-rose-500">*</span>
              </label>
              
              {/* 幣別切換按鈕 */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCurrency('JPY')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    currency === 'JPY'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ¥ 日幣 (JPY)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('TWD')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    currency === 'TWD'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  NT$ 台幣 (TWD)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">
                {currency === 'JPY' ? '¥' : 'NT$'}
              </span>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
            </div>

            {/* 匯率折合即時預覽 */}
            {currency === 'JPY' && (
              <div className="mt-2 p-3 bg-rose-50/60 border border-rose-100 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">匯率設定：</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={rateMode === 'default'}
                        onChange={() => setRateMode('default')}
                        className="text-rose-500 focus:ring-0"
                      />
                      <span className="text-slate-700">即時匯率 ({currentDefaultRate})</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={rateMode === 'custom'}
                        onChange={() => setRateMode('custom')}
                        className="text-rose-500 focus:ring-0"
                      />
                      <span className="text-slate-700">自訂匯率</span>
                    </label>
                  </div>
                </div>

                {rateMode === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500">1 JPY =</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    />
                    <span className="text-xs text-slate-500">TWD</span>
                  </div>
                )}

                <div className="text-xs font-medium text-rose-700 pt-1 border-t border-rose-100 flex items-center justify-between">
                  <span>折合新台幣約：</span>
                  <span className="text-sm font-bold">{formatTWD(estimatedTwd)}</span>
                </div>
              </div>
            )}

            {currency === 'TWD' && (
              <div className="mt-1.5 text-xs text-blue-600 font-medium flex items-center gap-1">
                <span>💡 行前刷卡預定或免換算項目，直接以台幣計入分帳結算。</span>
              </div>
            )}
          </div>

          {/* 分類選擇 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              消費分類
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CATEGORIES.map(cat => {
                const IconComponent = ICON_MAP[cat.icon] || MoreHorizontal;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <IconComponent size={18} />
                    <span className="text-[11px] mt-1 font-medium">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 代墊付款人 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              誰先代墊付款？
            </label>
            <div className="flex gap-2 flex-wrap">
              {members.map(m => {
                 const isSelected = payerId === m.id;
                 return (
                   <button
                     key={m.id}
                     type="button"
                     onClick={() => setPayerId(m.id)}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all text-xs font-semibold ${
                       isSelected
                         ? 'border-slate-900 bg-slate-800 text-white shadow-sm'
                         : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                     }`}
                   >
                     <MemberAvatar member={m} size="xs" />
                     {m.name}
                   </button>
                 );
               })}
            </div>
          </div>

          {/* 分攤成員區域 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">
                這筆錢由誰負擔？
              </label>
            </div>

            {/* 兩種分攤模式切換按鈕 */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-semibold mb-3">
              <button
                type="button"
                onClick={() => setSplitMode('all')}
                className={`py-2 rounded-xl transition-all ${
                  splitMode === 'all'
                    ? 'bg-white text-rose-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👥 全員均攤
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('custom_amounts')}
                className={`py-2 rounded-xl transition-all ${
                  splitMode === 'custom_amounts'
                    ? 'bg-white text-rose-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💰 自訂各自分攤金額
              </button>
            </div>

            {/* 1. 全員均攤模式 */}
            {splitMode === 'all' && (
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">分攤成員：全員共 {members.length} 人</span>
                  <span className="text-rose-600 font-bold">每人平分</span>
                </div>
                <div className="flex -space-x-1.5 overflow-hidden py-1">
                  {members.map(m => (
                    <MemberAvatar key={m.id} member={m} size="sm" className="ring-2 ring-white" />
                  ))}
                </div>
                {numAmount > 0 && (
                  <div className="text-xs text-slate-600 text-right pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">每人平均分攤：</span>
                    <span className="font-bold text-slate-800">
                      {currency === 'JPY' ? `¥${Math.round(numAmount / (members.length || 1)).toLocaleString()}` : formatTWD(Math.round(numAmount / (members.length || 1)))}
                      {currency === 'JPY' && (
                        <span className="text-rose-600 ml-1.5 text-[11px]">
                          (約 {formatTWD(perPersonTwd)})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 2. 自訂各自分攤金額模式 */}
            {splitMode === 'custom_amounts' && (
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
                {/* 狀態提示與差額統計 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">
                      請設定每位成員應負擔的金額：
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAutoDistributeAmounts}
                        className="text-[11px] px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium transition-colors"
                        title="將總金額平均分配作為填寫基準"
                      >
                        一鍵平分
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSplitAmounts}
                        className="text-[11px] px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-lg font-medium transition-colors"
                      >
                        清空
                      </button>
                    </div>
                  </div>

                  {numAmount > 0 && (
                    <div>
                      {Math.abs(remainingDiff) < 0.01 ? (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
                          <span>✅ 金額剛好分配完畢！</span>
                          <span>加總 {currency === 'JPY' ? '¥' : 'NT$'}{totalAllocated.toLocaleString()}</span>
                        </div>
                      ) : remainingDiff > 0 ? (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-center justify-between">
                          <span>⚠️ 尚有未分配金額：<strong className="text-amber-700 font-bold">{currency === 'JPY' ? '¥' : 'NT$'}{remainingDiff.toLocaleString()}</strong></span>
                          <span className="text-[11px] text-amber-600">已分配 {totalAllocated.toLocaleString()} / 總額 {numAmount.toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center justify-between">
                          <span>❌ 超出總金額：<strong className="text-rose-700 font-bold">{currency === 'JPY' ? '¥' : 'NT$'}{Math.abs(remainingDiff).toLocaleString()}</strong></span>
                          <span className="text-[11px] text-rose-600">目前加總 {totalAllocated.toLocaleString()}，請縮減</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 各成員輸入列表 */}
                <div className="space-y-2">
                  {members.map(m => {
                    const memberVal = splitAmounts[m.id] ?? '';
                    const numVal = parseFloat(memberVal) || 0;
                    const memberTwd = currency === 'JPY' ? Math.round(numVal * activeRate) : numVal;

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MemberAvatar member={m} size="xs" />
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {m.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 剩餘金額快速填入按鈕 */}
                          {remainingDiff > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFillRemainingToMember(m.id)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-colors"
                              title={`將剩餘的 ${remainingDiff} 補入 ${m.name} 的分攤額`}
                            >
                              +補入剩餘 ({remainingDiff})
                            </button>
                          )}

                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs font-bold text-slate-400 pointer-events-none">
                              {currency === 'JPY' ? '¥' : 'NT$'}
                            </span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={memberVal}
                              onChange={(e) => handleAmountChangeForMember(m.id, e.target.value)}
                              placeholder="0"
                              className="w-24 pl-7 pr-2 py-1 text-right text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                            />
                          </div>

                          {currency === 'JPY' && numVal > 0 && (
                            <span className="text-[10px] text-slate-400 w-16 text-right truncate">
                              ≈ NT${memberTwd}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 日期與備註 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                消費日期
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                備註說明
              </label>
              <input
                type="text"
                placeholder="選填，如：加點啤酒、退稅"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-200 transition-all active:scale-95"
          >
            {editingExpense ? '儲存修改' : '加入分帳紀錄'}
          </button>
        </div>
      </div>
    </div>
  );
}
