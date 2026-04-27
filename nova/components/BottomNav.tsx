import React from 'react';
import { HomeIcon, SearchIcon, PlusSquareIcon, MessagesIcon, MessagesIconFilled, HomeIconFilled, SearchIconFilled } from './icons';
import { useAuth } from '../App';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NavButton: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => (
  <button onClick={onClick} aria-label={label} className="flex-1 p-2 flex justify-center items-center focus:outline-none text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors duration-200">
    {children}
  </button>
);


const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { userProfile } = useAuth();

  const iconSize = "h-7 w-7";
  
  const getIconColor = (tabName: string) => {
    return activeTab === tabName ? 'text-gray-900 dark:text-white' : '';
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 flex justify-around items-center z-50">
      <NavButton label="Home" onClick={() => setActiveTab('home')}>
        {activeTab === 'home' ? <HomeIconFilled className={`${iconSize} ${getIconColor('home')}`} /> : <HomeIcon className={iconSize} />}
      </NavButton>
      <NavButton label="Search" onClick={() => setActiveTab('search')}>
         {activeTab === 'search' ? <SearchIconFilled className={`${iconSize} ${getIconColor('search')}`} /> : <SearchIcon className={iconSize} />}
      </NavButton>
      <NavButton label="Create" onClick={() => setActiveTab('create')}>
        <PlusSquareIcon className={`${iconSize} ${getIconColor('create')}`} />
      </NavButton>
      <NavButton label="Inbox" onClick={() => setActiveTab('inbox')}>
          {activeTab === 'inbox' ? <MessagesIconFilled className={`${iconSize} ${getIconColor('inbox')}`} /> : <MessagesIcon className={iconSize} />}
      </NavButton>
      <NavButton label="Profile" onClick={() => setActiveTab('profile')}>
        <img 
            src={userProfile?.avatar} 
            alt="Profile" 
            className={`w-8 h-8 rounded-full object-cover transition-all ${activeTab === 'profile' ? 'ring-2 ring-gray-800 dark:ring-gray-200 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''}`}
        />
      </NavButton>
    </nav>
  );
};

export default BottomNav;