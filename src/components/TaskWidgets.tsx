import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@/types/note';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  Target,
  Flame,
  ListTodo,
  Timer,
  Star,
  Repeat,
  MapPin,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isToday, isTomorrow, isThisWeek, isBefore, startOfDay, differenceInDays, format } from 'date-fns';

interface TaskWidgetsProps {
  tasks: TodoItem[];
  compact?: boolean;
}

export const TaskWidgets = ({ tasks, compact = false }: TaskWidgetsProps) => {
  const { t } = useTranslation();
  const today = startOfDay(new Date());
  
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => 
      !t.completed && t.dueDate && isBefore(new Date(t.dueDate), today)
    ).length;
    const todayTasks = tasks.filter(t => 
      t.dueDate && isToday(new Date(t.dueDate))
    );
    const todayCompleted = todayTasks.filter(t => t.completed).length;
    const todayPending = todayTasks.length - todayCompleted;
    const tomorrowTasks = tasks.filter(t => 
      !t.completed && t.dueDate && isTomorrow(new Date(t.dueDate))
    ).length;
    const thisWeekTasks = tasks.filter(t => 
      !t.completed && t.dueDate && isThisWeek(new Date(t.dueDate))
    ).length;
    const highPriority = tasks.filter(t => !t.completed && t.priority === 'high').length;
    const recurring = tasks.filter(t => t.repeatType && t.repeatType !== 'none').length;
    const withLocation = tasks.filter(t => t.locationReminder?.enabled).length;
    const withReminders = tasks.filter(t => t.reminderTime).length;
    
    // Calculate streak (consecutive days with completed tasks)
    // Use dueDate for completed tasks as proxy for completion date
    const completedDates = tasks
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
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentTasks = tasks.filter(t => {
      const createdDate = new Date(parseInt(t.id) || Date.now());
      return createdDate >= sevenDaysAgo;
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
      recurring,
      withLocation,
      withReminders,
      streak,
      completionRate
    };
  }, [tasks, today]);

  // Calculate next due task
  const nextDueTask = useMemo(() => {
    const upcoming = tasks
      .filter(t => !t.completed && t.dueDate && new Date(t.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    return upcoming[0];
  }, [tasks, today]);

  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-2">
        <MiniWidget 
          icon={<ListTodo className="h-4 w-4" />} 
          value={stats.pending} 
          label={t('taskWidgets.pending')}
          color="text-info"
        />
        <MiniWidget 
          icon={<CheckCircle2 className="h-4 w-4" />} 
          value={stats.completed} 
          label={t('taskWidgets.done')}
          color="text-success"
        />
        <MiniWidget 
          icon={<AlertTriangle className="h-4 w-4" />} 
          value={stats.overdue} 
          label={t('taskWidgets.overdue')}
          color="text-destructive"
        />
        <MiniWidget 
          icon={<Flame className="h-4 w-4" />} 
          value={stats.streak} 
          label={t('taskWidgets.streak')}
          color="text-streak"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today's Progress */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-xs">{t('taskWidgets.today')}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.todayCompleted}/{stats.todayTasks}</div>
            <p className="text-xs text-muted-foreground">{t('taskWidgets.tasksCompletedToday')}</p>
            {stats.todayTasks > 0 && (
              <Progress 
                value={(stats.todayCompleted / stats.todayTasks) * 100} 
                className="mt-2 h-1.5"
              />
            )}
          </CardContent>
        </Card>

        {/* Streak Card */}
         <Card className="bg-gradient-to-br from-streak/10 to-streak/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Flame className="h-5 w-5 text-streak" />
              <Badge variant="secondary" className="text-xs">{t('taskWidgets.streak')}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.streak}</div>
            <p className="text-xs text-muted-foreground">
              {stats.streak === 1 ? t('taskWidgets.dayInARow') : t('taskWidgets.daysInARow')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overview Row */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard 
          icon={<ListTodo className="h-4 w-4" />}
          value={stats.pending}
          label={t('taskWidgets.pending')}
          color="bg-info/10 text-info"
        />
        <StatCard 
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={stats.completed}
          label={t('taskWidgets.done')}
          color="bg-success/10 text-success"
        />
        <StatCard 
          icon={<AlertTriangle className="h-4 w-4" />}
          value={stats.overdue}
          label={t('taskWidgets.overdue')}
          color="bg-destructive/10 text-destructive"
        />
        <StatCard 
          icon={<Flag className="h-4 w-4" />}
          value={stats.highPriority}
          label={t('taskWidgets.high')}
          color="bg-streak/10 text-streak"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
            <div className="text-lg font-bold">{stats.completionRate}%</div>
            <p className="text-[10px] text-muted-foreground">{t('taskWidgets.sevenDayRate')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <Repeat className="h-4 w-4 mx-auto text-accent-purple mb-1" />
            <div className="text-lg font-bold">{stats.recurring}</div>
            <p className="text-[10px] text-muted-foreground">{t('taskWidgets.recurring')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-accent-teal mb-1" />
            <div className="text-lg font-bold">{stats.withReminders}</div>
            <p className="text-[10px] text-muted-foreground">{t('taskWidgets.reminders')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Due Task */}
      {nextDueTask && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span>{t('taskWidgets.nextUp')}</span>
            </div>
            <p className="font-medium text-sm truncate">{nextDueTask.text}</p>
            {nextDueTask.dueDate && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(nextDueTask.dueDate), 'MMM d, h:mm a')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Summary */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('taskWidgets.upcomingOverview')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('taskWidgets.tomorrow')}</span>
              <Badge variant={stats.tomorrowTasks > 0 ? "default" : "secondary"}>
                {stats.tomorrowTasks} {t('taskWidgets.tasks')}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('taskWidgets.thisWeek')}</span>
              <Badge variant={stats.thisWeekTasks > 0 ? "default" : "secondary"}>
                {stats.thisWeekTasks} {t('taskWidgets.tasks')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ 
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

const MiniWidget = ({ 
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
  <div className="flex flex-col items-center p-2 rounded-lg bg-card/50">
    <div className={cn("mb-1", color)}>{icon}</div>
    <span className="text-sm font-bold">{value}</span>
    <span className="text-[9px] text-muted-foreground">{label}</span>
  </div>
);

export default TaskWidgets;
