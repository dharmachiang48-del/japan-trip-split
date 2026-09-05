import React from 'react';
import { Receipt, Calculator, Images, Scale } from 'lucide-react';

export function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'expenses', label: '分帳明細', icon: Receipt },
    { id: 'calculator', label: '匯率速算', icon: Calculator },
    { id: 'photos', label: '菜單相簿', icon: Images },
    { id: 'settlement', label: '結算清算', icon: Scale },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg md:relative md:border-t-0 md:shadow-none md:bg-transparent">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all relative ${
                isActive
                  ? 'text-rose-600 font-semibold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-rose-50' : 'hover:bg-slate-100'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[11px] leading-none">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-rose-600 rounded-full mt-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
