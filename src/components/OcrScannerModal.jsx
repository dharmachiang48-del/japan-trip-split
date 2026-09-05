import React, { useState, useRef } from 'react';
import { 
  X, Camera, Upload, Sparkles, Check, AlertCircle, 
  RefreshCw, ArrowRight, Image as ImageIcon 
} from 'lucide-react';
import { scanPriceFromImage } from '../utils/ocr';
import { formatTWD, formatJPY } from '../utils/currency';

export function OcrScannerModal({
  isOpen,
  onClose,
  currentRate,
  onSelectPriceForExpense,
  onAskAiWithPhoto
}) {
  if (!isOpen) return null;

  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [detectedPrices, setDetectedPrices] = useState([]);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  // 處理使用者上傳或拍照的圖片
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setImagePreview(dataUrl);
      startOcr(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // 啟動 OCR 辨識
  const startOcr = async (imgSource) => {
    setIsScanning(true);
    setScanProgress(0.1);
    setScanStatus('初始化光學辨識引擎中...');
    setDetectedPrices([]);
    setSelectedAmount(null);
    setRawText('');

    try {
      const result = await scanPriceFromImage(imgSource, (p) => {
        setScanStatus(p.message);
        setScanProgress(p.progress);
      });

      setRawText(result.rawText);
      setDetectedPrices(result.detectedPrices);

      if (result.detectedPrices.length > 0) {
        setSelectedAmount(result.detectedPrices[0].amount);
      }
    } catch (err) {
      console.error(err);
      setScanStatus('辨識過程發生問題，請手動輸入金額');
    } finally {
      setIsScanning(false);
    }
  };

  // 示範照片快速載入（方便桌機或未帶照片時一鍵測試）
  const loadSampleReceipt = () => {
    // 繪製一張含日幣標籤的 Canvas 示範圖
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 600, 400);

    // 模擬日本拉麵店價目牌
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('RAMEN ICHIRAN ラーメン', 40, 70);

    ctx.fillStyle = '#64748b';
    ctx.font = '22px sans-serif';
    ctx.fillText('特製豚骨拉麵 Ramen Special', 40, 120);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('¥1,480 (税込)', 40, 180);

    ctx.fillStyle = '#64748b';
    ctx.font = '22px sans-serif';
    ctx.fillText('半熟玉子 (溫泉蛋)', 40, 240);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('¥150 円', 40, 290);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('合計 TOTAL: ¥1,630', 40, 360);

    const sampleDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImagePreview(sampleDataUrl);
    startOcr(sampleDataUrl);
  };

  const handleConfirmAndAddExpense = () => {
    if (!selectedAmount || selectedAmount <= 0) {
      alert('請先選擇或點選辨識到的金額');
      return;
    }

    onSelectPriceForExpense({
      amount: selectedAmount,
      currency: 'JPY',
      rate: currentRate,
      note: '來自拍照價格自動辨識'
    });
    onClose();
  };

  const handleOpenAiWithThisImage = () => {
    if (!imagePreview) return;
    onAskAiWithPhoto({
      imageData: imagePreview,
      title: '拍照價格標籤'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">拍照辨識價格 & 自動換匯</h3>
              <p className="text-[11px] text-slate-400">拍下日本商品標籤、收據或菜單，自動換算台幣</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* 照片預覽或上傳提示區塊 */}
          {!imagePreview ? (
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-slate-50/50 space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                <Camera size={32} />
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 text-sm">拍攝或上傳日文價格標籤照片</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  自動辨識標籤上的 ¥ 符號、日幣數字與税込金額，無須手動輸入
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Camera size={16} />
                  拍照 / 選取照片
                </button>

                <button
                  type="button"
                  onClick={loadSampleReceipt}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  載入示範標籤測試
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 圖片預覽卡片與掃描動畫 */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 max-h-64 flex items-center justify-center border border-slate-200 shadow-inner">
                <img
                  src={imagePreview}
                  alt="Scanned Price Tag"
                  className="max-h-64 w-auto object-contain"
                />

                {/* 掃描進行中的雷射光動畫 */}
                {isScanning && (
                  <div className="absolute inset-0 bg-rose-500/10 pointer-events-none overflow-hidden">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_15px_#f43f5e] animate-scan"></div>
                  </div>
                )}

                {/* 重新拍照按鈕 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs font-medium rounded-xl backdrop-blur-sm transition-colors flex items-center gap-1"
                >
                  <Camera size={13} />
                  重拍一張
                </button>
              </div>

              {/* 掃描狀態條 */}
              {isScanning && (
                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={14} className="animate-spin" />
                      {scanStatus}
                    </span>
                    <span>{Math.round(scanProgress * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-300 rounded-full"
                      style={{ width: `${scanProgress * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 辨識結果與價格選擇 */}
              {!isScanning && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      🎯 偵測到的價格候選清單：
                    </span>
                    {detectedPrices.length === 0 && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle size={13} /> 未能自動抓取，可直接手動輸入
                      </span>
                    )}
                  </div>

                  {detectedPrices.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {detectedPrices.map((item, idx) => {
                        const isSelected = selectedAmount === item.amount;
                        const twd = Math.round(item.amount * currentRate);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedAmount(item.amount)}
                            className={`p-3 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-rose-500 bg-rose-50 shadow-sm ring-2 ring-rose-500/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold text-slate-900">
                                {formatJPY(item.amount)}
                              </span>
                              {isSelected && <Check size={16} className="text-rose-600" />}
                            </div>
                            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                              折合 {formatTWD(twd)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* 手動輸入/確認選定金額 */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] text-slate-400 block">確認採用日幣金額：</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-500">¥</span>
                        <input
                          type="number"
                          value={selectedAmount || ''}
                          onChange={(e) => setSelectedAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="font-black text-xl text-slate-800 bg-transparent outline-none w-32"
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">折合新台幣約：</span>
                      <span className="text-lg font-black text-rose-600">
                        {formatTWD((selectedAmount || 0) * currentRate)}
                      </span>
                    </div>
                  </div>

                  {/* 詢問 AI 助手捷徑按鈕 */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleOpenAiWithThisImage}
                      className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Sparkles size={15} />
                      <span>看不懂日文？傳送此照片給 AI 助手詢問</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
          >
            關閉
          </button>

          {imagePreview && !isScanning && selectedAmount > 0 && (
            <button
              type="button"
              onClick={handleConfirmAndAddExpense}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-200 flex items-center gap-2 transition-all active:scale-95"
            >
              <span>帶入分帳記帳</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
