import React, { useState, useEffect } from 'react';

interface ScreenSizeBlockerProps {
    /** Minimum screen width in pixels (default: 1024px) */
    minWidth?: number;
    /** Minimum screen height in pixels (default: 600px) */
    minHeight?: number;
}

/**
 * Blocks the app for users with screens smaller than the specified minimum dimensions.
 * Shows a friendly message explaining the screen size requirement.
 */
const ScreenSizeBlocker: React.FC<ScreenSizeBlockerProps> = ({ 
    minWidth = 1024, 
    minHeight = 600 
}) => {
    const [isBlocked, setIsBlocked] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const checkScreenSize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setDimensions({ width, height });
            setIsBlocked(width < minWidth || height < minHeight);
        };

        // Check on mount
        checkScreenSize();

        // Check on resize
        window.addEventListener('resize', checkScreenSize);
        
        // Also check on orientation change (for mobile devices)
        window.addEventListener('orientationchange', () => {
            // Small delay to allow orientation change to complete
            setTimeout(checkScreenSize, 100);
        });

        return () => {
            window.removeEventListener('resize', checkScreenSize);
            window.removeEventListener('orientationchange', checkScreenSize);
        };
    }, [minWidth, minHeight]);

    if (!isBlocked) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-gray-900 dark:bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md text-center border border-gray-200 dark:border-gray-700">
                <div className="mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                        <svg 
                            className="w-8 h-8 text-yellow-600 dark:text-yellow-400" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                            />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Screen Size Too Small
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                        This application requires a larger screen to provide the best experience.
                    </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <strong>Current screen size:</strong>
                    </p>
                    <p className="text-lg font-mono text-gray-900 dark:text-white">
                        {dimensions.width} × {dimensions.height} px
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                        <strong>Required minimum:</strong> {minWidth} × {minHeight} px
                    </p>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>Please use a device with a larger screen, or resize your browser window.</p>
                    <p className="mt-2">
                        We're working on mobile support and will have it available soon!
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ScreenSizeBlocker;

