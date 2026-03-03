import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Target, Check, Plus, Trash2, Edit2, Clock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  WeeklyGoalsData,
  WeeklyGoal,
  loadWeeklyGoals,
  updateGoalTarget,
  addCustomGoal,
  removeGoal,
  getWeekProgress,
  getDaysRemainingInWeek,
} from '@/utils/weeklyGoalsStorage';

export const WeeklyGoals = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<WeeklyGoalsData | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('10');
  const [editTarget, setEditTarget] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const goalsData = await loadWeeklyGoals();
      setData(goalsData);
    };
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('weeklyGoalsUpdated', handleUpdate);
    return () => window.removeEventListener('weeklyGoalsUpdated', handleUpdate);
  }, []);

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim() || !newGoalTarget) return;
    await addCustomGoal(newGoalTitle.trim(), parseInt(newGoalTarget) || 10);
    setNewGoalTitle('');
    setNewGoalTarget('10');
    setIsAddingGoal(false);
  };

  const handleUpdateTarget = async (goalId: string) => {
    const target = parseInt(editTarget) || 1;
    await updateGoalTarget(goalId, target);
    setEditingGoalId(null);
  };

  const handleRemoveGoal = async (goalId: string) => {
    await removeGoal(goalId);
  };

  if (!data) return null;

  const progress = getWeekProgress(data);
  const daysRemaining = getDaysRemainingInWeek();
  const allCompleted = progress.completed === progress.total;

  const getGoalIcon = (type: WeeklyGoal['type']) => {
    switch (type) {
      case 'tasks': return '✅';
      case 'streak_days': return '🔥';
      case 'xp': return '⭐';
      default: return '🎯';
    }
  };

  const getGoalUnit = (type: WeeklyGoal['type']) => {
    switch (type) {
      case 'tasks': return t('goals.tasks', 'tasks');
      case 'streak_days': return t('goals.days', 'days');
      case 'xp': return 'XP';
      default: return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold">{t('goals.weeklyTitle', 'Weekly Goals')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{daysRemaining} {t('goals.daysLeft', 'days left')}</span>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {t('goals.weekProgress', 'Week Progress')}
          </span>
          <span className="text-sm text-muted-foreground">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.percent}%` }}
            className={cn(
              "h-2 rounded-full transition-colors",
              allCompleted ? "bg-success" : "bg-accent-indigo"
            )}
          />
        </div>
        {data.completedWeeks > 0 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Trophy className="h-3 w-3 text-warning" />
            <span>{data.completedWeeks} {t('goals.weeksCompleted', 'weeks completed')}</span>
          </div>
        )}
      </div>

      {/* Goals List */}
      <div className="space-y-3">
        {data.goals.map((goal) => (
          <motion.div
            key={goal.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "p-3 rounded-lg border-2 transition-all",
              goal.completed
                ? "bg-success/10 border-success/30"
                : "bg-muted/30 border-transparent"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0",
                goal.completed ? "bg-success" : "bg-muted"
              )}>
                {goal.completed ? <Check className="h-5 w-5 text-white" /> : getGoalIcon(goal.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={cn(
                    "font-medium text-sm",
                    goal.completed && "line-through text-muted-foreground"
                  )}>
                    {goal.title}
                  </h4>
                  <div className="flex items-center gap-1">
                    {editingGoalId === goal.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editTarget}
                          onChange={(e) => setEditTarget(e.target.value)}
                          className="w-16 h-6 text-xs"
                          min="1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleUpdateTarget(goal.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingGoalId(goal.id);
                            setEditTarget(goal.target.toString());
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        {goal.type === 'custom' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleRemoveGoal(goal.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{goal.current} / {goal.target} {getGoalUnit(goal.type)}</span>
                    <span>{Math.round((goal.current / goal.target) * 100)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                      className={cn(
                        "h-1.5 rounded-full",
                        goal.completed ? "bg-success" : "bg-accent-indigo"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Goal Form */}
      <AnimatePresence>
        {isAddingGoal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2"
          >
            <Input
              placeholder={t('goals.goalTitle', 'Goal title...')}
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              className="h-8"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t('goals.target', 'Target')}
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                className="h-8 w-24"
                min="1"
              />
              <Button
                size="sm"
                className="flex-1 h-8"
                onClick={handleAddGoal}
                disabled={!newGoalTitle.trim()}
              >
                {t('goals.add', 'Add Goal')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setIsAddingGoal(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Goal Button */}
      {!isAddingGoal && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3"
          onClick={() => setIsAddingGoal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('goals.addCustom', 'Add Custom Goal')}
        </Button>
      )}

      {/* All Completed Celebration */}
      {allCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg text-center"
        >
          <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            {t('goals.allComplete', 'All weekly goals completed! 🎉')}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
