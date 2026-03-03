import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Copy, Check } from 'lucide-react';
import Confetti from 'react-confetti';
import { Journey, JourneyProgress } from '@/utils/virtualJourneyStorage';
import { useUserProfile } from '@/hooks/useUserProfile';
import { triggerHaptic } from '@/utils/haptics';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

import { shareImageBlob } from '@/utils/shareImage';

interface JourneyCertificateProps {
  open: boolean;
  onClose: () => void;
  journey: Journey;
  progress: JourneyProgress;
}

const JOURNEY_COLORS: Record<string, { bg: string; accent: string; text: string; border: string }> = {
  nile: {
    bg: 'linear-gradient(160deg, hsl(210, 30%, 12%), hsl(200, 40%, 18%))',
    accent: 'hsl(200, 70%, 55%)',
    text: 'hsl(200, 60%, 80%)',
    border: 'hsl(200, 50%, 30%)',
  },
  silk_road: {
    bg: 'linear-gradient(160deg, hsl(30, 30%, 12%), hsl(35, 40%, 18%))',
    accent: 'hsl(40, 85%, 55%)',
    text: 'hsl(40, 60%, 80%)',
    border: 'hsl(40, 50%, 30%)',
  },
  everest: {
    bg: 'linear-gradient(160deg, hsl(180, 25%, 10%), hsl(185, 35%, 16%))',
    accent: 'hsl(172, 66%, 50%)',
    text: 'hsl(172, 50%, 78%)',
    border: 'hsl(172, 40%, 28%)',
  },
  pacific: {
    bg: 'linear-gradient(160deg, hsl(235, 30%, 12%), hsl(240, 40%, 18%))',
    accent: 'hsl(239, 84%, 67%)',
    text: 'hsl(239, 60%, 82%)',
    border: 'hsl(239, 50%, 30%)',
  },
  amazon: {
    bg: 'linear-gradient(160deg, hsl(140, 25%, 10%), hsl(145, 35%, 16%))',
    accent: 'hsl(142, 71%, 45%)',
    text: 'hsl(142, 50%, 78%)',
    border: 'hsl(142, 40%, 25%)',
  },
  space: {
    bg: 'linear-gradient(160deg, hsl(0, 20%, 10%), hsl(350, 30%, 15%))',
    accent: 'hsl(0, 84%, 60%)',
    text: 'hsl(0, 50%, 80%)',
    border: 'hsl(0, 40%, 28%)',
  },
};

const getLinkedInText = (journey: Journey, userName: string, totalTasks: number, totalDays: number) => {
  return `🏆 Journey Complete: ${journey.name}!\n\nI just completed the "${journey.name}" virtual journey on Npd by finishing ${totalTasks} tasks in ${totalDays} days! ${journey.emoji}\n\n${journey.description}\n\nMilestones conquered:\n${journey.milestones.map(m => `${m.icon} ${m.name} (${m.tasksRequired} tasks)`).join('\n')}\n\nProductivity meets adventure! Every task completed brought me closer to the finish line. 🎯\n\n${userName ? `— ${userName}` : ''}\n#Productivity #VirtualJourney #Npd #TaskManagement #Achievement`;
};

