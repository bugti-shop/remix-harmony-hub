import { useState, useEffect, useMemo } from 'react';
import { TodoItem } from '@/types/note';
import { TodoLayout } from './TodoLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Star,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  ArrowRight,
  Save
} from 'lucide-react';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { 
  startOfWeek, 
  endOfWeek, 
  subWeeks, 
  addWeeks,
  format, 
  isWithinInterval, 
  isSameDay,
  startOfDay,
  differenceInDays
} from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface WeeklyReflection {
  weekStart: string;
  wins: string;
  challenges: string;
  improvements: string;
  goals: string;
  rating: number;
}

const WeeklyReview = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [reflection, setReflection] = useState<WeeklyReflection>({
    weekStart: '',
    wins: '',
    challenges: '',
    improvements: '',
    goals: '',
    rating: 0
  });

  const currentWeekStart = useMemo(() => {
    const now = new Date();
    return startOfWeek(subWeeks(now, weekOffset), { weekStartsOn: 1 });
  }, [weekOffset]);

  const currentWeekEnd = useMemo(() => {
    return endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  }, [currentWeekStart]);

  useEffect(() => {
    const loadData = async () => {
      const loadedItems = await loadTodoItems();
      setItems(loadedItems);
    };
    loadData();
  }, []);

  useEffect(() => {
    // Load saved reflection for this week
    const loadReflection = async () => {
      const { getSetting } = await import('@/utils/settingsStorage');
      const weekKey = format(currentWeekStart, 'yyyy-MM-dd');
      const saved = await getSetting<WeeklyReflection | null>(`weeklyReview_${weekKey}`, null);
      if (saved) {
        setReflection(saved);
      } else {
        setReflection({
          weekStart: weekKey,
          wins: '',
          challenges: '',
          improvements: '',
          goals: '',
          rating: 0
        });
      }
    };
    loadReflection();
  }, [currentWeekStart]);

  const weekStats = useMemo(() => {
    const weekInterval = { start: currentWeekStart, end: currentWeekEnd };
    
    const tasksThisWeek = items.filter(task => {
      if (!task.dueDate) return false;
      return isWithinInterval(new Date(task.dueDate), weekInterval);
    });

    const completed = tasksThisWeek.filter(t => t.completed);
    const pending = tasksThisWeek.filter(t => !t.completed);
    const highPriority = completed.filter(t => t.priority === 'high');
    const recurring = completed.filter(t => t.repeatType && t.repeatType !== 'none');

    // Group by day
    const dailyBreakdown: { date: Date; completed: number; total: number }[] = [];
    for (let d = new Date(currentWeekStart); d <= currentWeekEnd; d = addWeeks(d, 0)) {
      const dayTasks = tasksThisWeek.filter(t => 
        t.dueDate && isSameDay(new Date(t.dueDate), d)
      );
      dailyBreakdown.push({
        date: new Date(d),
        completed: dayTasks.filter(t => t.completed).length,
        total: dayTasks.length
      });
      d.setDate(d.getDate() + 1);
    }

    // Calculate streak
    let streak = 0;
    for (let i = dailyBreakdown.length - 1; i >= 0; i--) {
      if (dailyBreakdown[i].completed > 0) {
        streak++;
      } else {
        break;
      }
    }

    const completionRate = tasksThisWeek.length > 0 
      ? Math.round((completed.length / tasksThisWeek.length) * 100) 
      : 0;

    return {
      total: tasksThisWeek.length,
      completed: completed.length,
      pending: pending.length,
      highPriority: highPriority.length,
      recurring: recurring.length,
      completionRate,
      streak,
      dailyBreakdown,
      completedTasks: completed
    };
  }, [items, currentWeekStart, currentWeekEnd]);

  const handleSaveReflection = async () => {
    const { setSetting } = await import('@/utils/settingsStorage');
    const weekKey = format(currentWeekStart, 'yyyy-MM-dd');
    await setSetting(`weeklyReview_${weekKey}`, {
      ...reflection,
      weekStart: weekKey
    });
    toast.success(t('weeklyReview.reflectionSaved'));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setWeekOffset(prev => prev + 1);
    } else if (weekOffset > 0) {
      setWeekOffset(prev => prev - 1);
    }
  };

  const dayNames = [
    t('weeklyReview.days.mon'),
    t('weeklyReview.days.tue'),
    t('weeklyReview.days.wed'),
    t('weeklyReview.days.thu'),
    t('weeklyReview.days.fri'),
    t('weeklyReview.days.sat'),
    t('weeklyReview.days.sun')
  ];

  return (
    <TodoLayout title={t('nav.weeklyReview')}>
      <ScrollArea className="h-[calc(100vh-140px)]">
        <main className="container mx-auto px-4 py-6 pb-32">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h2 className="text-lg font-semibold">
                  {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
                </h2>
                {weekOffset === 0 && (
                  <Badge variant="secondary" className="mt-1">{t('common.thisWeek')}</Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigateWeek('next')}
                disabled={weekOffset === 0}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gradient-to-br from-success/10 to-success/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm font-medium">{t('weeklyReview.completed')}</span>
                  </div>
                  <div className="text-3xl font-bold">{weekStats.completed}</div>
                  <p className="text-xs text-muted-foreground">{t('weeklyReview.ofTasks', { count: weekStats.total })}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{t('weeklyReview.rate')}</span>
                  </div>
                  <div className="text-3xl font-bold">{weekStats.completionRate}%</div>
                  <Progress value={weekStats.completionRate} className="mt-2 h-1.5" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-5 w-5 text-streak" />
                    <span className="text-sm font-medium">{t('weeklyReview.streak')}</span>
                  </div>
                  <div className="text-3xl font-bold">{weekStats.streak}</div>
                  <p className="text-xs text-muted-foreground">{t('weeklyReview.daysActive')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-warning" />
                    <span className="text-sm font-medium">{t('weeklyReview.highPriority')}</span>
                  </div>
                  <div className="text-3xl font-bold">{weekStats.highPriority}</div>
                  <p className="text-xs text-muted-foreground">{t('weeklyReview.completedLabel')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Daily Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('weeklyReview.dailyActivity')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between gap-1">
                  {weekStats.dailyBreakdown.map((day, idx) => (
                    <div key={idx} className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground mb-1">{dayNames[idx]}</div>
                      <div 
                        className={`h-12 rounded-md flex items-end justify-center ${
                          day.completed > 0 
                            ? 'bg-primary/20' 
                            : 'bg-muted'
                        }`}
                      >
                        {day.completed > 0 && (
                          <div 
                            className="w-full bg-primary rounded-md transition-all"
                            style={{ 
                              height: `${day.total > 0 ? (day.completed / day.total) * 100 : 0}%`,
                              minHeight: day.completed > 0 ? '8px' : '0'
                            }}
                          />
                        )}
                      </div>
                      <div className="text-xs mt-1 font-medium">{day.completed}/{day.total}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Completed Tasks */}
            {weekStats.completedTasks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-warning" />
                    {t('weeklyReview.achievements')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {weekStats.completedTasks.slice(0, 10).map(task => (
                      <div key={task.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        <span className="truncate">{task.text}</span>
                        {task.priority === 'high' && (
                          <Badge variant="destructive" className="text-[10px] px-1">{t('tasks.priority.high')}</Badge>
                        )}
                      </div>
                    ))}
                    {weekStats.completedTasks.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{weekStats.completedTasks.length - 10} {t('weeklyReview.more')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reflection Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {t('weeklyReview.reflection')}
                </CardTitle>
                <CardDescription>{t('weeklyReview.reflectionDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rating */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('weeklyReview.howWasWeek')}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(rating => (
                      <Button
                        key={rating}
                        variant={reflection.rating === rating ? "default" : "outline"}
                        size="icon"
                        onClick={() => setReflection(prev => ({ ...prev, rating }))}
                      >
                        <Star className={`h-4 w-4 ${reflection.rating >= rating ? 'fill-current' : ''}`} />
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">🎉 {t('weeklyReview.wins')}</label>
                  <Textarea
                    placeholder={t('weeklyReview.winsPlaceholder')}
                    value={reflection.wins}
                    onChange={(e) => setReflection(prev => ({ ...prev, wins: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">🤔 {t('weeklyReview.challenges')}</label>
                  <Textarea
                    placeholder={t('weeklyReview.challengesPlaceholder')}
                    value={reflection.challenges}
                    onChange={(e) => setReflection(prev => ({ ...prev, challenges: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">💡 {t('weeklyReview.improvements')}</label>
                  <Textarea
                    placeholder={t('weeklyReview.improvementsPlaceholder')}
                    value={reflection.improvements}
                    onChange={(e) => setReflection(prev => ({ ...prev, improvements: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">🎯 {t('weeklyReview.goals')}</label>
                  <Textarea
                    placeholder={t('weeklyReview.goalsPlaceholder')}
                    value={reflection.goals}
                    onChange={(e) => setReflection(prev => ({ ...prev, goals: e.target.value }))}
                    rows={2}
                  />
                </div>

                <Button onClick={handleSaveReflection} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {t('weeklyReview.saveReflection')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </ScrollArea>
    </TodoLayout>
  );
};

export default WeeklyReview;
