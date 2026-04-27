export const formatTime = (ts: any) => {
  if (!ts) return 'Just now';
  
  let time: number;
  if (typeof ts === 'number') {
    time = ts;
  } else if (ts && typeof ts === 'object' && 'toDate' in ts) {
    time = ts.toDate().getTime();
  } else if (ts instanceof Date) {
    time = ts.getTime();
  } else {
    return 'Just now';
  }

  const d = new Date(time);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000); // minutes
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return d.toLocaleDateString();
};

export const getGreeting = () => {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 12) return 'Good morning';
  if (currentHour >= 12 && currentHour < 17) return 'Good afternoon';
  if (currentHour >= 17 || currentHour < 5) return 'Good evening';
  return 'Good day'; // fallback
};
