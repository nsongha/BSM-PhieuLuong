// phieu-luong-app/src/components/Sidebar.tsx
import { useEffect, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export type SavedPeriod = {
  key: string; // `${year}-${month}`
  month: string;
  year: string;
  savedAt: string; // ISO
};

type SidebarProps = {
  activeRoute: string; // 'home' | 'preview' | 'history' | 'setup'
  onNavigate: (route: 'home' | 'preview' | 'history' | 'setup') => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  savedPeriods?: SavedPeriod[];
  activePeriodKey?: string | null; // currently-loaded period (highlighted in submenu)
  onSelectPeriod?: (key: string) => void;
  onDeletePeriod?: (key: string) => void;
};

type NavId = 'home' | 'preview' | 'history' | 'setup';
type NavItem = {
  id: NavId;
  icon: React.ReactNode;
  label: string;
};

const TOP_NAV: NavItem[] = [
  { id: 'home', icon: <Upload size={18} />, label: 'Import' },
  { id: 'preview', icon: <FileSpreadsheet size={18} />, label: 'Bảng lương' },
  { id: 'history', icon: <History size={18} />, label: 'Lịch sử' },
];

const BOTTOM_NAV: NavItem[] = [
  { id: 'setup', icon: <Settings size={18} />, label: 'Cài đặt' },
];

const CONFIRM_TIMEOUT_MS = 3000;
const TRANS = 'transition-all duration-200 ease-out';

function formatPeriodLabel(p: { month: string; year: string }) {
  return `${p.month}/${p.year}`;
}

export function Sidebar({
  activeRoute,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
  savedPeriods = [],
  activePeriodKey = null,
  onSelectPeriod,
  onDeletePeriod,
}: SidebarProps) {
  const w = collapsed ? 64 : 224;
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  // Auto-reset the "Xoá?" prompt after a short window so the user doesn't
  // accidentally confirm on a stale click later.
  useEffect(() => {
    if (!confirmingKey) return;
    const id = setTimeout(() => setConfirmingKey(null), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [confirmingKey]);

  // Collapsing the sidebar should also tear down any pending confirm state,
  // otherwise the prompt lingers in a hidden submenu.
  useEffect(() => {
    if (collapsed) setConfirmingKey(null);
  }, [collapsed]);

  const isItemActive = (id: NavId) => {
    if (id === activeRoute) return true;
    if (id === 'preview' && ['preview', 'period-pick', 'sheet-pick', 'sending'].includes(activeRoute)) return true;
    return false;
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isItemActive(item.id);
    const isPreview = item.id === 'preview';
    const hasSubmenu = isPreview && savedPeriods.length > 0;
    const submenuExpanded = hasSubmenu && !collapsed && submenuOpen;

    return (
      <div key={item.id}>
        <button
          type="button"
          onClick={() => {
            if (hasSubmenu && !collapsed) {
              if (isActive) {
                setSubmenuOpen((v) => !v);
              } else {
                setSubmenuOpen(true);
                onNavigate(item.id);
              }
            } else {
              onNavigate(item.id);
            }
          }}
          className={`relative flex items-center w-full rounded-lg ${TRANS} focus:outline-none focus-visible:ring-2 focus-visible:ring-cta-500/50 ${
            collapsed ? 'justify-center px-[14px] py-2.5' : 'gap-2.5 px-2.5 py-2'
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
          <span className="flex-shrink-0">{item.icon}</span>
          <span
            className={`text-sm font-medium leading-none text-left overflow-hidden whitespace-nowrap ${TRANS} ${
              collapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[180px] flex-1'
            }`}
          >
            {item.label}
          </span>
          {hasSubmenu && (
            <ChevronRight
              size={14}
              className={`text-sidebar-label flex-shrink-0 ${TRANS} ${
                collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[14px]'
              }`}
              style={{ transform: submenuExpanded && !collapsed ? 'rotate(90deg)' : 'none' }}
              aria-hidden
            />
          )}
        </button>

        {/* Submenu: only render when expanded + we have a select handler.
            Hidden entirely when sidebar collapsed (no horizontal room). */}
        <div
          className={`overflow-hidden ${TRANS} ${
            submenuExpanded && onSelectPeriod ? 'opacity-100 max-h-[400px]' : 'opacity-0 max-h-0'
          }`}
        >
          {onSelectPeriod && (
            <div className="ml-7 mt-0.5 mb-0.5 flex flex-col gap-px">
              {savedPeriods.map((p) => {
                const active = p.key === activePeriodKey;
                const isConfirming = confirmingKey === p.key;
                return (
                  <div
                    key={p.key}
                    className={`group/period relative flex items-center rounded-md transition-colors ${
                      active ? 'bg-sidebar-hover/80' : 'hover:bg-sidebar-hover/40'
                    }`}
                    onMouseLeave={() => {
                      if (isConfirming) setConfirmingKey(null);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPeriod(p.key)}
                      className={`flex-1 text-left text-[12px] leading-none px-2.5 py-1.5 truncate ${
                        active ? 'text-white font-medium' : 'text-sidebar-text group-hover/period:text-white'
                      }`}
                    >
                      {formatPeriodLabel(p)}
                    </button>
                    {onDeletePeriod && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isConfirming) {
                            onDeletePeriod(p.key);
                            setConfirmingKey(null);
                          } else {
                            setConfirmingKey(p.key);
                          }
                        }}
                        className={`flex-shrink-0 flex items-center justify-center mr-1 rounded transition-all duration-150 ${
                          isConfirming
                            ? 'opacity-100 text-red-500 font-bold animate-pulse-confirm px-2'
                            : 'opacity-0 group-hover/period:opacity-100 text-sidebar-label hover:text-white hover:bg-white/10'
                        }`}
                        style={{ height: 22, minWidth: isConfirming ? 'auto' : 18 }}
                        aria-label={
                          isConfirming
                            ? `Xác nhận xoá kỳ ${formatPeriodLabel(p)}`
                            : `Xoá kỳ ${formatPeriodLabel(p)}`
                        }
                        title={isConfirming ? 'Bấm lần nữa để xác nhận xoá' : 'Xoá khỏi danh sách'}
                      >
                        {isConfirming ? (
                          <span className="text-[13px] leading-none tracking-tight whitespace-nowrap">Xoá?</span>
                        ) : (
                          <X size={11} />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`group/sidebar relative flex flex-col flex-shrink-0 h-screen overflow-hidden ${TRANS}`}
      style={{ width: w, background: '#0F172A' }}
    >
      {/* Header — logo + title. Padding animates so the logo stays centered as the sidebar collapses. */}
      <div className={`flex items-center py-5 gap-2.5 ${TRANS} ${collapsed ? 'px-[17px]' : 'px-3.5'}`}>
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg text-white font-bold select-none"
          style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
            fontSize: 15,
          }}
        >
          ₫
        </div>
        <span
          className={`text-white font-semibold text-sm leading-none whitespace-nowrap overflow-hidden ${TRANS} ${
            collapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[140px]'
          }`}
        >
          Phiếu Lương
        </span>
      </div>

      {/* Collapse handle — hover-revealed pull tab at vertical center, right edge */}
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-full bg-[#1E293B] border border-[#334155] text-sidebar-label opacity-0 group-hover/sidebar:opacity-100 hover:text-white hover:bg-cta-500 hover:border-cta-500 transition-opacity duration-150 shadow-md"
          style={{ width: 22, height: 22, right: 6 }}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      )}

      {/* Workspace label — fades out smoothly when collapsing */}
      <div
        className={`px-3.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-sidebar-label whitespace-nowrap overflow-hidden ${TRANS} ${
          collapsed ? 'opacity-0 max-h-0 pb-0' : 'opacity-100 max-h-[24px] pb-2'
        }`}
      >
        BSM Labs
      </div>

      {/* Top nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {TOP_NAV.map(renderNavItem)}
      </nav>

      {/* Bottom nav (pinned) */}
      <nav className="flex flex-col gap-0.5 px-2 pb-4 pt-2 border-t border-[#1E293B]">
        {BOTTOM_NAV.map(renderNavItem)}
      </nav>
    </div>
  );
}