export const JourneyCertificate = ({ open, onClose, journey, progress }: JourneyCertificateProps) => {
  const { profile } = useUserProfile();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copiedLinkedIn, setCopiedLinkedIn] = useState(false);
  const [shareConfetti, setShareConfetti] = useState(false);
  const [cardName, setCardName] = useState(profile.name || '');

  const colors = JOURNEY_COLORS[journey.id] || JOURNEY_COLORS.nile;
  const completedDate = progress.completedAt ? format(new Date(progress.completedAt), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy');
  const startedDate = format(new Date(progress.startedAt), 'MMM d, yyyy');
  const totalTasks = journey.milestones.reduce((sum, ms) => sum + ms.tasksRequired, 0);
  const startDate = new Date(progress.startedAt);
  const endDate = progress.completedAt ? new Date(progress.completedAt) : new Date();
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const displayName = cardName.trim();

  useEffect(() => {
    if (open) setCardName(profile.name || '');
  }, [open, profile.name]);

  const handleCopyLinkedIn = useCallback(async () => {
    const text = getLinkedInText(journey, displayName, totalTasks, totalDays);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedLinkedIn(true);
    triggerHaptic('light').catch(() => {});
    setTimeout(() => setCopiedLinkedIn(false), 2000);
  }, [journey, displayName]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setIsSharing(true);
    triggerHaptic('medium').catch(() => {});

    try {
      const element = cardRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scale: Math.max(2, Math.min(window.devicePixelRatio || 2, 4)),
        width: element.offsetWidth,
        height: element.offsetHeight,
        scrollX: 0,
        scrollY: 0,
      });

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        setIsSharing(false);
        return;
      }

      await shareImageBlob({
        blob,
        fileName: `npd-journey-${journey.id}.png`,
        title: `${journey.name} - Journey Complete!`,
        text: getLinkedInText(journey, displayName, totalTasks, totalDays),
        dialogTitle: 'Share Journey Certificate',
      });
      setShareConfetti(true);
      setTimeout(() => setShareConfetti(false), 3500);
    } catch (e) {
      console.error('[JourneyCert] Share failed:', e);
    } finally {
      setIsSharing(false);
    }
  }, [journey, displayName]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto"
      >
        {/* Share confetti */}
        {shareConfetti && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={250}
            gravity={0.3}
            style={{ position: 'fixed', top: 0, left: 0, zIndex: 60 }}
          />
        )}
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)] flex items-center justify-between">
          <h2 className="text-lg font-bold">Journey Certificate</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-w-md mx-auto">
          {/* Certificate Card */}
          <div
            ref={cardRef}
            style={{
              background: colors.bg,
              borderColor: colors.border,
              borderWidth: 2,
              borderStyle: 'solid',
              borderRadius: 16,
              padding: 28,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative corner elements */}
            <div style={{
              position: 'absolute', top: 8, left: 8, width: 40, height: 40,
              borderTop: `2px solid ${colors.accent}`, borderLeft: `2px solid ${colors.accent}`,
              borderRadius: '8px 0 0 0', opacity: 0.5,
            }} />
            <div style={{
              position: 'absolute', top: 8, right: 8, width: 40, height: 40,
              borderTop: `2px solid ${colors.accent}`, borderRight: `2px solid ${colors.accent}`,
              borderRadius: '0 8px 0 0', opacity: 0.5,
            }} />
            <div style={{
              position: 'absolute', bottom: 8, left: 8, width: 40, height: 40,
              borderBottom: `2px solid ${colors.accent}`, borderLeft: `2px solid ${colors.accent}`,
              borderRadius: '0 0 0 8px', opacity: 0.5,
            }} />
            <div style={{
              position: 'absolute', bottom: 8, right: 8, width: 40, height: 40,
              borderBottom: `2px solid ${colors.accent}`, borderRight: `2px solid ${colors.accent}`,
              borderRadius: '0 0 8px 0', opacity: 0.5,
            }} />

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ color: colors.accent, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 }}>
                Certificate of Completion
              </p>
            </div>

            {/* Journey emoji */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 56 }}>{journey.emoji}</span>
            </div>

            {/* Journey name */}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <h3 style={{ color: colors.accent, fontSize: 24, fontWeight: 800, margin: 0 }}>
                {journey.name}
              </h3>
            </div>

            {/* Subtitle */}
            <p style={{ textAlign: 'center', color: colors.text, fontSize: 11, marginBottom: 20, opacity: 0.8 }}>
              {journey.description}
            </p>

            {/* Awarded to - centered in middle */}
            {displayName && (
              <div data-export-profile-row="true" style={{ textAlign: 'center', marginBottom: 16 }}>
                <p style={{ color: colors.text, fontSize: 9, opacity: 0.6, marginBottom: 2 }}>Awarded to</p>
                <p data-export-profile-name="true" style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, display: 'inline-block', paddingBottom: 4, borderBottom: `2px solid ${colors.accent}80` }}>
                  {displayName}
                </p>
              </div>
            )}

            {/* Divider */}
            <div style={{ width: 60, height: 2, background: colors.accent, margin: '0 auto 16px', opacity: 0.5, borderRadius: 1 }} />

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: colors.accent, fontSize: 20, fontWeight: 800, margin: 0 }}>
                  {totalTasks}
                </p>
                <p style={{ color: colors.text, fontSize: 9, opacity: 0.7 }}>Tasks Done</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: colors.accent, fontSize: 20, fontWeight: 800, margin: 0 }}>
                  {journey.milestones.length}
                </p>
                <p style={{ color: colors.text, fontSize: 9, opacity: 0.7 }}>Milestones</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: colors.accent, fontSize: 20, fontWeight: 800, margin: 0 }}>
                  {totalDays}
                </p>
                <p style={{ color: colors.text, fontSize: 9, opacity: 0.7 }}>Days</p>
              </div>
            </div>

            {/* Animated Milestone Timeline */}
            <div style={{ position: 'relative', paddingLeft: 28, marginBottom: 20 }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 10, top: 4, bottom: 4, width: 2,
                background: `linear-gradient(to bottom, ${colors.accent}, ${colors.accent}40)`,
                borderRadius: 1,
              }} />
              {journey.milestones.map((ms, i) => (
                <motion.div
                  key={ms.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: i < journey.milestones.length - 1 ? 10 : 0,
                    position: 'relative',
                  }}
                >
                  {/* Timeline dot */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.15, type: 'spring', stiffness: 300 }}
                    style={{
                      position: 'absolute', left: -22,
                      width: 20, height: 20, borderRadius: '50%',
                      background: colors.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, boxShadow: `0 0 8px ${colors.accent}60`,
                    }}
                  >
                    {ms.icon}
                  </motion.div>
                  {/* Milestone info */}
                  <div style={{ paddingLeft: 6 }}>
                    <p style={{ color: '#ffffff', fontSize: 11, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                      {ms.name}
                    </p>
                    <p style={{ color: colors.text, fontSize: 8, margin: 0, opacity: 0.7 }}>
                      {ms.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Date */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <p style={{ color: colors.text, fontSize: 9, opacity: 0.6 }}>
                {startedDate} — {completedDate}
              </p>
            </div>

            {/* QR Code + Branding */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <div style={{
                background: '#ffffff', borderRadius: 6, padding: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <QRCodeSVG
                  value="https://play.google.com/store/apps/details?id=nota.npd.com"
                  size={64}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div data-export-brand-row="true" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span data-export-brand-name="true" style={{ color: '#ffffff', fontSize: 13, fontWeight: 600 }}>
                    Npd: Notepad & To Do List
                  </span>
                </div>
                <p style={{ color: colors.text, fontSize: 7, opacity: 0.45, margin: 0 }}>
                  Scan to download the app
                </p>
              </div>
            </div>
          </div>

          {/* Name on certificate */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="text-sm font-bold mb-2">Your Name on Certificate</h3>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Enter your name"
              maxLength={40}
              className="w-full text-sm bg-muted rounded-lg px-3 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">This name will appear on the shared certificate image</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              disabled={isSharing}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSharing ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {isSharing ? 'Exporting...' : 'Share Certificate'}
            </motion.button>
          </div>

          {/* LinkedIn Copy */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCopyLinkedIn}
            className="w-full bg-card border rounded-xl p-4 text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">LinkedIn Ready Caption</span>
              {copiedLinkedIn ? (
                <span className="text-xs text-success flex items-center gap-1">
                  <Check className="h-3 w-3" /> Copied!
                </span>
              ) : (
                <span className="text-xs text-primary flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copy
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
              {getLinkedInText(journey, displayName, totalTasks, totalDays)}
            </p>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
