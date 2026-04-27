import React from 'react';

interface NavItemProps {
  icon?: React.ReactNode;
  customIcon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: boolean;
  badgeText?: string;
  onClick?: () => void;
}

export function NavItem({ 
  icon, 
  customIcon,
  label, 
  active, 
  badge, 
  badgeText,
  onClick
}: NavItemProps) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-1.5 relative group px-1">
      <div className={`flex items-center justify-center transition-all duration-300 ${active ? 'bg-[#c3fbdb] shadow-inner rounded-[18px] w-12 h-8' : 'w-10 h-8 hover:bg-white/50 rounded-xl'}`}>
        {customIcon ? customIcon : icon}
      </div>
      <span className={`text-[9px] font-black tracking-widest ${active ? 'text-[#173e35]' : 'text-slate-500'}`}>
        {label}
      </span>
      {badge && (
        <span className="absolute top-[2px] right-[4px] w-2 h-2 bg-rose-500 rounded-full border border-white shadow-sm"></span>
      )}
      {badgeText && (
        <span className="absolute -top-[5px] right-[-8px] bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-[1px] rounded-full border-[1.5px] border-white shadow-sm whitespace-nowrap z-10 scale-[0.85] origin-bottom-left">
          {badgeText}
        </span>
      )}
    </button>
  );
}
