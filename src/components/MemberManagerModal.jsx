import React, { useState, useRef } from 'react';
import { X, UserPlus, Trash2, Check, Users, Edit2, Upload, Camera, Sparkles, Image as ImageIcon } from 'lucide-react';
import { PRESET_AVATARS } from '../data/defaultData';
import { MemberAvatar } from './MemberAvatar';

const COLOR_PRESETS = [
  '#1E293B', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#6366F1'
];

export function MemberManagerModal({
  isOpen,
  onClose,
  members,
  onUpdateMembers,
  expenses
}) {
  if (!isOpen) return null;

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  // 新增成員狀態
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [selectedAvatarImage, setSelectedAvatarImage] = useState(PRESET_AVATARS[0].image); // 預設兵長

  // 編輯中成員狀態
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingAvatarImage, setEditingAvatarImage] = useState(null);
  const [editingColor, setEditingColor] = useState('#3B82F6');

  // 壓縮大圖為輕量頭貼 (避免傳輸過大)
  const processAvatarFile = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 居中正方形裁剪
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadNewAvatar = (e) => {
    const file = e.target.files?.[0];
    processAvatarFile(file, (dataUrl) => {
      setSelectedAvatarImage(dataUrl);
    });
  };

  const handleUploadEditAvatar = (e) => {
    const file = e.target.files?.[0];
    processAvatarFile(file, (dataUrl) => {
      setEditingAvatarImage(dataUrl);
    });
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const newMember = {
      id: `mem_${Date.now()}`,
      name: newMemberName.trim(),
      avatarColor: selectedColor,
      avatarImage: selectedAvatarImage || null
    };

    onUpdateMembers([...members, newMember]);
    setNewMemberName('');
    
    // 循環下一個頭貼與顏色
    const nextColor = COLOR_PRESETS[(COLOR_PRESETS.indexOf(selectedColor) + 1) % COLOR_PRESETS.length];
    setSelectedColor(nextColor);
    setSelectedAvatarImage(null);
  };

  const handleDeleteMember = (memberId) => {
    if (members.length <= 1) {
      alert('至少需要保留一位旅伴成員');
      return;
    }

    const hasPaid = expenses.some(e => e.payerId === memberId);
    if (hasPaid) {
      if (!confirm('此成員已有代墊付款的記帳紀錄，刪除後可能影響分帳計算，確定要刪除嗎？')) {
        return;
      }
    }

    onUpdateMembers(members.filter(m => m.id !== memberId));
  };

  const handleStartEdit = (m) => {
    setEditingId(m.id);
    setEditingName(m.name);
    setEditingAvatarImage(m.avatarImage || null);
    setEditingColor(m.avatarColor || '#3B82F6');
  };

  const handleSaveEdit = (mId) => {
    if (!editingName.trim()) return;
    onUpdateMembers(members.map(m => m.id === mId ? {
      ...m,
      name: editingName.trim(),
      avatarImage: editingAvatarImage,
      avatarColor: editingColor
    } : m));
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">旅伴成員與頭貼設定</h3>
              <p className="text-[11px] text-slate-400">支援自訂上傳照片或選擇可愛卡通/兵長造型</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* 成員列表 */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-700 block">
              👥 目前旅伴成員 ({members.length} 人)：
            </span>

            {members.map(m => {
              const isEditing = editingId === m.id;
              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <MemberAvatar
                        member={isEditing ? { ...m, avatarImage: editingAvatarImage, avatarColor: editingColor } : m}
                        size="lg"
                      />

                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(m.id)}
                          autoFocus
                          className="px-2.5 py-1 bg-white border border-blue-500 rounded-xl text-sm font-semibold text-slate-800 w-full outline-none shadow-sm"
                        />
                      ) : (
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 text-sm truncate block">
                            {m.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {m.avatarImage ? '客製頭貼' : '純色文字頭像'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveEdit(m.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                        >
                          <Check size={14} />
                          <span>儲存</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(m)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
                          title="更換頭貼或改名"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteMember(m.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="移除成員"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 編輯模式下的頭貼更換面板 */}
                  {isEditing && (
                    <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-in fade-in">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                        <span>更換頭貼樣式：</span>
                        <input
                          type="file"
                          ref={editFileInputRef}
                          onChange={handleUploadEditAvatar}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                        >
                          <Upload size={12} />
                          <span>上傳自己照片</span>
                        </button>
                      </div>

                      {/* 預設造型晶片 */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {PRESET_AVATARS.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setEditingAvatarImage(preset.image)}
                            className={`flex items-center gap-1.5 p-1 rounded-xl border transition-all ${
                              editingAvatarImage === preset.image
                                ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <img src={preset.image} alt={preset.name} className="w-6 h-6 rounded-full object-cover" />
                            <span className="text-[10px] font-medium text-slate-700 pr-1">{preset.name}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditingAvatarImage(null)}
                          className={`px-2 py-1 rounded-xl border text-[10px] font-medium transition-all ${
                            !editingAvatarImage ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          純色頭像
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 新增成員表單 */}
          <form onSubmit={handleAddMember} className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <UserPlus size={14} className="text-rose-500" />
              新增旅伴成員
            </span>

            {/* 姓名與預覽 */}
            <div className="flex items-center gap-3">
              <MemberAvatar
                member={{ name: newMemberName || '新', avatarColor: selectedColor, avatarImage: selectedAvatarImage }}
                size="lg"
              />
              <input
                type="text"
                placeholder="輸入姓名（例：艾連、三笠、兵長）"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-rose-500 shadow-xs"
              />
              <button
                type="submit"
                disabled={!newMemberName.trim()}
                className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-2xl disabled:opacity-40 shadow-sm transition-all active:scale-95"
              >
                加入
              </button>
            </div>

            {/* 卡通造型頭貼選取區 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">選擇頭貼造型：</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadNewAvatar}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                >
                  <Upload size={12} />
                  <span>自行拍照 / 上傳照片</span>
                </button>
              </div>

              {/* 預設造型列表 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_AVATARS.map(preset => {
                  const isSelected = selectedAvatarImage === preset.image;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedAvatarImage(preset.image)}
                      className={`flex items-center gap-2 p-1.5 rounded-2xl border transition-all text-left ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50 shadow-sm ring-2 ring-rose-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <img
                        src={preset.image}
                        alt={preset.name}
                        className="w-8 h-8 rounded-full object-cover border border-white shadow-xs shrink-0"
                      />
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 代表純色選取 (若無頭像照片時顯示) */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">代表底色：</span>
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        selectedColor === c ? 'scale-125 ring-2 ring-slate-800 ring-offset-1' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
