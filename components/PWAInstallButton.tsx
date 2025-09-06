"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DevicePhoneMobileIcon, 
  ArrowDownTrayIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Using global BeforeInstallPromptEvent type

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                              (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      setIsInstalled(isStandaloneMode);
    };

    // Check if device is iOS
    const checkIOS = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(isIOSDevice);
    };

    // Check if device is desktop
    const checkDesktop = () => {
      const isDesktopDevice = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsDesktop(isDesktopDevice);
    };

    checkStandalone();
    checkIOS();
    checkDesktop();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
    } else if (isIOS) {
      // Show iOS instructions
      setShowIOSInstructions(true);
    } else if (isDesktop) {
      // For desktop browsers, show instructions
      setShowIOSInstructions(true);
    }
  };

  const closeIOSInstructions = () => {
    setShowIOSInstructions(false);
  };

  // Don't show the button if app is already installed
  if (isInstalled || isStandalone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className='p-4 rounded-lg bg-green-500/20 border border-green-500/30'
      >
        <div className='flex items-center space-x-3'>
          <div className='p-2 rounded-full bg-green-500/20'>
            <CheckIcon className='w-5 h-5 text-green-400' />
          </div>
          <div>
            <h3 className='text-lg font-semibold text-white'>App Installed</h3>
            <p className='text-sm text-green-300'>Dorkinians FC Stats is installed on your device</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Don't show the button if neither install prompt, iOS, nor desktop
  if (!deferredPrompt && !isIOS && !isDesktop) {
    return null;
  }

  return (
    <>
      <motion.button
        onClick={handleInstallClick}
        className='w-full p-4 rounded-lg bg-dorkinians-yellow/20 hover:bg-dorkinians-yellow/30 border border-dorkinians-yellow/40 transition-all duration-200 text-left'
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className='flex items-center space-x-4'>
          <div className='p-2 rounded-full bg-dorkinians-yellow/30'>
            {isIOS ? (
              <DevicePhoneMobileIcon className='w-5 h-5 text-dorkinians-yellow' />
            ) : (
              <ArrowDownTrayIcon className='w-5 h-5 text-dorkinians-yellow' />
            )}
          </div>
          <div className='flex-1'>
            <h3 className='text-lg font-semibold text-white'>
              {isIOS ? 'Add to Home Screen' : isDesktop ? 'Install App' : 'Install App'}
            </h3>
            <p className='text-sm text-gray-300'>
              {isIOS 
                ? 'Add Dorkinians FC Stats to your home screen for quick access'
                : isDesktop
                ? 'Install Dorkinians FC Stats as a desktop app for better experience'
                : 'Install Dorkinians FC Stats as a native app on your device'
              }
            </p>
          </div>
          <div className='text-dorkinians-yellow'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
            </svg>
          </div>
        </div>
      </motion.button>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
          onClick={closeIOSInstructions}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className='bg-gray-900 rounded-lg p-6 max-w-md w-full border border-gray-700'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-xl font-bold text-white'>
                {isIOS ? 'Add to Home Screen' : 'Install Desktop App'}
              </h3>
              <button
                onClick={closeIOSInstructions}
                className='p-2 rounded-full hover:bg-gray-700 transition-colors'
              >
                <XMarkIcon className='w-5 h-5 text-gray-400' />
              </button>
            </div>
            
            <div className='space-y-4 text-gray-300'>
              <p className='text-sm'>
                {isIOS 
                  ? 'To add Dorkinians FC Stats to your home screen:'
                  : 'To install Dorkinians FC Stats as a desktop app:'
                }
              </p>
              
              <div className='space-y-3'>
                {isIOS ? (
                  <>
                    <div className='flex items-start space-x-3'>
                      <div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
                        1
                      </div>
                      <p className='text-sm'>Tap the <strong>Share</strong> button at the bottom of your Safari browser</p>
                    </div>
                    
                    <div className='flex items-start space-x-3'>
                      <div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
                        2
                      </div>
                      <p className='text-sm'>Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                    </div>
                    
                    <div className='flex items-start space-x-3'>
                      <div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
                        3
                      </div>
                      <p className='text-sm'>Tap <strong>"Add"</strong> to confirm</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className='flex items-start space-x-3'>
                      <div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
                        1
                      </div>
                      <p className='text-sm'>Look for the <strong>install icon</strong> in your browser's address bar (Chrome: ⊕, Edge: ⊕, Firefox: ⊕)</p>
                    </div>
                    
                    <div className='flex items-start space-x-3'>
                      <div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
                        2
                      </div>
                      <p className='text-sm'>Click the install icon and select <strong>"Install"</strong> when prompted</p>
                    </div>
                    
                    <div className='flex items-start space-x-3'>
                      <div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
                        3
                      </div>
                      <p className='text-sm'>The app will be added to your desktop and can be launched like any other application</p>
                    </div>
                  </>
                )}
              </div>
              
              <div className='mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg'>
                <p className='text-xs text-blue-300'>
                  💡 <strong>Tip:</strong> {isIOS 
                    ? 'The app will appear on your home screen like any other app and work offline!'
                    : 'The app will be added to your desktop and can be launched like any other application with offline support!'
                  }
                </p>
              </div>
            </div>
            
            <div className='mt-6 flex justify-end'>
              <button
                onClick={closeIOSInstructions}
                className='px-4 py-2 bg-dorkinians-yellow text-black rounded-lg font-semibold hover:bg-dorkinians-yellow/90 transition-colors'
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
