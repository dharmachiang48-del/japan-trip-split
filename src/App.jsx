import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseModal } from './components/ExpenseModal';
import { QuickFxCalculator } from './components/QuickFxCalculator';
import { SettlementView } from './components/SettlementView';
import { PhotoVaultView } from './components/PhotoVault/PhotoVaultView';
import { OcrScannerModal } from './components/OcrScannerModal';
import { MemberManagerModal } from './components/MemberManagerModal';
import { AiChatDrawer } from './components/AiAssistant/AiChatDrawer';
import { AiKeyModal } from './components/AiAssistant/AiKeyModal';
import { RoomShareModal } from './components/RoomShareModal';
import { fetchLiveJpyTwdRate, DEFAULT_JPY_TO_TWD_RATE } from './utils/currency';
import { DEFAULT_MEMBERS, INITIAL_EXPENSES } from './data/defaultData';
import { getGeminiApiKey } from './utils/gemini';
import { realtimeSync } from './utils/realtimeSync';

const STORAGE_KEY_TRIP_TITLE = 'japan_trip_title';
const STORAGE_KEY_MEMBERS = 'japan_trip_members';
const STORAGE_KEY_EXPENSES = 'japan_trip_expenses';
const STORAGE_KEY_ROOM_ID = 'japan_trip_room_id';

