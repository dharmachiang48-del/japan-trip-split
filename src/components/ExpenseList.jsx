import React, { useState } from 'react';
import { 
  Plus, Search, Utensils, Train, Ticket, ShoppingBag, Hotel, 
  MoreHorizontal, Trash2, Edit3, Users, DollarSign, Calendar
} from 'lucide-react';
import { formatTWD, formatJPY, convertToTwd } from '../utils/currency';
import { CATEGORIES } from '../data/defaultData';
import { MemberAvatar } from './MemberAvatar';

const ICON_MAP = {
  Utensils,
  Train,
  Ticket,
  ShoppingBag,
  Hotel,
  MoreHorizontal
};

export function ExpenseList({
  expenses,
  members,
  onAddExpense,
  onEditExpense,
  onDeleteExpense
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 取得成員資料對應表
  const memberMap = new Map(members.map(m => [m.id, m]));

  // 篩選支出項目
  const filteredExpenses = expenses.filter(exp => {
    const matchCategory = selectedCategory === 'all' || exp.category === selectedCategory;
    const matchSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (exp.note && exp.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  // 計算統計
  let totalTwd = 0;
  let totalJpy = 0;
  expenses.forEach(exp => {
    totalTwd += convertToTwd(exp.amount, exp.currency, exp.rate);
    if (exp.currency === 'JPY') {
      totalJpy += exp.amount;
    }
  });

  return (
    <div className="space-y-4 pb-24">
      {/* 旅程支出統計摘要卡片 */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>🇯🇵 日本旅程總開銷</span>
            <span>共 {expenses.length} 筆明細</span>
          </div>

          <div className="text-3xl font-bold tracking-tight text-white mb-2">
            {formatTWD(totalTwd)}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-2 border-t border-slate-700/60">
            <div>
              日幣總計：<span className="font-semibold text-rose-300">{formatJPY(totalJpy)}</span>
            </div>
            <span>•</span>
            <div>
              平均每人：<span className="font-semibold text-emerald-300">{formatTWD(members.length > 0 ? totalTwd / members.length : 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 搜尋與分類膠囊 */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋支出項目或備註..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-sm"
          />
        </div>

        {/* 分類橫向捲動條 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all font-medium ${
              selectedCategory === 'all'
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            全部 ({expenses.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = expenses.filter(e => e.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.name} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* 支出明細列表 */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 p-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <Utensils size={24} />
          </div>
          <p className="text-slate-600 font-medium">尚無相關支出記錄</p>
          <p className="text-xs text-slate-400 mt-1">點擊下方按鈕新增一筆日幣或台幣消費吧！</p>
          <button
            onClick={onAddExpense}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-rose-200"
          >
            <Plus size={16} />
            新增第一筆支出
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map(exp => {
            const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[5];
            const IconComponent = ICON_MAP[cat.icon] || MoreHorizontal;
            const payer = memberMap.get(exp.payerId) || { name: '未知成員', avatarColor: '#94a3b8' };
            const splitMembers = (exp.splitMemberIds || []).map(id => memberMap.get(id)).filter(Boolean);
            const twdAmount = convertToTwd(exp.amount, exp.currency, exp.rate);

            return (
              <div
                key={exp.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col gap-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${cat.color}`}>
                      <IconComponent size={20} />
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-800 text-sm sm:text-base truncate">
                        {exp.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {exp.date}
                        </span>
                        <span>•</span>
                        <span>{cat.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* 金額顯示 */}
                  <div className="text-right shrink-0">
                    {exp.currency === 'JPY' ? (
                      <div>
                        <div className="font-bold text-slate-900 text-base sm:text-lg">
                          {formatJPY(exp.amount)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          折合 <span className="font-semibold text-rose-600">{formatTWD(twdAmount)}</span>
                          <span className="text-[10px] text-slate-400 ml-1">(@{exp.rate})</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 text-base sm:text-lg">
                          {formatTWD(exp.amount)}
                        </div>
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                          台幣直扣
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {exp.note && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">
                    💬 {exp.note}
                  </p>
                )}

                {/* 底部：代墊人與分攤成員 */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">代墊：</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] border border-slate-200 shadow-2xs">
                        <MemberAvatar member={payer} size="xs" />
                        {payer.name}
                      </span>
                    </div>

                    <span className="text-slate-300">|</span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400">負擔：</span>
                      {exp.splitAmounts && Object.keys(exp.splitAmounts).length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] border border-rose-200">
                            自訂金額
                          </span>
                          {Object.entries(exp.splitAmounts).map(([mId, amt]) => {
                            const m = memberMap.get(mId);
                            const numAmt = Number(amt) || 0;
                            if (numAmt <= 0) return null;
                            return (
                              <span
                                key={mId}
                                className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md text-[11px] font-medium border border-slate-200"
                              >
                                <MemberAvatar member={m} size="xs" />
                                <span>{m?.name || '成員'}: {exp.currency === 'JPY' ? '¥' : 'NT$'}{numAmt.toLocaleString()}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : splitMembers.length === 1 ? (
                        splitMembers[0]?.id === exp.payerId ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 shadow-2xs">
                            <MemberAvatar member={splitMembers[0]} size="xs" />
                            <span>個人自付</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-[11px] border border-rose-200 shadow-2xs">
                            <MemberAvatar member={splitMembers[0]} size="xs" />
                            <span>由 {splitMembers[0]?.name} 全額負擔</span>
                          </span>
                        )
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-slate-700">
                            {splitMembers.length === members.length ? '全員平分' : `${splitMembers.length} 人分攤`}
                          </span>
                          <div className="flex -space-x-1.5 overflow-hidden ml-1">
                            {splitMembers.map(m => (
                              <MemberAvatar
                                key={m.id}
                                member={m}
                                size="xs"
                                className="ring-1 ring-white"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作按鈕 */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditExpense(exp)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="編輯"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="刪除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (新增支出) */}
      <button
        onClick={onAddExpense}
        className="fixed bottom-20 right-5 z-20 w-14 h-14 bg-gradient-to-tr from-rose-500 to-rose-600 text-white rounded-full shadow-lg shadow-rose-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all md:bottom-8 md:right-8"
        title="新增支出"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
