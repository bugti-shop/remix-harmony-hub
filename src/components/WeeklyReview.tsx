import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, CalendarRange, CheckCircle2, Clock, TrendingUp, 
  TrendingDown, Award, Target, ChevronLeft, ChevronRight,
  Lightbulb, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TodoItem } from '@/types/note';
import { toast } from 'sonner';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';

interface WeeklyReviewProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WeeklyReviewData {
  weekStart: string;
  completedCount: number;
  incompleteCount: number;
  wins: string;
  challenges: string;
  learnings: string;
  nextWeekFocus: string;
  rating: number;
}

export const WeeklyReview = ({ isOpen, onClose }: WeeklyReviewProps) => {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TodoItem[]>([]);
  const [incompleteTasks, setIncompleteTasks] = useState<TodoItem[]>([]);
  const [review, setReview] = useState<WeeklyReviewData | null>(null);
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [learnings, setLearnings] = useState('');
  const [nextWeekFocus, setNextWeekFocus] = useState('');
  const [rating, setRating] = useState(0);

  const getWeekDates = (offset: number) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + (offset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek, end: endOfWeek };
  };

  const { start: weekStart, end: weekEnd } = getWeekDates(weekOffset);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const isCurrentWeek = weekOffset === 0;

  useEffect(() => {
    loadData();
  }, [isOpen, weekOffset]);

  const loadData = async () => {
    const allTasks = await loadTasksFromDB();
    
    const weekTasks = allTasks.filter(t => {
      const taskDate = new Date(t.dueDate || '');
      return taskDate >= weekStart && taskDate <= weekEnd;
    });
    
    setTasks(weekTasks);
    setCompletedTasks(weekTasks.filter(t => t.completed));
    setIncompleteTasks(weekTasks.filter(t => !t.completed));

    const weekKey = weekStart.toISOString().split('T')[0];
    const reviews = await getSetting<WeeklyReviewData[]>('weeklyReviews', []);
    const existingReview = reviews.find(r => r.weekStart === weekKey);
    if (existingReview) {
      setReview(existingReview);
      setWins(existingReview.wins);
      setChallenges(existingReview.challenges);
      setLearnings(existingReview.learnings);
      setNextWeekFocus(existingReview.nextWeekFocus);
      setRating(existingReview.rating);
      return;
    }
    
    setReview(null);
    setWins('');
    setChallenges('');
    setLearnings('');
    setNextWeekFocus('');
    setRating(0);
  };

  const handleSaveReview = async () => {
    const weekKey = weekStart.toISOString().split('T')[0];
    const newReview: WeeklyReviewData = {
      weekStart: weekKey,
      completedCount: completedTasks.length,
      incompleteCount: incompleteTasks.length,
      wins,
      challenges,
      learnings,
      nextWeekFocus,
      rating,
    };

    const reviews = await getSetting<WeeklyReviewData[]>('weeklyReviews', []);
    const existingIdx = reviews.findIndex(r => r.weekStart === weekKey);
    
    if (existingIdx >= 0) {
      reviews[existingIdx] = newReview;
    } else {
      reviews.push(newReview);
    }
    
    await setSetting('weeklyReviews', reviews);
    setReview(newReview);
    toast.success(t('weeklyReview.reviewSaved'));
  };

  const completionRate = tasks.length > 0 
    ? Math.round((completedTasks.length / tasks.length) * 100) 
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{t('weeklyReview.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('weeklyReview.subtitle')}</p>
          </div>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          onClick={() => setWeekOffset(prev => prev - 1)}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className={cn("font-semibold", isCurrentWeek && "text-primary")}>
            {isCurrentWeek ? t('weeklyReview.thisWeek') : weekLabel}
          </p>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </div>
        <button
          onClick={() => setWeekOffset(prev => prev + 1)}
          disabled={weekOffset >= 0}
          className={cn(
            "p-2 hover:bg-muted rounded-lg",
            weekOffset >= 0 && "opacity-50 cursor-not-allowed"
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-md mx-auto space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
              <p className="text-2xl font-bold text-success">{completedTasks.length}</p>
              <p className="text-xs text-muted-foreground">{t('weeklyReview.completed')}</p>
            </div>
            
            <div className="bg-streak/10 border border-streak/30 rounded-xl p-3 text-center">
              <Clock className="h-5 w-5 text-streak mx-auto mb-1" />
              <p className="text-2xl font-bold text-streak">{incompleteTasks.length}</p>
              <p className="text-xs text-muted-foreground">{t('weeklyReview.pending')}</p>
            </div>
            
            <div className={cn(
              "border rounded-xl p-3 text-center",
              completionRate >= 70 
                ? "bg-success/10 border-success/30" 
                : completionRate >= 40 
                ? "bg-warning/10 border-warning/30"
                : "bg-destructive/10 border-destructive/30"
            )}>
              {completionRate >= 70 ? (
                <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
              ) : (
                <TrendingDown className="h-5 w-5 text-streak mx-auto mb-1" />
              )}
              <p className={cn(
                "text-2xl font-bold",
                completionRate >= 70 ? "text-success" : "text-streak"
              )}>{completionRate}%</p>
              <p className="text-xs text-muted-foreground">{t('weeklyReview.complete')}</p>
            </div>
          </div>

          {/* Week Rating */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('weeklyReview.rateYourWeek')}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1"
                >
                  <Star 
                    className={cn(
                      "h-8 w-8 transition-colors",
                      star <= rating 
                        ? "fill-yellow-400 text-yellow-400" 
                        : "text-muted-foreground"
                    )} 
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Reflection Sections */}
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{t('weeklyReview.winsTitle')}</span>
              </div>
              <Textarea
                value={wins}
                onChange={(e) => setWins(e.target.value)}
                placeholder={t('weeklyReview.winsPlaceholder')}
                className="min-h-[80px]"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{t('weeklyReview.challengesTitle')}</span>
              </div>
              <Textarea
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                placeholder={t('weeklyReview.challengesPlaceholder')}
                className="min-h-[80px]"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">{t('weeklyReview.learningsTitle')}</span>
              </div>
              <Textarea
                value={learnings}
                onChange={(e) => setLearnings(e.target.value)}
                placeholder={t('weeklyReview.learningsPlaceholder')}
                className="min-h-[80px]"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">{t('weeklyReview.nextWeekTitle')}</span>
              </div>
              <Textarea
                value={nextWeekFocus}
                onChange={(e) => setNextWeekFocus(e.target.value)}
                placeholder={t('weeklyReview.nextWeekPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <Button onClick={handleSaveReview} className="w-full">
            {t('weeklyReview.saveReview')}
          </Button>

          {/* Completed Tasks List */}
          {completedTasks.length > 0 && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('weeklyReview.completedThisWeek', { count: completedTasks.length })}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {completedTasks.map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span className="line-clamp-1">{task.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default WeeklyReview;
