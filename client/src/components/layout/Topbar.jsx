import { Menu } from 'lucide-react';

export default function Topbar({ onToggleSidebar }) {
  return (
    <header className="h-14 bg-white border-b border-grey-200 flex items-center justify-between px-6 sticky top-0 z-40">
      <button onClick={onToggleSidebar} className="lg:hidden p-1.5 rounded-md hover:bg-grey-100 text-grey-500 transition-colors">
        <Menu size={20} />
      </button>
      <div />
    </header>
  );
}
