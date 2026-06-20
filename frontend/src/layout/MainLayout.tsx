import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Home20Regular,
  ChartMultiple20Regular,
  People20Regular,
  Map20Regular,
  Info20Regular,
  Settings20Regular,
  ArrowUpload20Regular,
  Search20Regular,
  HomePerson20Regular,
  Delete20Regular
} from '@fluentui/react-icons';

export default function MainLayout() {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Trang chủ', icon: <Home20Regular /> },
    { path: '/dashboard', label: 'Tổng quan', icon: <ChartMultiple20Regular /> },
  ];

  const residentItems = [
    { path: '/residents', label: 'Danh sách cư dân', icon: <People20Regular /> },
    { path: '/households', label: 'Danh sách Hộ gia đình', icon: <HomePerson20Regular /> },
    { path: '/map', label: 'Bản đồ cư dân', icon: <Map20Regular /> },
  ];

  const orgItems = [
    { path: '/districts', label: 'Quận / Huyện', icon: <Map20Regular /> },
    { path: '/wards', label: 'Phường / Xã', icon: <Map20Regular /> },
    { path: '/neighborhoods', label: 'Tổ dân phố', icon: <Map20Regular /> },
    { path: '/help', label: 'Hướng dẫn', icon: <Info20Regular /> },
  ];

  const adminItems = [
    { path: '/admin', label: 'Quản trị', icon: <Settings20Regular /> },
    { path: '/import', label: 'Import dữ liệu', icon: <ArrowUpload20Regular /> },
    { path: '/deletion-history', label: 'Lịch sử xóa', icon: <Delete20Regular /> },
  ];

  const renderLink = (item: { path: string; label: string; icon: JSX.Element }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-blue-50 text-blue-700 shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Layout */}
      <aside className="w-64 bg-white border-r flex flex-col shadow-sm select-none z-20">
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              ST
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm leading-tight">Sơn Trà</h2>
              <p className="text-[10px] text-gray-400 leading-none">Hệ thống QL Dân cư & Tổ DP</p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="mt-4 relative">
            <input
              type="text"
              disabled
              placeholder="Tìm kiếm..."
              className="w-full bg-gray-100 border border-gray-200 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none cursor-not-allowed text-gray-400"
            />
            <Search20Regular className="absolute left-2.5 top-2 text-gray-400 w-3.5 h-3.5" />
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {/* Main Links */}
          <div className="space-y-1">
            {menuItems.map(renderLink)}
          </div>

          {/* CƯ DÂN */}
          <div className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Cư dân
            </h3>
            {residentItems.map(renderLink)}
          </div>

          {/* TỔ CHỨC */}
          <div className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Tổ chức
            </h3>
            {orgItems.map(renderLink)}
          </div>

          {/* QUẢN TRỊ */}
          <div className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Quản trị
            </h3>
            {adminItems.map(renderLink)}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t bg-gray-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
            CB
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">Dân cư QL</p>
            <p className="text-[10px] text-gray-400 truncate">Cán bộ địa chính</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />
      </main>
    </div>
  );
}
