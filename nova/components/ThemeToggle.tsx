import React from 'react';
import { useTheme } from '../App';
import { SunIcon, MoonIcon } from './icons';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
            <button
                onClick={theme === 'dark' ? toggleTheme : undefined}
                className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}
                aria-label="Switch to light theme"
            >
                <SunIcon className="h-5 w-5" />
            </button>
            <button
                onClick={theme === 'light' ? toggleTheme : undefined}
                className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-gray-800 text-sky-400 shadow-sm' : 'text-gray-500'}`}
                aria-label="Switch to dark theme"
            >
                <MoonIcon className="h-5 w-5" />
            </button>
        </div>
    );
};

export default ThemeToggle;