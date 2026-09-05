import React, { useState, useEffect, useRef } from 'react';
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
import {
  loadCachedRoom,
  saveServerRoom,
  shouldApplyServerVersion
} from './utils/roomCache';

const DEFAULT_ROOM_STATE = {
  tripTitle: '2026 日本東京自由行 🎌',
  members: DEFAULT_MEMBERS,
  expenses: INITIAL_EXPENSES
};

export default function App() {
  // 1. 房間與即時同步狀態
  const [roomId, setRoomId] = useState(() => {
    const urlParam = new URLSearchParams(window.location.search).get('room');
    if (urlParam) return urlParam.trim().toUpperCase();
    return localStorage.getItem('japan_trip_room_id') || 'TOKYO-2026';
  });

  const [syncStatus, setSyncStatus] = useState('connecting'); // 'connected', 'connecting', 'disconnected'
  const [onlineCount, setOnlineCount] = useState(1);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // 2. 旅程資料狀態 (根據當前房間載入本地快取)
  const initialData = loadCachedRoom(roomId, DEFAULT_ROOM_STATE);
  const [tripTitle, setTripTitle] = useState(initialData.tripTitle);
  const [members, setMembers] = useState(initialData.members);
  const [expenses, setExpenses] = useState(initialData.expenses);
  const [, setServerVersion] = useState(initialData.version);
  const serverVersionRef = useRef(initialData.version);
  const [syncError, setSyncError] = useState(null);

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
    // 本機快取只可建立資料庫尚不存在的新房間，不能覆蓋既有伺服器資料。
    const getClientData = () => {
      const current = loadCachedRoom(roomId, DEFAULT_ROOM_STATE);
      return {
        tripTitle: current.tripTitle,
        members: current.members,
        expenses: current.expenses
      };
    };

    const applyServerData = (serverData) => {
      if (!serverData) return;
      const nextData = {
        tripTitle: serverData.tripTitle || DEFAULT_ROOM_STATE.tripTitle,
        members: Array.isArray(serverData.members) ? serverData.members : [],
        expenses: Array.isArray(serverData.expenses) ? serverData.expenses : [],
        version: Number(serverData.version) || 0
      };
      setTripTitle(nextData.tripTitle);
      setMembers(nextData.members);
      setExpenses(nextData.expenses);
      serverVersionRef.current = nextData.version;
      setServerVersion(nextData.version);
      saveServerRoom(roomId, nextData);
      setSyncError(null);
    };

    // 監聽連線狀態
    const unStatus = realtimeSync.on('status_change', ({ status, onlineCount: count }) => {
      setSyncStatus(status);
      if (count !== undefined) setOnlineCount(count);
    });

    const unOnline = realtimeSync.on('online_count', (count) => {
      setOnlineCount(count);
    });

    // 加入房間後永遠採用伺服器回傳的權威狀態。
    const unInit = realtimeSync.on('init_state', (serverData) => {
      applyServerData(serverData);
    });

    // 只套用版本不舊於目前畫面的已提交完整狀態。
    const unState = realtimeSync.on('state_updated', (serverData) => {
      if (!serverData) return;
      if (shouldApplyServerVersion(serverVersionRef.current, serverData.version)) {
        applyServerData(serverData);
      }
    });

    const unSyncError = realtimeSync.on('sync_error', (message) => {
      setSyncError(message);
    });

    realtimeSync.connect(roomId, getClientData);

    return () => {
      unStatus();
      unOnline();
      unInit();
      unState();
      unSyncError();
    };
  }, [roomId]);

  // 切換房間
  const handleSwitchRoom = (newRoomId) => {
    const cleanId = (newRoomId || 'TOKYO-2026').trim().toUpperCase();
    setRoomId(cleanId);
    localStorage.setItem('japan_trip_room_id', cleanId);
    const url = new URL(window.location.href);
    url.searchParams.set('room', cleanId);
    window.history.pushState({}, '', url.toString());

    // 載入新房間的本地快取資料
    const nextData = loadCachedRoom(cleanId, DEFAULT_ROOM_STATE);
    setTripTitle(nextData.tripTitle);
    setMembers(nextData.members);
    setExpenses(nextData.expenses);
    serverVersionRef.current = nextData.version;
    setServerVersion(nextData.version);
    setSyncError(null);
  };

  // 支出增刪改查：先更新畫面快取，伺服器提交後會回傳權威版本。
  const handleSaveExpense = (newExp) => {
    setSyncError(null);

    if (editingExpense) {
      setExpenses(prev => {
        const next = prev.map(e => e.id === newExp.id ? newExp : e);
        saveServerRoom(roomId, {
          tripTitle,
          members,
          expenses: next,
          version: serverVersionRef.current
        });
        return next;
      });
      realtimeSync.broadcastExpenseUpdated(newExp);
    } else {
      setExpenses(prev => {
        const next = [newExp, ...prev];
        saveServerRoom(roomId, {
          tripTitle,
          members,
          expenses: next,
          version: serverVersionRef.current
        });
        return next;
      });
      realtimeSync.broadcastExpenseAdded(newExp);
    }
  };

  const handleDeleteExpense = (id) => {
    if (confirm('確定要刪除這筆支出嗎？所有同房間的旅伴也會同步刪除。')) {
      setSyncError(null);
      setExpenses(prev => {
        const next = prev.filter(e => e.id !== id);
        saveServerRoom(roomId, {
          tripTitle,
          members,
          expenses: next,
          version: serverVersionRef.current
        });
        return next;
      });
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
    setSyncError(null);
    setMembers(newMembers);
    saveServerRoom(roomId, {
      tripTitle,
      members: newMembers,
      expenses,
      version: serverVersionRef.current
    });
    realtimeSync.broadcastMembersUpdated(newMembers);
  };

  const handleUpdateTripTitle = (newTitle) => {
    setSyncError(null);
    setTripTitle(newTitle);
    saveServerRoom(roomId, {
      tripTitle: newTitle,
      members,
      expenses,
      version: serverVersionRef.current
    });
    realtimeSync.broadcastFullState({
      tripTitle: newTitle,
      members,
      expenses
    });
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
        setTripTitle={handleUpdateTripTitle}
        currentRate={currentRate}
        rateSource={rateSource}
        refreshRate={updateLiveRate}
        onOpenOcr={() => setIsOcrModalOpen(true)}
        onOpenMembers={() => setIsMemberModalOpen(true)}
        onOpenAiKey={() => setIsAiKeyModalOpen(true)}
        hasApiKey={hasApiKey}
        roomId={roomId}
        syncStatus={syncStatus}
        syncError={syncError}
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
