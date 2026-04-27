import React from 'react';
import { Users } from 'lucide-react';

export function GamesTab() {
  const games = [
    { title: 'Neon Racing', players: '12k', img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80' },
    { title: 'Space Explorer', players: '8k', img: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?w=400&q=80' },
    { title: 'Cyber City', players: '5.4k', img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80' },
    { title: 'Fantasy Quest', players: '1.2m', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80' }
  ];

  return (
    <div className="animate-slide-up pb-10 md:max-w-2xl md:mx-auto md:w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[26px] font-extrabold text-slate-900 tracking-tight">Mini Games</h2>
        <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">Play Now</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {games.map((g, i) => (
          <div key={i} className="group relative bg-white/80 backdrop-blur-xl rounded-[24px] p-2 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60 cursor-pointer hover:scale-[1.02] transition-transform">
            <div className="relative rounded-[16px] overflow-hidden aspect-[4/5] bg-slate-100">
              <img src={g.img} alt={g.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-white font-bold text-[15px] leading-tight mb-1">{g.title}</h3>
                <div className="flex items-center gap-1.5 text-white/80 text-[11px] font-medium">
                  <Users className="w-3 h-3" /> {g.players} active
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
