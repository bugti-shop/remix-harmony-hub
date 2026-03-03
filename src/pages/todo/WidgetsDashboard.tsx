import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@/types/note';
import { TodoLayout } from './TodoLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  Target,
  Flame,
  ListTodo,
  Repeat,
  MapPin,
  Flag,
  Timer,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { 
  isToday, 
  isTomorrow, 
  isThisWeek, 
  isBefore, 
  startOfDay, 
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval
} from 'date-fns';

const WidgetsDashboard = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TodoItem[]>([]);
  const today = startOfDay(new Date());

  useEffect(() => {
    const loadData = async () => {
      const loadedItems = await loadTodoItems();
      setItems(loadedItems);
    };
    loadData();

    const handleTasksUpdate = () => loadData();
    window.addEventListener('tasksUpdated', handleTasksUpdate);
    return () => window.removeEventListener('tasksUpdated', handleTasksUpdate);
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = items.filter(t => 
      !t.completed && t.dueDate && isBefore(new Date(t.dueDate), today)
    ).length;
    
    const todayTasks = items.filter(t => t.dueDate && isToday(new Date(t.dueDate)));
    const todayCompleted = todayTasks.filter(t => t.completed).length;
    const todayPending = todayTasks.length - todayCompleted;
    
    const tomorrowTasks = items.filter(t => 
      !t.completed && t.dueDate && isTomorrow(new Date(t.dueDate))
    ).length;
    
    const thisWeekTasks = items.filter(t => 
      !t.completed && t.dueDate && isThisWeek(new Date(t.dueDate))
    ).length;
    
    const highPriority = items.filter(t => !t.completed && t.priority === 'high').length;
    const mediumPriority = items.filter(t => !t.completed && t.priority === 'medium').length;
    const lowPriority = items.filter(t => !t.completed && t.priority === 'low').length;
    
    const recurring = items.filter(t => t.repeatType && t.repeatType !== 'none').length;
    const withLocation = 0;
    const withReminders = items.filter(t => t.reminderTime).length;
    const withSubtasks = items.filter(t => t.subtasks && t.subtasks.length > 0).length;

    // Weekly activity
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    const weeklyActivity = weekDays.map(day => {
      const dayTasks = items.filter(t => 
        t.dueDate && format(new Date(t.dueDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      return {
        day: format(day, 'EEE'),
        date: day,
        total: dayTasks.length,
        completed: dayTasks.filter(t => t.completed).length
      };
    });

    // Last 7 days completion trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayTasks = items.filter(t => 
        t.dueDate && format(new Date(t.dueDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      return {
        date,
        completed: dayTasks.filter(t => t.completed).length,
        total: dayTasks.length
      };
    });

    // Calculate streak
    const completedDates = items
      .filter(t => t.completed && t.dueDate)
      .map(t => startOfDay(new Date(t.dueDate!)).getTime())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => b - a);
    
    let streak = 0;
    let currentDate = startOfDay(new Date()).getTime();
    for (const date of completedDates) {
      if (date === currentDate || date === currentDate - 86400000) {
        streak++;
        currentDate = date - 86400000;
      } else {
        break;
      }
    }

    // Completion rate (last 7 days)
    const recentTasks = items.filter(t => {
      if (!t.dueDate) return false;
      const taskDate = new Date(t.dueDate);
      return taskDate >= subDays(today, 7) && taskDate <= today;
    });
    const recentCompleted = recentTasks.filter(t => t.completed).length;
    const completionRate = recentTasks.length > 0 
      ? Math.round((recentCompleted / recentTasks.length) * 100) 
      : 0;

    return {
      total,
      completed,
      pending,
      overdue,
      todayTasks: todayTasks.length,
      todayCompleted,
      todayPending,
      tomorrowTasks,
      thisWeekTasks,
      highPriority,
      mediumPriority,
      lowPriority,
      recurring,
      withLocation,
      withReminders,
      withSubtasks,
      streak,
      completionRate,
      weeklyActivity,
      last7Days
    };
  }, [items, today]);

  const priorityDistribution = useMemo(() => {
    const total = stats.highPriority + stats.mediumPriority + stats.lowPriority;
    if (total === 0) return { high: 0, medium: 0, low: 0 };
    return {
      high: Math.round((stats.highPriority / total) * 100),
      medium: Math.round((stats.mediumPriority / total) * 100),
      low: Math.round((stats.lowPriority / total) * 100)
    };
  }, [stats]);

  return (
    <TodoLayout title={t('dashboard.title')}>
      <ScrollArea className="h-[calc(100vh-140px)]">
        <main className="container mx-auto px-4 py-6 pb-32">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              <StatBox icon={<ListTodo className="h-4 w-4" />} value={stats.pending} label={t('dashboard.pending')} color="text-info bg-info/10" />
              <StatBox icon={<CheckCircle2 className="h-4 w-4" />} value={stats.completed} label={t('dashboard.done')} color="text-success bg-success/10" />
              <StatBox icon={<AlertTriangle className="h-4 w-4" />} value={stats.overdue} label={t('dashboard.overdue')} color="text-destructive bg-destructive/10" />
              <StatBox icon={<Flame className="h-4 w-4" />} value={stats.streak} label={t('dashboard.streak')} color="text-streak bg-streak/10" />
            </div>

            {/* Today's Progress */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t('dashboard.todaysProgress')}</span>
                  </div>
                  <Badge variant="secondary">{stats.todayCompleted}/{stats.todayTasks}</Badge>
                </div>
                <Progress 
                  value={stats.todayTasks > 0 ? (stats.todayCompleted / stats.todayTasks) * 100 : 0} 
                  className="h-3"
                />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{stats.todayPending} {t('dashboard.remaining')}</span>
                  <span>{stats.todayTasks > 0 ? Math.round((stats.todayCompleted / stats.todayTasks) * 100) : 0}% {t('dashboard.complete')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Activity Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t('dashboard.weeklyActivity')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between items-end h-24 gap-1">
                  {stats.weeklyActivity.map((day, idx) => {
                    const maxTasks = Math.max(...stats.weeklyActivity.map(d => d.total), 1);
                    const height = (day.total / maxTasks) * 100;
                    const completedHeight = day.total > 0 ? (day.completed / day.total) * height : 0;
                    const isCurrentDay = isToday(day.date);
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div className="w-full h-16 flex flex-col justify-end relative">
                          <div 
                            className="w-full bg-muted rounded-t-sm"
                            style={{ height: `${height}%` }}
                          />
                          <div 
                            className="w-full bg-primary rounded-t-sm absolute bottom-0"
                            style={{ height: `${completedHeight}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-xs mt-1",
                          isCurrentDay ? "font-bold text-primary" : "text-muted-foreground"
                        )}>
                          {day.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-muted rounded" />
                    <span className="text-muted-foreground">{t('dashboard.total')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-primary rounded" />
                    <span className="text-muted-foreground">{t('dashboard.completed')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 7-Day Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  {t('dashboard.completionTrend')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-1 h-12">
                  {stats.last7Days.map((day, idx) => {
                    const rate = day.total > 0 ? (day.completed / day.total) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className={cn(
                            "w-full rounded-sm transition-all",
                            rate === 100 ? "bg-success" :
                            rate >= 50 ? "bg-warning" :
                            rate > 0 ? "bg-streak" : "bg-muted"
                          )}
                          style={{ height: `${Math.max(rate, 10)}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {format(day.date, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{stats.completionRate}% {t('dashboard.completionRate')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  {t('dashboard.priorityDistribution')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <PriorityBar 
                    label={t('dashboard.high')} 
                    count={stats.highPriority} 
                    percent={priorityDistribution.high}
                    color="bg-destructive"
                  />
                  <PriorityBar 
                    label={t('dashboard.medium')} 
                    count={stats.mediumPriority} 
                    percent={priorityDistribution.medium}
                    color="bg-streak"
                  />
                  <PriorityBar 
                    label={t('dashboard.low')} 
                    count={stats.lowPriority} 
                    percent={priorityDistribution.low}
                    color="bg-success"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Overview */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="h-5 w-5 mx-auto text-info mb-2" />
                  <div className="text-2xl font-bold">{stats.tomorrowTasks}</div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.tomorrow')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="h-5 w-5 mx-auto text-accent-purple mb-2" />
                  <div className="text-2xl font-bold">{stats.thisWeekTasks}</div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.thisWeek')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Task Features */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('dashboard.taskInsights')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <InsightItem icon={<Repeat className="h-4 w-4" />} value={stats.recurring} label={t('dashboard.recurring')} />
                  <InsightItem icon={<Clock className="h-4 w-4" />} value={stats.withReminders} label={t('dashboard.withReminders')} />
                  <InsightItem icon={<MapPin className="h-4 w-4" />} value={stats.withLocation} label={t('dashboard.locationBased')} />
                  <InsightItem icon={<ListTodo className="h-4 w-4" />} value={stats.withSubtasks} label={t('dashboard.withSubtasks')} />
                </div>
              </CardContent>
            </Card>

            {/* Overall Stats */}
            <Card className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-1">{stats.total}</div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.totalTasksManaged')}</p>
                  <div className="flex justify-center gap-4 mt-3">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-success">{stats.completed}</div>
                      <p className="text-xs text-muted-foreground">{t('dashboard.completed')}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-info">{stats.pending}</div>
                      <p className="text-xs text-muted-foreground">{t('dashboard.pending')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </ScrollArea>
    </TodoLayout>
  );
};

const StatBox = ({ 
  icon, 
  value, 
  label, 
  color 
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string;
  color: string;
}) => (
  <Card className="bg-card/50">
    <CardContent className="p-2 text-center">
      <div className={cn("rounded-full p-1.5 w-fit mx-auto mb-1", color)}>
        {icon}
      </div>
      <div className="text-lg font-bold">{value}</div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

const PriorityBar = ({ 
  label, 
  count, 
  percent, 
  color 
}: { 
  label: string; 
  count: number; 
  percent: number; 
  color: string;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span>{label}</span>
      <span className="text-muted-foreground">{count} ({percent}%)</span>
    </div>
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${percent}%` }} />
    </div>
  </div>
);

const InsightItem = ({ 
  icon, 
  value, 
  label 
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string;
}) => (
  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
    <div className="text-primary">{icon}</div>
    <div>
      <div className="text-sm font-medium">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  </div>
);

export default WidgetsDashboard;
