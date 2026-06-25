import React from 'react';

interface SidebarProps {
  currentView: number;
  setView: (view: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

enum View {
  HOME = 0,
  HISTORY = 1,
  LIBRARY = 2,
  SETTINGS = 3,
}

const menuItems = [
  { id: View.HOME, icon: 'home', label: '首页' },
  { id: View.LIBRARY, icon: 'menu_book', label: '知识库' },
  { id: View.HISTORY, icon: 'history', label: '历史' },
];

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, collapsed, onToggleCollapse }) => {
  return (
    <aside
      className={`flex flex-col bg-bg-surface dark:bg-warm-900 border-r border-warm-200/60 dark:border-warm-800/60 shrink-0 transition-all duration-300 z-30 ${collapsed ? 'w-[60px]' : 'w-[220px]'}`}
    >
      {/* ─── Logo 区域 ─── */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-warm-100 dark:border-warm-800/40 overflow-hidden">
        <div className="size-9 rounded-xl bg-accent-500 flex items-center justify-center shadow-sm shrink-0">
          <span className="material-symbols-outlined text-white text-xl font-bold">lens_blur</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-warm-800 dark:text-warm-200 tracking-tight leading-tight">SMARTLEX</span>
            <span className="text-[10px] text-warm-400 font-medium tracking-wide">Knowledge Engine</span>
          </div>
        )}
      </div>

      {/* ─── 导航 ─── */}
      <nav className="flex-1 flex flex-col gap-1 p-3">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium ${isActive
                ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 shadow-sm'
                : 'text-warm-500 dark:text-warm-400 hover:bg-warm-50 dark:hover:bg-warm-800/50 hover:text-warm-800 dark:hover:text-warm-200'
                }`}
            >
              <span className={`material-symbols-outlined text-xl transition-colors ${isActive ? 'text-accent-600 dark:text-accent-400' : ''}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* 分隔 */}
        <div className="my-2 border-t border-warm-100 dark:border-warm-800/40" />

        {/* 设置 */}
        <button
          onClick={() => setView(View.SETTINGS)}
          title={collapsed ? '设置' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium ${currentView === View.SETTINGS
            ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 shadow-sm'
            : 'text-warm-500 dark:text-warm-400 hover:bg-warm-50 dark:hover:bg-warm-800/50 hover:text-warm-800 dark:hover:text-warm-200'
            }`}
        >
          <span className={`material-symbols-outlined text-xl transition-colors ${currentView === View.SETTINGS ? 'text-accent-600 dark:text-accent-400' : ''}`}>
            settings
          </span>
          {!collapsed && <span className="truncate">设置</span>}
        </button>
      </nav>

      {/* ─── 折叠按钮 ─── */}
      <div className="p-3 border-t border-warm-100 dark:border-warm-800/40">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-warm-400 hover:text-warm-600 dark:hover:text-warm-300 hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-all duration-200"
        >
          <span className="material-symbols-outlined text-lg transition-transform duration-300" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          {!collapsed && <span className="text-xs font-medium">收起</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
