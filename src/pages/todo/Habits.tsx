import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { Plus, Flame, Trophy, Target, Trash2, BarChart3, Check, ChevronLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { Habit, HabitFrequency } from '@/types/habit';
import { loadHabits, saveHabit, deleteHabit, calculateStreak, getCompletionRate, getWeeklyChartData } from '@/utils/habitStorage';

import { triggerHaptic } from '@/utils/haptics';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

const HABIT_COLORS = [
  'hsl(220, 85%, 59%)', // primary blue
  'hsl(142, 71%, 45%)', // green
  'hsl(25, 95%, 53%)',  // orange
  'hsl(330, 80%, 60%)', // pink
  'hsl(262, 80%, 60%)', // purple
  'hsl(45, 93%, 47%)',  // yellow
];

const HABIT_EMOJIS = ['💪', '📚', '🏃', '💧', '🧘', '✍️', '🎯', '💤', '🥗', '🎵', '💊', '🚶'];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Habits = () => {
  const navigate = useNavigate();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showStatsSheet, setShowStatsSheet] = useState<Habit | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('💪');
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);
  const [newFrequency, setNewFrequency] = useState<HabitFrequency>('daily');
  const [newWeeklyDays, setNewWeeklyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newTargetStreak, setNewTargetStreak] = useState(7);
  const [newReminderEnabled, setNewReminderEnabled] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState('08:00');

  const loadData = useCallback(async () => {
    const loaded = await loadHabits();
    setHabits(loaded.filter(h => !h.isArchived));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const isCompletedToday = (habit: Habit) =>
    habit.completions.some(c => c.date === today && c.completed);

  const toggleCompletion = async (habit: Habit) => {
    await triggerHaptic('medium');
    const completed = isCompletedToday(habit);
    const newCompletions = completed
      ? habit.completions.filter(c => c.date !== today)
      : [...habit.completions, { date: today, completed: true }];

    const updated: Habit = {
      ...habit,
      completions: newCompletions,
      updatedAt: new Date().toISOString(),
    };

    const { current, best } = calculateStreak(updated);
    updated.currentStreak = current;
    updated.bestStreak = best;

    await saveHabit(updated);
    await loadData();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;

    const habit: Habit = {
      id: `habit_${Date.now()}`,
      name: newName.trim(),
      emoji: newEmoji,
      color: newColor,
      frequency: newFrequency,
      weeklyDays: newFrequency === 'weekly' ? newWeeklyDays : undefined,
      targetStreak: newTargetStreak,
      reminder: newReminderEnabled ? { enabled: true, time: newReminderTime } : undefined,
      completions: [],
      currentStreak: 0,
      bestStreak: 0,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveHabit(habit);

    // Habit reminder scheduling removed

    setShowAddSheet(false);
    resetForm();
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteHabit(id);
    setShowStatsSheet(null);
    await loadData();
  };

  const resetForm = () => {
    setNewName('');
    setNewEmoji('💪');
    setNewColor(HABIT_COLORS[0]);
    setNewFrequency('daily');
    setNewWeeklyDays([1, 2, 3, 4, 5]);
    setNewTargetStreak(7);
    setNewReminderEnabled(false);
    setNewReminderTime('08:00');
  };

  // Last 7 days for the mini heatmap
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return { date, dateStr: format(date, 'yyyy-MM-dd'), dayLabel: format(date, 'EEE').charAt(0) };
  });

  const completedCount = habits.filter(h => isCompletedToday(h)).length;
  const totalCount = habits.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/todo/today')} className="p-1 text-muted-foreground">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Habits</h1>
          </div>
          <Button size="sm" onClick={() => setShowAddSheet(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Today's Summary */}
      {totalCount > 0 && (
        <div className="px-4 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Progress</p>
                <p className="text-2xl font-bold text-foreground">
                  {completedCount}/{totalCount}
                </p>
              </div>
              <div className="relative h-14 w-14">
                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <circle
                    cx="28" cy="28" r="24" fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(completedCount / Math.max(totalCount, 1)) * 150.8} 150.8`}
                  />
                </svg>
                {completedCount === totalCount && totalCount > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-lg">🎉</span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Habit List */}
      <div className="px-4 pt-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {habits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No habits yet</p>
              <p className="text-sm text-muted-foreground mt-1">Tap + to build your first habit</p>
            </motion.div>
          ) : (
            habits.map((habit, index) => {
              const done = isCompletedToday(habit);
              const rate = getCompletionRate(habit, 30);

              return (
                <motion.div
                  key={habit.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Check button */}
                    <button
                      onClick={() => toggleCompletion(habit)}
                      className="flex-shrink-0 h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: habit.color,
                        backgroundColor: done ? habit.color : 'transparent',
                      }}
                    >
                      {done && <Check className="h-5 w-5 text-white" />}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0" onClick={() => setShowStatsSheet(habit)}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{habit.emoji}</span>
                        <span className={`font-medium text-foreground ${done ? 'line-through opacity-60' : ''}`}>
                          {habit.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Flame className="h-3 w-3" style={{ color: habit.color }} />
                          {habit.currentStreak}d streak
                        </span>
                        <span className="text-xs text-muted-foreground">{rate}% (30d)</span>
                      </div>
                    </div>

                    {/* Mini week dots */}
                    <div className="flex gap-1 flex-shrink-0">
                      {last7Days.map(({ dateStr, dayLabel }) => {
                        const completed = habit.completions.some(c => c.date === dateStr && c.completed);
                        return (
                          <div key={dateStr} className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] text-muted-foreground">{dayLabel}</span>
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: completed ? habit.color : 'hsl(var(--muted))',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Add Habit Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Habit</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 pt-4 pb-6">
            <div>
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Drink 8 glasses of water"
                className="mt-1.5"
              />
            </div>

            {/* Emoji picker */}
            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {HABIT_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewEmoji(e)}
                    className={`h-10 w-10 rounded-lg text-lg flex items-center justify-center border transition-all ${
                      newEmoji === e ? 'border-primary bg-primary/10 scale-110' : 'border-border'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1.5">
                {HABIT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      newColor === c ? 'scale-125 border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div>
              <Label>Frequency</Label>
              <div className="flex gap-2 mt-1.5">
                {(['daily', 'weekly'] as HabitFrequency[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setNewFrequency(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${
                      newFrequency === f
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly day picker */}
            {newFrequency === 'weekly' && (
              <div>
                <Label>Which days?</Label>
                <div className="flex gap-1.5 mt-1.5">
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setNewWeeklyDays(prev =>
                          prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                        )
                      }
                      className={`h-9 w-9 rounded-full text-xs font-medium border transition-all ${
                        newWeeklyDays.includes(i)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {name.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target streak */}
            <div>
              <Label>Target streak (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={newTargetStreak}
                onChange={(e) => setNewTargetStreak(Number(e.target.value))}
                className="mt-1.5 w-24"
              />
            </div>

            {/* Daily Reminder */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Label>Daily Reminder</Label>
                </div>
                <Switch
                  checked={newReminderEnabled}
                  onCheckedChange={setNewReminderEnabled}
                />
              </div>
              {newReminderEnabled && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Remind me at</Label>
                  <Input
                    type="time"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="mt-1 w-32"
                  />
                </div>
              )}
            </div>

            <Button onClick={handleAdd} disabled={!newName.trim()} className="w-full">
              Create Habit
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Stats Sheet */}
      <Sheet open={!!showStatsSheet} onOpenChange={() => setShowStatsSheet(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          {showStatsSheet && (
            <HabitStatsContent 
              habit={showStatsSheet} 
              onDelete={handleDelete}
              onUpdateReminder={async (habit, enabled, time) => {
                const updated: Habit = {
                  ...habit,
                  reminder: { enabled, time: time || '08:00' },
                  updatedAt: new Date().toISOString(),
                };
                if (enabled) {
                  // Habit reminder scheduling removed
                } else {
                  // Habit reminder cancellation removed
                }
                await saveHabit(updated);
                await loadData();
                setShowStatsSheet(updated);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <TodoBottomNavigation />
    </div>
  );
};

const HabitStatsContent = ({ habit, onDelete, onUpdateReminder }: { 
  habit: Habit; 
  onDelete: (id: string) => void;
  onUpdateReminder: (habit: Habit, enabled: boolean, time?: string) => void;
}) => {
  const chartData = getWeeklyChartData(habit);
  const rate7 = getCompletionRate(habit, 7);
  const rate30 = getCompletionRate(habit, 30);
  const rate90 = getCompletionRate(habit, 90);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span>{habit.emoji}</span> {habit.name}
        </SheetTitle>
      </SheetHeader>
      <div className="space-y-5 pt-4 pb-6">
        {/* Streak stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Flame className="h-5 w-5 mx-auto mb-1" style={{ color: habit.color }} />
            <p className="text-xl font-bold text-foreground">{habit.currentStreak}</p>
            <p className="text-[10px] text-muted-foreground">Current</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-warning" />
            <p className="text-xl font-bold text-foreground">{habit.bestStreak}</p>
            <p className="text-[10px] text-muted-foreground">Best</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold text-foreground">{habit.targetStreak || '—'}</p>
            <p className="text-[10px] text-muted-foreground">Target</p>
          </div>
        </div>

        {/* Reminder setting */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Daily Reminder</span>
            </div>
            <Switch
              checked={habit.reminder?.enabled || false}
              onCheckedChange={(checked) => onUpdateReminder(habit, checked, habit.reminder?.time)}
            />
          </div>
          {habit.reminder?.enabled && (
            <div className="mt-2">
              <Input
                type="time"
                value={habit.reminder.time || '08:00'}
                onChange={(e) => onUpdateReminder(habit, true, e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </div>

        {/* Completion rates */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Completion Rate</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '7 days', value: rate7 },
              { label: '30 days', value: rate30 },
              { label: '90 days', value: rate90 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="relative h-12 w-12 mx-auto">
                  <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    <circle
                      cx="24" cy="24" r="20" fill="none"
                      stroke={habit.color} strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${(value / 100) * 125.66} 125.66`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                    {value}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly chart */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Weekly Trend
          </h3>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={habit.color} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delete */}
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-2"
          onClick={() => onDelete(habit.id)}
        >
          <Trash2 className="h-4 w-4" /> Delete Habit
        </Button>
      </div>
    </>
  );
};

export default Habits;