export default function App() {
  // 1. 房間與即時同步狀態
  const [roomId, setRoomId] = useState(() => {
    const urlParam = new URLSearchParams(window.location.search).get('room');
    if (urlParam) return urlParam.trim().toUpperCase();
    return localStorage.getItem(STORAGE_KEY_ROOM_ID) || 'TOKYO-2026';
  });

  const [syncStatus, setSyncStatus] = useState('connecting'); // 'connected', 'connecting', 'disconnected'
  const [onlineCount, setOnlineCount] = useState(1);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // 2. 旅程資料狀態
  const [tripTitle, setTripTitle] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_TRIP_TITLE) || '2026 日本東京自由行 🎌';
  });

  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
    return saved ? JSON.parse(saved) : DEFAULT_MEMBERS;
  });

  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_EXPENSES);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  // 3. 匯率狀態
  const [currentRate, setCurrentRate] = useState(DEFAULT_JPY_TO_TWD_RATE);
  const [rateSource, setRateSource] = useState('載入中...');

  // 4. 導覽分頁
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'calculator', 'photos', 'settlement'

  // 5. 各類彈窗控制
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [activeAiPhoto, setActiveAiPhoto] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // 儲存至本地快取
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ROOM_ID, roomId);
  }, [roomId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TRIP_TITLE, tripTitle);
  }, [tripTitle]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

  // 初始化匯率與 API Key 狀態
  useEffect(() => {
    updateLiveRate();
    setHasApiKey(Boolean(getGeminiApiKey()));
  }, []);

  const updateLiveRate = async () => {
    const data = await fetchLiveJpyTwdRate();
    setCurrentRate(data.rate);
    setRateSource(data.source);
  };

  // 即時協作 WebSocket 連線與監聽
  useEffect(() => {
    realtimeSync.connect(roomId);

    // 監聽連線狀態
    const unStatus = realtimeSync.on('status_change', ({ status, onlineCount: count }) => {
      setSyncStatus(status);
      if (count !== undefined) setOnlineCount(count);
    });

    const unOnline = realtimeSync.on('online_count', (count) => {
      setOnlineCount(count);
    });

    // 監聽伺服器初始化房間資料
    const unInit = realtimeSync.on('init_state', (serverData) => {
      if (serverData) {
        if (serverData.tripTitle) setTripTitle(serverData.tripTitle);
        if (serverData.members && serverData.members.length > 0) setMembers(serverData.members);
        if (serverData.expenses && serverData.expenses.length > 0) setExpenses(serverData.expenses);
        // 若伺服器為空，將本機預設資料上傳至伺服器
        if ((!serverData.expenses || serverData.expenses.length === 0) && expenses.length > 0) {
          realtimeSync.broadcastFullState({
            tripTitle,
            members,
            expenses
          });
        }
      }
    });

    // 監聽其他旅伴即時新增支出
    const unAddExp = realtimeSync.on('expense_added', (newExp) => {
      setExpenses(prev => {
        if (prev.some(e => e.id === newExp.id)) return prev;
        return [newExp, ...prev];
      });
    });

    // 監聽其他旅伴修改支出
    const unUpdateExp = realtimeSync.on('expense_updated', (updated) => {
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
    });

    // 監聽其他旅伴刪除支出
    const unDeleteExp = realtimeSync.on('expense_deleted', (expId) => {
      setExpenses(prev => prev.filter(e => e.id !== expId));
    });

    // 監聽其他旅伴更新成員
    const unMembers = realtimeSync.on('members_updated', (newMembers) => {
      setMembers(newMembers);
    });

    return () => {
      unStatus();
      unOnline();
      unInit();
      unAddExp();
      unUpdateExp();
      unDeleteExp();
      unMembers();
    };
  }, [roomId]);

  // 切換房間
  const handleSwitchRoom = (newRoomId) => {
    setRoomId(newRoomId);
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoomId);
    window.history.pushState({}, '', url.toString());
    realtimeSync.connect(newRoomId);
  };

  // 支出增刪改查（附帶即時廣播）
  const handleSaveExpense = (newExp) => {
    if (editingExpense) {
      setExpenses(prev => prev.map(e => e.id === newExp.id ? newExp : e));
      realtimeSync.broadcastExpenseUpdated(newExp);
    } else {
      setExpenses(prev => [newExp, ...prev]);
      realtimeSync.broadcastExpenseAdded(newExp);
    }
  };

  const handleDeleteExpense = (id) => {
    if (confirm('確定要刪除這筆支出嗎？所有同房間的旅伴也會同步刪除。')) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      realtimeSync.broadcastExpenseDeleted(id);
    }
  };

  const handleEditExpense = (exp) => {
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleUpdateMembers = (newMembers) => {
    setMembers(newMembers);
    realtimeSync.broadcastMembersUpdated(newMembers);
  };

  // 從匯率計算器或 OCR 帶入金額
  const handleAddExpenseWithAmount = ({ amount, currency, rate, note, splitMemberIds, splitMode, payerId }) => {
    setEditingExpense({
      title: note || (currency === 'JPY' ? '日本消費' : '旅費支出'),
      amount,
      currency: currency || 'JPY',
      rate: rate || currentRate,
      category: 'food',
      payerId: payerId || members[0]?.id || '',
      splitMemberIds: splitMemberIds || members.map(m => m.id),
      splitMode: splitMode || 'all',
      date: new Date().toISOString().split('T')[0],
      note: note || ''
    });
    setIsExpenseModalOpen(true);
  };

  // 從照片開啟 AI 助手
  const handleOpenAiChatWithPhoto = (photo) => {
    setActiveAiPhoto(photo);
    setIsAiChatOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      {/* 頂部導覽列 (含即時連線狀態與在線人數) */}
      <Header
        tripTitle={tripTitle}
        setTripTitle={(title) => {
          setTripTitle(title);
          realtimeSync.broadcastFullState({ tripTitle: title, members, expenses });
        }}
        currentRate={currentRate}
        rateSource={rateSource}
        refreshRate={updateLiveRate}
        onOpenOcr={() => setIsOcrModalOpen(true)}
        onOpenMembers={() => setIsMemberModalOpen(true)}
        onOpenAiKey={() => setIsAiKeyModalOpen(true)}
        hasApiKey={hasApiKey}
        roomId={roomId}
        syncStatus={syncStatus}
        onlineCount={onlineCount}
        onOpenRoomShare={() => setIsRoomModalOpen(true)}
      />

      {/* 主內容區塊 */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
        {activeTab === 'expenses' && (
          <ExpenseList
            expenses={expenses}
            members={members}
            onAddExpense={handleOpenAddExpense}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === 'calculator' && (
          <QuickFxCalculator
            currentRate={currentRate}
            rateSource={rateSource}
            refreshRate={updateLiveRate}
            onAddExpenseWithAmount={handleAddExpenseWithAmount}
            members={members}
          />
        )}

        {activeTab === 'photos' && (
          <PhotoVaultView
            onOpenAiChatWithPhoto={handleOpenAiChatWithPhoto}
          />
        )}

        {activeTab === 'settlement' && (
          <SettlementView
            tripTitle={tripTitle}
            members={members}
            expenses={expenses}
          />
        )}
      </main>

      {/* 底部導覽列 */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 新增 / 編輯支出彈窗 */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpense}
        editingExpense={editingExpense}
        members={members}
        currentDefaultRate={currentRate}
      />

      {/* 拍照辨識價格與自動換匯彈窗 */}
      <OcrScannerModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        currentRate={currentRate}
        onSelectPriceForExpense={handleAddExpenseWithAmount}
        onAskAiWithPhoto={handleOpenAiChatWithPhoto}
      />

      {/* 成員管理彈窗 */}
      <MemberManagerModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        members={members}
        onUpdateMembers={handleUpdateMembers}
        expenses={expenses}
      />

      {/* 旅程房間分享與掃碼連線彈窗 */}
      <RoomShareModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        roomId={roomId}
        onSwitchRoom={handleSwitchRoom}
        syncStatus={syncStatus}
        onlineCount={onlineCount}
      />

      {/* 照片專屬 AI 視覺問答助手抽屜視窗 */}
      <AiChatDrawer
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        activePhoto={activeAiPhoto}
        onOpenKeyModal={() => setIsAiKeyModalOpen(true)}
      />

      {/* Gemini API Key 設定彈窗 */}
      <AiKeyModal
        isOpen={isAiKeyModalOpen}
        onClose={() => setIsAiKeyModalOpen(false)}
        onKeySaved={() => setHasApiKey(Boolean(getGeminiApiKey()))}
      />
    </div>
  );
}
