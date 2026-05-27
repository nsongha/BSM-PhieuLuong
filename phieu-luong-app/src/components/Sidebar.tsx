// phieu-luong-app/src/components/Sidebar.tsx
import { Home, FileSpreadsheet, History, Map, Settings } from 'lucide-react';

type NavItem = {
  icon: React.ReactNode;
  label: string;
  routeName: string;
  badge?: number;
};

type SidebarProps = {
  activeRoute: string;
  onNavigate: (route: string) => void;
  collapsed?: boolean;
  period?: { month: string; year: string };
  onChangePeriod?: () => void;
};

const NAV_ITEMS: NavItem[] = [
  { icon: <Home size={18} />, label: 'Trang chủ', routeName: 'home' },
  { icon: <FileSpreadsheet size={18} />, label: 'Bảng lương', routeName: 'preview' },
  { icon: <History size={18} />, label: 'Lịch sử', routeName: 'history' },
  { icon: <Map size={18} />, label: 'Mapping', routeName: 'mapping' },
  { icon: <Settings size={18} />, label: 'Cài đặt', routeName: 'setup' },
];

export function Sidebar({ activeRoute, onNavigate, collapsed = false, period, onChangePeriod }: SidebarProps) {
  const w = collapsed ? 64 : 224;

  return (
    <div
      className="flex flex-col flex-shrink-0 h-screen overflow-hidden transition-[width] duration-200"
      style={{ width: w, background: '#0F172A' }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center px-0 py-5' : 'px-3.5 py-5'}`}>
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg text-white font-bold text-sm select-none"
          style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
            fontSize: 15,
          }}
        >
          ₫
        </div>
        {!collapsed && (
          <span className="text-white font-semibold text-sm leading-none whitespace-nowrap">Phiếu Lương</span>
        )}
      </div>

      {/* Workspace label */}
      {!collapsed && (
        <div className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.8px] text-sidebar-label">
          BSM Labs
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.routeName ||
            (item.routeName === 'preview' && ['preview', 'period-pick', 'sheet-pick'].includes(activeRoute));
          return (
            <button
              key={item.routeName}
              type="button"
              onClick={() => onNavigate(item.routeName)}
              className={`relative flex items-center rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cta-500/50 ${
                collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2'
              } ${
                isActive
                  ? 'bg-sidebar-hover text-white'
                  : 'text-sidebar-text hover:bg-sidebar-hover/60 hover:text-white'
              }`}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r bg-cta-500"
                  style={{ height: 16 }}
                  aria-hidden
                />
              )}
              {item.icon}
              {!collapsed && (
                <span className="text-sm font-medium leading-none">{item.label}</span>
              )}
              {!collapsed && item.badge ? (
                <span
                  className="ml-auto text-[10px] font-semibold text-white px-1.5 py-px rounded-full bg-cta-500"
                  style={{ lineHeight: '16px' }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Period chip */}
      {period && (
        <div className="mx-2 mb-4 rounded-[10px] p-3" style={{ background: '#1E293B' }}>
          {!collapsed && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-[0.8px] text-sidebar-label mb-1">
                Kỳ đang chọn
              </div>
              <div className="text-sm font-semibold text-white mb-2">
                Tháng {period.month} / {period.year}
              </div>
              {onChangePeriod && (
                <button
                  type="button"
                  onClick={onChangePeriod}
                  className="w-full text-[11px] text-slate-300 border border-[#334155] rounded-md py-1 hover:border-slate-400 transition-colors"
                >
                  Đổi kỳ
                </button>
              )}
            </>
          )}
          {collapsed && (
            <div className="text-[10px] font-semibold text-sidebar-text text-center leading-tight">
              {period.month}<br />/'{period.year.slice(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
