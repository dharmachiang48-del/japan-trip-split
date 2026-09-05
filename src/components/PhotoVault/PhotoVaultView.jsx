import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Upload, Plus, Trash2, Sparkles, Filter, 
  Eye, Calendar, Tag, Image as ImageIcon, AlertCircle 
} from 'lucide-react';
import { getAllPhotos, addPhoto, deletePhoto, compressImage } from '../../utils/db';

const PHOTO_CATEGORIES = [
  { id: 'all', label: '全部照片', icon: '📸' },
  { id: 'menu', label: '🍱 菜單美食', icon: '🍱' },
  { id: 'receipt', label: '🧾 消費收據', icon: '🧾' },
  { id: 'tag', label: '🏷️ 標價戰利品', icon: '🏷️' },
  { id: 'note', label: '📌 備忘票券', icon: '📌' },
];

export function PhotoVaultView({ onOpenAiChatWithPhoto }) {
  const [photos, setPhotos] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhotoForDetail, setSelectedPhotoForDetail] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);

  // 載入所有 IndexedDB 照片
  const loadPhotos = async () => {
    setIsLoading(true);
    try {
      const data = await getAllPhotos();
      setPhotos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  // 上傳或拍照處理
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 壓縮大圖，防止記憶體過載
      const compressedDataUrl = await compressImage(file, 1600, 0.85);

      const title = prompt('請輸入這張照片的名稱或標籤（例：心齋橋居酒屋菜單、大國藥妝收據）：', file.name.replace(/\.[^/.]+$/, "")) || '未命名旅程照片';
      const category = prompt('請選擇分類 (menu:菜單 / receipt:收據 / tag:標價 / note:備忘)：', 'menu') || 'menu';

      await addPhoto({
        title,
        category: ['menu', 'receipt', 'tag', 'note'].includes(category) ? category : 'menu',
        imageData: compressedDataUrl,
        createdAt: new Date().toISOString()
      });

      await loadPhotos();
    } catch (err) {
      console.error(err);
      alert('圖片儲存失敗，請重試');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 載入示範照片（讓使用者免上傳即可測試）
  const handleLoadSamplePhotos = async () => {
    setIsUploading(true);
    try {
      // 繪製一張精緻的拉麵菜單示範圖
      const canvas1 = document.createElement('canvas');
      canvas1.width = 600;
      canvas1.height = 750;
      const ctx1 = canvas1.getContext('2d');
      ctx1.fillStyle = '#fbf7ed';
      ctx1.fillRect(0, 0, 600, 750);
      ctx1.strokeStyle = '#c5a059';
      ctx1.lineWidth = 6;
      ctx1.strokeRect(20, 20, 560, 710);

      ctx1.fillStyle = '#b91c1c';
      ctx1.font = 'bold 36px "Noto Sans TC", sans-serif';
      ctx1.fillText('🍜 麺屋 日本橋 - お品書き (菜單)', 40, 80);

      ctx1.fillStyle = '#1e293b';
      ctx1.font = 'bold 24px sans-serif';
      ctx1.fillText('1. 特製濃厚豚骨醤油ラーメン', 50, 160);
      ctx1.font = '20px sans-serif';
      ctx1.fillStyle = '#64748b';
      ctx1.fillText('・贅沢チャーシュー3枚、味玉、海苔', 50, 195);
      ctx1.fillStyle = '#b91c1c';
      ctx1.font = 'bold 24px sans-serif';
      ctx1.fillText('¥1,280 (税込)', 420, 160);

      ctx1.fillStyle = '#1e293b';
      ctx1.font = 'bold 24px sans-serif';
      ctx1.fillText('2. 辛味噌つけ麺 (辛さ選べます)', 50, 270);
      ctx1.font = '20px sans-serif';
      ctx1.fillStyle = '#64748b';
      ctx1.fillText('・自家製太麺 300g、魚介豚骨ピリ辛スープ', 50, 305);
      ctx1.fillStyle = '#b91c1c';
      ctx1.font = 'bold 24px sans-serif';
      ctx1.fillText('¥1,100 (税込)', 420, 270);

      ctx1.fillStyle = '#1e293b';
      ctx1.font = 'bold 24px sans-serif';
      ctx1.fillText('3. 黒毛和牛炙り肉寿司 (2貫)', 50, 380);
      ctx1.font = '20px sans-serif';
      ctx1.fillStyle = '#64748b';
      ctx1.fillText('・A5ランク黒毛和牛使用、特製甘タレ', 50, 415);
      ctx1.fillStyle = '#b91c1c';
      ctx1.font = 'bold 24px sans-serif';
      ctx1.fillText('¥980 (税込)', 420, 380);

      ctx1.fillStyle = '#475569';
      ctx1.font = '18px sans-serif';
      ctx1.fillText('※ アレルギー表示：小麦、卵、大豆、豚肉、牛肉', 50, 520);
      ctx1.fillText('※ 替玉 (加麵) 1玉 無料サービス中！', 50, 560);

      const menuDataUrl = canvas1.toDataURL('image/jpeg', 0.88);

      // 繪製一張藥妝消費收據
      const canvas2 = document.createElement('canvas');
      canvas2.width = 500;
      canvas2.height = 650;
      const ctx2 = canvas2.getContext('2d');
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, 500, 650);

      ctx2.fillStyle = '#1e293b';
      ctx2.font = 'bold 28px sans-serif';
      ctx2.fillText('OS DRUG 上野店 (領収書)', 50, 60);
      ctx2.font = '16px sans-serif';
      ctx2.fillStyle = '#64748b';
      ctx2.fillText('登録番号: T1234567890123', 50, 95);
      ctx2.fillText('日時: 2026-09-04 15:30', 50, 120);

      ctx2.fillStyle = '#0f172a';
      ctx2.font = 'bold 18px monospace';
      ctx2.fillText('--------------------------------', 50, 150);
      ctx2.fillText('EVE 止痛藥 QUICK DX 40錠   ¥1,680', 50, 190);
      ctx2.fillText('合利他命 EX PLUS 270錠     ¥5,480', 50, 230);
      ctx2.fillText('DHC 維他命C 60日份          ¥420', 50, 270);
      ctx2.fillText('休足時間 18枚入             ¥650', 50, 310);
      ctx2.fillText('--------------------------------', 50, 360);
      ctx2.font = 'bold 22px monospace';
      ctx2.fillText('小計 (10%對象)            ¥8,230', 50, 400);
      ctx2.fillText('消費税等 (10%)              ¥823', 50, 440);
      ctx2.fillStyle = '#dc2626';
      ctx2.fillText('合計金額 (税込)           ¥9,053', 50, 490);

      const receiptDataUrl = canvas2.toDataURL('image/jpeg', 0.88);

      await addPhoto({
        title: '麺屋 日本橋 推薦菜單',
        category: 'menu',
        imageData: menuDataUrl,
        createdAt: new Date().toISOString()
      });

      await addPhoto({
        title: '上野藥妝店消費明細收據',
        category: 'receipt',
        imageData: receiptDataUrl,
        createdAt: new Date().toISOString()
      });

      await loadPhotos();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (id, e) => {
    e.stopPropagation();
    if (confirm('確定要刪除這張照片嗎？')) {
      await deletePhoto(id);
      await loadPhotos();
      if (selectedPhotoForDetail?.id === id) {
        setSelectedPhotoForDetail(null);
      }
    }
  };

  const filteredPhotos = photos.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto animate-in fade-in">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* 標題與操作區 */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>📸 日本旅遊照片存檔庫</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
              {photos.length} 張相片 (離線儲存)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            隨手拍下菜單、收據、標籤與筆記，可隨時放大查閱並呼叫 AI 助手詢問翻譯與成分！
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-200 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Camera size={16} />
            <span>{isUploading ? '儲存中...' : '拍照 / 上傳'}</span>
          </button>

          {photos.length === 0 && (
            <button
              onClick={handleLoadSamplePhotos}
              disabled={isUploading}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="匯入日本拉麵菜單與藥妝收據範例"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>載入示範照片</span>
            </button>
          )}
        </div>
      </div>

      {/* 分類篩選列 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {PHOTO_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-full whitespace-nowrap font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 照片瀑布流 / 網格清單 */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <ImageIcon size={32} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">相片庫目前空空如也</h4>
            <p className="text-xs text-slate-400 mt-1">
              在日本餐廳看到看不懂的日文菜單？拍下來讓 AI 幫你翻譯與解答！
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-sm"
            >
              立即拍攝上傳
            </button>
            <button
              onClick={handleLoadSamplePhotos}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              載入示範範本測試
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredPhotos.map((photo) => {
            const catObj = PHOTO_CATEGORIES.find(c => c.id === photo.category) || PHOTO_CATEGORIES[1];
            return (
              <div
                key={photo.id}
                onClick={() => setSelectedPhotoForDetail(photo)}
                className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col cursor-pointer group"
              >
                {/* 照片預覽區 */}
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  <img
                    src={photo.imageData}
                    alt={photo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/60 text-white backdrop-blur-sm">
                    {catObj.icon} {catObj.label.split(' ')[1] || catObj.label}
                  </div>

                  {/* 刪除小按鈕 */}
                  <button
                    onClick={(e) => handleDeletePhoto(photo.id, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    title="刪除照片"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* 資訊與問 AI 按鈕 */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs truncate" title={photo.title}>
                      {photo.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {new Date(photo.createdAt).toLocaleDateString('zh-TW')}
                    </span>
                  </div>

                  {/* 詢問 AI 助手快捷按鈕 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAiChatWithPhoto(photo);
                    }}
                    className="w-full py-1.5 px-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl text-[11px] font-bold shadow-sm shadow-purple-200 flex items-center justify-center gap-1 transition-transform active:scale-95"
                  >
                    <Sparkles size={12} />
                    <span>問問 AI 助手</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 照片全螢幕大圖檢視彈窗 */}
      {selectedPhotoForDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedPhotoForDetail(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                  {selectedPhotoForDetail.title}
                </h3>
                <span className="text-xs text-slate-400">
                  {new Date(selectedPhotoForDetail.createdAt).toLocaleString('zh-TW')}
                </span>
              </div>
              <button
                onClick={() => setSelectedPhotoForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* 大圖主體 */}
            <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-2 min-h-[300px]">
              <img
                src={selectedPhotoForDetail.imageData}
                alt={selectedPhotoForDetail.title}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>

            {/* 底部操作條 */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const p = selectedPhotoForDetail;
                  setSelectedPhotoForDetail(null);
                  onOpenAiChatWithPhoto(p);
                }}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Sparkles size={16} />
                <span>開啟 AI 視覺問答助手（翻譯/解析）</span>
              </button>

              <button
                onClick={(e) => handleDeletePhoto(selectedPhotoForDetail.id, e)}
                className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                title="刪除此照片"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
