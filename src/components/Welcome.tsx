import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import welcomeImage from '@/assets/welcome-notes.png';
import { triggerHaptic } from '@/utils/haptics';

interface WelcomeProps {
  onGetStarted: () => void;
}

export default function Welcome({ onGetStarted }: WelcomeProps) {
  const { t } = useTranslation();
  
  const handleGetStarted = () => {
    triggerHaptic('medium');
    onGetStarted();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 py-12" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 48px)' }}>
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full space-y-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <img
            src={welcomeImage}
            alt="Npd Notes App"
            className="w-[28rem] h-[28rem] object-contain"
          />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center space-y-4"
        >
          <h1 className="text-2xl font-bold text-foreground whitespace-nowrap">
            {t('welcome.startJourney')}
          </h1>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="w-full max-w-md"
      >
        <button
          onClick={handleGetStarted}
          className="w-full btn-duo"
        >
          {t('welcome.getStarted')}
        </button>
      </motion.div>
    </div>
  );
}
