import React, { useEffect, useRef, useState } from 'react';
import {
  X, Camera, Upload, Sparkles, Check, AlertCircle,
  RefreshCw, ArrowRight, ScanLine, ChevronLeft
} from 'lucide-react';
import { createPriceScanner, updatePriceCandidatesStability } from '../utils/ocr';
import { formatTWD, formatJPY } from '../utils/currency';

export function OcrScannerModal({
  isOpen,
  onClose,
  currentRate,
  onSelectPriceForExpense,
  onAskAiWithPhoto,
  createLiveScanner = createPriceScanner,
  createPhotoScanner = createPriceScanner,
  liveScanIntervalMs = 1200
}) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const liveStreamRef = useRef(null);
  const priceCandidatesRef = useRef([]);
  const photoScannerRef = useRef(null);
  const photoScanVersionRef = useRef(0);
  const fileReaderRef = useRef(null);
  const fileReadVersionRef = useRef(0);
  const [mode, setMode] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [detectedPrices, setDetectedPrices] = useState([]);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [priceCandidates, setPriceCandidates] = useState([]);

  const stopLiveCamera = () => {
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;
  };

  const stopPhotoScan = () => {
    photoScanVersionRef.current += 1;
    const scanner = photoScannerRef.current;
    photoScannerRef.current = null;
    scanner?.terminate().catch(() => {});
  };

  const cancelPendingFileRead = () => {
    fileReadVersionRef.current += 1;
    const reader = fileReaderRef.current;
    fileReaderRef.current = null;
    if (reader?.readyState === 1) {
      try { reader.abort(); } catch (error) {}
    }
  };

  const resetScanResult = () => {
    setDetectedPrices([]);
    setSelectedAmount(null);
    setRawText('');
    setShowRawText(false);
    setScanProgress(0);
    setScanStatus('');
    priceCandidatesRef.current = [];
    setPriceCandidates([]);
  };

  const chooseMode = (nextMode) => {
    stopLiveCamera();
    stopPhotoScan();
    cancelPendingFileRead();
    resetScanResult();
    setImagePreview(null);
    setCameraError('');
    setCameraStatus('idle');
    setMode(nextMode);
  };

  const handleClose = () => {
    stopLiveCamera();
    stopPhotoScan();
    cancelPendingFileRead();
    setMode(null);
    resetScanResult();
    setImagePreview(null);
    setCameraError('');
    setCameraStatus('idle');
    onClose();
  };

  useEffect(() => {
    if (!isOpen || mode !== 'live') return undefined;

    let cancelled = false;
    let waitTimer;
    let liveScanner;
    const wait = (milliseconds) => new Promise((resolve) => {
      waitTimer = setTimeout(resolve, milliseconds);
    });

    const beginLiveScan = async () => {
      setCameraStatus('requesting');
      setCameraError('');

      try {
        if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
          throw new Error('這個瀏覽器不支援相機即時掃描');
        }

        const stream = await globalThis.navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } }
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        liveStreamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('相機畫面尚未準備完成');
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setCameraStatus('ready');
        setIsScanning(true);
        liveScanner = await createLiveScanner({
          onProgress: (progress) => {
            if (cancelled) return;
            setScanStatus(progress.message);
            setScanProgress(progress.progress);
          }
        });
        setIsScanning(false);
        if (cancelled) {
          await liveScanner.terminate();
          return;
        }

        while (!cancelled) {
          if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            await wait(250);
            continue;
          }

          const canvas = canvasRef.current;
          const context = canvas?.getContext('2d', { willReadFrequently: true });
          if (!canvas || !context) throw new Error('無法讀取相機畫面');

          const cropWidth = Math.round(video.videoWidth * 0.9);
          const cropHeight = Math.round(video.videoHeight * 0.45);
          const cropX = Math.round((video.videoWidth - cropWidth) / 2);
          const cropY = Math.round((video.videoHeight - cropHeight) / 2);
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

          setIsScanning(true);
          setScanStatus('正在辨識框內的日幣價格…');
          setScanProgress(0.1);

          try {
            const result = await liveScanner.scan(canvas.toDataURL('image/jpeg', 0.86), (progress) => {
              if (cancelled) return;
              setScanStatus(progress.message);
              setScanProgress(progress.progress);
            });
            if (cancelled) return;

            setRawText(result.rawText);
            setDetectedPrices(result.detectedPrices);
            const nextCandidates = updatePriceCandidatesStability(
              priceCandidatesRef.current,
              result.detectedPrices
            );
            const stableCandidates = nextCandidates.filter((candidate) => candidate.isStable);
            priceCandidatesRef.current = nextCandidates;
            setPriceCandidates(nextCandidates);
            setSelectedAmount((previousAmount) => {
              const previousStillStable = stableCandidates.some((candidate) => candidate.amount === previousAmount);
              return previousStillStable ? previousAmount : (stableCandidates[0]?.amount ?? null);
            });
          } catch (error) {
            if (!cancelled) {
              stopLiveCamera();
              setCameraError(`辨識暫時停止：${error.message || '無法辨識價格'}`);
            }
            break;
          } finally {
            if (!cancelled) setIsScanning(false);
          }

          await wait(liveScanIntervalMs);
        }
        await liveScanner.terminate();
      } catch (error) {
        if (!cancelled) {
          setIsScanning(false);
          stopLiveCamera();
          await liveScanner?.terminate().catch(() => {});
          setCameraStatus('error');
          const permissionDenied = error?.name === 'NotAllowedError';
          setCameraError(permissionDenied
            ? '相機權限未開啟，請允許使用相機，或改用拍照辨識。'
            : `${error.message || '無法開啟相機'}，可以改用拍照辨識。`);
        }
      }
    };

    beginLiveScan();
    return () => {
      cancelled = true;
      clearTimeout(waitTimer);
      liveScanner?.terminate().catch(() => {});
      stopLiveCamera();
    };
  }, [isOpen, mode, createLiveScanner, liveScanIntervalMs]);

  useEffect(() => () => {
    stopLiveCamera();
    stopPhotoScan();
    cancelPendingFileRead();
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    cancelPendingFileRead();
    const readVersion = fileReadVersionRef.current;
    const reader = new FileReader();
    fileReaderRef.current = reader;
    reader.onload = (loadEvent) => {
      if (readVersion !== fileReadVersionRef.current) return;
      fileReaderRef.current = null;
      const dataUrl = loadEvent.target.result;
      setImagePreview(dataUrl);
      startPhotoOcr(dataUrl);
    };
    reader.onerror = () => {
      if (readVersion !== fileReadVersionRef.current) return;
      fileReaderRef.current = null;
      setScanStatus('照片讀取失敗，請重新選擇照片');
    };
    reader.readAsDataURL(file);
  };

  const startPhotoOcr = async (imageSource) => {
    stopPhotoScan();
    const scanVersion = photoScanVersionRef.current;
    resetScanResult();
    setIsScanning(true);
    setScanProgress(0.1);
    setScanStatus('初始化光學辨識引擎中…');
    let scanner;

    try {
      scanner = await createPhotoScanner({
        onProgress: (progress) => {
          if (scanVersion !== photoScanVersionRef.current) return;
          setScanStatus(progress.message);
          setScanProgress(progress.progress);
        }
      });
      if (scanVersion !== photoScanVersionRef.current) {
        await scanner.terminate();
        return;
      }
      photoScannerRef.current = scanner;
      const result = await scanner.scan(imageSource, (progress) => {
        if (scanVersion !== photoScanVersionRef.current) return;
        setScanStatus(progress.message);
        setScanProgress(progress.progress);
      });
      if (scanVersion !== photoScanVersionRef.current) return;
      setRawText(result.rawText);
      setDetectedPrices(result.detectedPrices);
      if (result.detectedPrices.length > 0) setSelectedAmount(result.detectedPrices[0].amount);
    } catch (error) {
      if (scanVersion === photoScanVersionRef.current) {
        console.error(error);
        setScanStatus('辨識發生問題，請直接輸入金額');
      }
    } finally {
      if (photoScannerRef.current === scanner) photoScannerRef.current = null;
      await scanner?.terminate().catch(() => {});
      if (scanVersion === photoScanVersionRef.current) setIsScanning(false);
    }
  };

  const loadSampleReceipt = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, 600, 400);
    context.fillStyle = '#1e293b';
    context.font = 'bold 32px sans-serif';
    context.fillText('OKINAWA SOBA 沖縄そば', 40, 70);
    context.fillStyle = '#64748b';
    context.font = '22px sans-serif';
    context.fillText('三枚肉そば', 40, 120);
    context.fillStyle = '#dc2626';
    context.font = 'bold 36px sans-serif';
    context.fillText('¥980 (税込)', 40, 180);
    context.fillStyle = '#0f172a';
    context.font = 'bold 30px sans-serif';
    context.fillText('合計 TOTAL: ¥980', 40, 300);

    const sampleDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImagePreview(sampleDataUrl);
    startPhotoOcr(sampleDataUrl);
  };

  const handleConfirmAndAddExpense = () => {
    if (!selectedAmount || selectedAmount <= 0) {
      alert('請先選擇或輸入辨識到的金額');
      return;
    }

    onSelectPriceForExpense({
      amount: selectedAmount,
      currency: 'JPY',
      rate: currentRate,
      note: mode === 'live' ? '來自相機即時掃描' : '來自拍照價格辨識'
    });
    handleClose();
  };

  const handleOpenAiWithThisImage = () => {
    if (!imagePreview) return;
    onAskAiWithPhoto({ imageData: imagePreview, title: '拍照價格標籤' });
    handleClose();
  };

  const stableLivePrices = priceCandidates.filter((candidate) => candidate.isStable);
  const pendingLivePrices = priceCandidates.filter((candidate) => !candidate.isStable);

  const renderResultPanel = () => (
    <div className="space-y-3">
      {mode === 'live' && pendingLivePrices.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          正在確認 {pendingLivePrices.map((price) => formatJPY(price.amount)).join('、')}，請保持鏡頭穩定…
        </div>
      )}

      {mode === 'photo' && selectedAmount > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-5 text-center shadow-sm">
          <span className="text-xs font-bold tracking-wide text-rose-500">掃描換算結果</span>
          <div className="mt-1 text-3xl font-black text-slate-900">{formatJPY(selectedAmount)}</div>
          <div className="my-1 text-xs text-slate-400">約等於</div>
          <div className="text-3xl font-black text-rose-600">{formatTWD(selectedAmount * currentRate)}</div>
          <div className="mt-2 text-[11px] text-slate-500">目前匯率：1 JPY = NT$ {currentRate.toFixed(4)}</div>
        </div>
      )}

      {mode === 'live' && stableLivePrices.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">已確認的價格</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
              找到 {stableLivePrices.length} 個
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stableLivePrices.map((item) => {
              const isSelected = selectedAmount === item.amount;
              return (
                <button
                  key={item.amount}
                  type="button"
                  onClick={() => setSelectedAmount(item.amount)}
                  className={`rounded-2xl border p-3 text-left transition-all ${isSelected
                    ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    {formatJPY(item.amount)}
                    {isSelected && <Check size={15} className="text-rose-600" />}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-rose-600">
                    {formatTWD(item.amount * currentRate)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detectedPrices.length > 0 && mode === 'photo' && (
        <div>
          <div className="mb-2 text-xs font-bold text-slate-700">其他辨識到的價格</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {detectedPrices.map((item) => {
              const isSelected = selectedAmount === item.amount;
              return (
                <button
                  key={item.amount}
                  type="button"
                  onClick={() => setSelectedAmount(item.amount)}
                  className={`rounded-2xl border p-3 text-left transition-all ${isSelected
                    ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    {formatJPY(item.amount)}
                    {isSelected && <Check size={15} className="text-rose-600" />}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-rose-600">{formatTWD(item.amount * currentRate)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isScanning && mode === 'photo' && imagePreview && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="min-w-0">
            <span className="block text-[11px] text-slate-400">也可以直接修正日幣金額</span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-500">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={selectedAmount || ''}
                onChange={(event) => setSelectedAmount(parseFloat(event.target.value) || 0)}
                placeholder="0"
                className="w-32 bg-transparent text-xl font-black text-slate-800 outline-none"
              />
            </div>
          </div>
          <div className="text-right">
            <span className="block text-[11px] text-slate-400">折合新台幣約</span>
            <span className="text-lg font-black text-rose-600">{formatTWD((selectedAmount || 0) * currentRate)}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {mode && (
              <button type="button" onClick={() => chooseMode(null)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" title="返回掃描方式">
                <ChevronLeft size={19} />
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><ScanLine size={19} /></div>
            <div>
              <h3 className="text-base font-bold text-slate-800">掃描日幣價格</h3>
              <p className="text-[11px] text-slate-400">對準標價，立即換算並加入帳本</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!mode && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">想快速看換算價格就用即時掃描；收據或菜單則適合拍照辨識。</div>
              <button type="button" onClick={() => chooseMode('live')} className="group w-full rounded-3xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-5 text-left transition-all hover:border-rose-400 hover:shadow-md active:scale-[0.99]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-sm shadow-rose-200"><ScanLine size={25} /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="text-base font-black text-slate-900">立即掃描</span><span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">推薦</span></div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">開啟相機對準日幣價錢，不用拍照就會顯示台幣。</p>
                  </div>
                  <ArrowRight size={18} className="mt-3 text-rose-400 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              <button type="button" onClick={() => chooseMode('photo')} className="group w-full rounded-3xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.99]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Camera size={24} /></div>
                  <div className="flex-1"><span className="text-base font-black text-slate-900">拍照辨識</span><p className="mt-1 text-xs leading-5 text-slate-500">拍下或選取收據、菜單與價目牌，再選擇正確金額。</p></div>
                  <ArrowRight size={18} className="mt-3 text-slate-400 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          )}

          {mode === 'live' && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-950 shadow-inner">
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="pointer-events-none absolute inset-x-[5%] top-[27.5%] h-[45%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]">
                  <div className="animate-scan h-0.5 w-full bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_12px_#fb7185]" />
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">將日幣價錢放在框內</span>
                </div>
                {cameraStatus === 'requesting' && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm font-semibold text-white"><RefreshCw size={18} className="mr-2 animate-spin" />正在開啟相機…</div>}
              </div>

              {isScanning && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-700"><span className="flex items-center gap-1.5"><RefreshCw size={13} className="animate-spin" />{scanStatus}</span><span>{Math.round(scanProgress * 100)}%</span></div>
                </div>
              )}

              {cameraError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{cameraError}</span></div>
                  <button type="button" onClick={() => chooseMode('photo')} className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-xs font-bold text-amber-900 shadow-sm">改用拍照辨識</button>
                </div>
              )}
              {renderResultPanel()}
            </div>
          )}

          {mode === 'photo' && (
            <div className="space-y-4">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
              {!imagePreview ? (
                <div className="space-y-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500"><Camera size={32} /></div>
                  <div><h4 className="text-sm font-semibold text-slate-800">拍攝或選取日幣價格照片</h4><p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">可辨識 ¥、円、含稅金額及收據總計。</p></div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mx-auto flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-rose-200"><Upload size={16} />拍照／選取照片</button>
                  <button type="button" onClick={loadSampleReceipt} className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4">使用沖繩麵示範標籤</button>
                </div>
              ) : (
                <>
                  <div className="relative flex max-h-64 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-inner">
                    <img src={imagePreview} alt="日幣價格照片" className="max-h-64 w-auto object-contain" />
                    {isScanning && <div className="absolute inset-0 bg-rose-500/10"><div className="animate-scan h-1 w-full bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_15px_#f43f5e]" /></div>}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 flex items-center gap-1 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-medium text-white"><Camera size={13} />重拍一張</button>
                  </div>
                  {isScanning && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><div className="flex items-center justify-between text-xs font-semibold text-rose-700"><span>{scanStatus}</span><span>{Math.round(scanProgress * 100)}%</span></div></div>}
                  {!isScanning && detectedPrices.length === 0 && <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle size={15} />沒有找到明確價格，可直接在下方輸入。</div>}
                  {!isScanning && renderResultPanel()}
                  {!isScanning && imagePreview && <button type="button" onClick={handleOpenAiWithThisImage} className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700"><Sparkles size={15} />看不懂日文？用 AI 詢問這張照片</button>}
                  {rawText && <button type="button" onClick={() => setShowRawText((visible) => !visible)} className="text-xs text-slate-400 underline">{showRawText ? '收起辨識文字' : '查看辨識到的文字'}</button>}
                  {showRawText && <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-[11px] text-slate-600">{rawText}</pre>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">關閉</button>
          {mode && selectedAmount > 0 && <button type="button" onClick={handleConfirmAndAddExpense} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-200 active:scale-95"><span>加入帳本</span><ArrowRight size={16} /></button>}
        </div>
      </div>
    </div>
  );
}
