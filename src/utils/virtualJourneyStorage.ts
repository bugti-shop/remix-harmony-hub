// Virtual Journey System - Conqueror-style adventure progress through task completion

export interface JourneyMilestone {
  id: string;
  name: string;
  tasksRequired: number; // cumulative tasks needed to reach this milestone
  icon: string;
  description: string;
}

export interface Journey {
  id: string;
  name: string;
  emoji: string;
  description: string;
  totalTasks: number; // total tasks needed to complete the journey
  color: string; // tailwind semantic token
  milestones: JourneyMilestone[];
}

export interface JourneyProgress {
  journeyId: string;
  tasksCompleted: number; // total tasks across all milestones (for stats)
  currentMilestoneIndex: number; // which milestone the user is working on
  currentMilestoneTasks: number; // tasks completed toward current milestone
  startedAt: string;
  completedAt?: string;
  milestonesReached: string[];
  milestonesReachedAt?: Record<string, string>; // milestoneId -> ISO date
}

export interface VirtualJourneyData {
  activeJourneyId: string | null;
  completedJourneys: string[];
  journeyProgress: Record<string, JourneyProgress>;
  totalTasksEver: number;
}

export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface JourneyBadge {
  id: string;
  journeyId: string;
  journeyName: string;
  label: string;
  icon: string;
  description: string;
  type: 'milestone' | 'journey_complete';
  earnedAt?: string;
  rarity: BadgeRarity;
}

export const getRarityFromJourney = (journey: Journey, type: 'milestone' | 'journey_complete', milestoneIndex?: number): BadgeRarity => {
  if (type === 'journey_complete') return journey.totalTasks >= 75 ? 'legendary' : 'epic';
  const total = journey.milestones.length;
  const pos = (milestoneIndex ?? 0) + 1;
  const ratio = pos / total;
  if (ratio <= 0.2) return 'common';
  if (ratio <= 0.5) return 'uncommon';
  if (ratio <= 0.8) return 'rare';
  return 'epic';
};

export const RARITY_CONFIG: Record<BadgeRarity, { label: string; color: string; bg: string }> = {
  common: { label: 'Common', color: 'text-muted-foreground', bg: 'bg-muted' },
  uncommon: { label: 'Uncommon', color: 'text-success', bg: 'bg-success/10' },
  rare: { label: 'Rare', color: 'text-primary', bg: 'bg-primary/10' },
  epic: { label: 'Epic', color: 'text-accent-foreground', bg: 'bg-accent' },
  legendary: { label: 'Legendary', color: 'text-warning', bg: 'bg-warning/10' },
};

export const ALL_JOURNEYS: Journey[] = [
  {
    id: 'nile',
    name: 'Sail the Nile',
    emoji: '⛵',
    description: 'Travel 6,650 km along the world\'s longest river from source to sea',
    totalTasks: 50,
    color: 'info',
    milestones: [
      { id: 'nile_1', name: 'Lake Victoria', tasksRequired: 5, icon: '🏞️', description: 'You\'ve reached the source!' },
      { id: 'nile_2', name: 'Khartoum', tasksRequired: 15, icon: '🏙️', description: 'Where the Blue and White Nile meet' },
      { id: 'nile_3', name: 'Valley of Kings', tasksRequired: 25, icon: '🏛️', description: 'Ancient tombs of the pharaohs' },
      { id: 'nile_4', name: 'Cairo & Pyramids', tasksRequired: 35, icon: '🔺', description: 'The Great Pyramids await!' },
      { id: 'nile_5', name: 'Mediterranean Sea', tasksRequired: 50, icon: '🌊', description: 'Journey complete! You sailed the entire Nile!' },
    ],
  },
  {
    id: 'silk_road',
    name: 'The Silk Road',
    emoji: '🐪',
    description: 'Trek the ancient trade route from China to the Mediterranean',
    totalTasks: 75,
    color: 'warning',
    milestones: [
      { id: 'silk_1', name: 'Xi\'an, China', tasksRequired: 8, icon: '🏯', description: 'The journey begins at the ancient capital' },
      { id: 'silk_2', name: 'Dunhuang Caves', tasksRequired: 20, icon: '🕌', description: 'Thousand Buddha grottoes' },
      { id: 'silk_3', name: 'Samarkand', tasksRequired: 35, icon: '🕋', description: 'Jewel of the Silk Road' },
      { id: 'silk_4', name: 'Tehran', tasksRequired: 50, icon: '🏰', description: 'Gateway to the West' },
      { id: 'silk_5', name: 'Istanbul', tasksRequired: 65, icon: '🌉', description: 'Where East meets West' },
      { id: 'silk_6', name: 'Mediterranean', tasksRequired: 75, icon: '⭐', description: 'The Silk Road is conquered!' },
    ],
  },
  {
    id: 'everest',
    name: 'Climb Everest',
    emoji: '🏔️',
    description: 'Ascend from Base Camp to the summit of the world\'s highest peak',
    totalTasks: 30,
    color: 'accent-teal',
    milestones: [
      { id: 'ev_1', name: 'Base Camp', tasksRequired: 3, icon: '⛺', description: 'Acclimatization begins' },
      { id: 'ev_2', name: 'Camp I - Icefall', tasksRequired: 8, icon: '🧊', description: 'Through the Khumbu Icefall' },
      { id: 'ev_3', name: 'Camp II - Valley', tasksRequired: 14, icon: '🏕️', description: 'Western Cwm reached' },
      { id: 'ev_4', name: 'Camp III - Lhotse', tasksRequired: 20, icon: '🧗', description: 'The Lhotse Face awaits' },
      { id: 'ev_5', name: 'Camp IV - Death Zone', tasksRequired: 25, icon: '💀', description: 'Above 8,000m - the death zone' },
      { id: 'ev_6', name: 'Summit! 🏆', tasksRequired: 30, icon: '🏔️', description: 'Top of the world! 8,849m!' },
    ],
  },
  {
    id: 'pacific',
    name: 'Cross the Pacific',
    emoji: '🚢',
    description: 'Sail from Tokyo to San Francisco across the vast Pacific Ocean',
    totalTasks: 60,
    color: 'accent-indigo',
    milestones: [
      { id: 'pac_1', name: 'Tokyo Bay', tasksRequired: 5, icon: '🗼', description: 'Setting sail from Japan' },
      { id: 'pac_2', name: 'Midway Atoll', tasksRequired: 15, icon: '🏝️', description: 'A tiny paradise in the Pacific' },
      { id: 'pac_3', name: 'International Date Line', tasksRequired: 25, icon: '📅', description: 'You just traveled through time!' },
      { id: 'pac_4', name: 'Hawaii', tasksRequired: 38, icon: '🌺', description: 'Aloha! Rest in paradise' },
      { id: 'pac_5', name: 'Golden Gate', tasksRequired: 60, icon: '🌉', description: 'San Francisco! Pacific conquered!' },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon Expedition',
    emoji: '🌿',
    description: 'Navigate through the world\'s largest rainforest',
    totalTasks: 40,
    color: 'success',
    milestones: [
      { id: 'amz_1', name: 'Andes Source', tasksRequired: 4, icon: '⛰️', description: 'High in the Peruvian Andes' },
      { id: 'amz_2', name: 'Iquitos', tasksRequired: 12, icon: '🛶', description: 'The jungle city' },
      { id: 'amz_3', name: 'Manaus', tasksRequired: 22, icon: '🏙️', description: 'Meeting of the Waters' },
      { id: 'amz_4', name: 'Belém', tasksRequired: 33, icon: '🌅', description: 'Where river meets ocean' },
      { id: 'amz_5', name: 'Atlantic Ocean', tasksRequired: 40, icon: '🌊', description: 'Amazon expedition complete!' },
    ],
  },
  {
    id: 'space',
    name: 'Journey to Mars',
    emoji: '🚀',
    description: 'Blast off from Earth and land on the Red Planet',
    totalTasks: 100,
    color: 'destructive',
    milestones: [
      { id: 'sp_1', name: 'Launch!', tasksRequired: 5, icon: '🚀', description: '3... 2... 1... Liftoff!' },
      { id: 'sp_2', name: 'Earth Orbit', tasksRequired: 15, icon: '🌍', description: 'Orbiting our home planet' },
      { id: 'sp_3', name: 'Moon Flyby', tasksRequired: 30, icon: '🌙', description: 'Passing Earth\'s companion' },
      { id: 'sp_4', name: 'Deep Space', tasksRequired: 50, icon: '✨', description: 'Into the void between worlds' },
      { id: 'sp_5', name: 'Mars Orbit', tasksRequired: 75, icon: '🔴', description: 'The Red Planet is in sight!' },
      { id: 'sp_6', name: 'Mars Landing!', tasksRequired: 100, icon: '🏆', description: 'One giant leap! You\'re on Mars!' },
    ],
  },
];

const STORAGE_KEY = 'npd_virtual_journey';

export const loadJourneyData = (): VirtualJourneyData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    activeJourneyId: null,
    completedJourneys: [],
    journeyProgress: {},
    totalTasksEver: 0,
  };
};

export const saveJourneyData = (data: VirtualJourneyData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const startJourney = (journeyId: string): VirtualJourneyData => {
  const data = loadJourneyData();
  data.activeJourneyId = journeyId;
  if (!data.journeyProgress[journeyId]) {
    data.journeyProgress[journeyId] = {
      journeyId,
      tasksCompleted: 0,
      currentMilestoneIndex: 0,
      currentMilestoneTasks: 0,
      startedAt: new Date().toISOString(),
      milestonesReached: [],
    };
  }
  saveJourneyData(data);
  return data;
};

export const advanceJourney = (): { newMilestone?: JourneyMilestone; journeyCompleted?: boolean } => {
  const data = loadJourneyData();
  if (!data.activeJourneyId) return {};

  const journey = ALL_JOURNEYS.find(j => j.id === data.activeJourneyId);
  if (!journey) return {};

  const progress = data.journeyProgress[data.activeJourneyId];
  if (!progress || progress.completedAt) return {};

  // Initialize new fields for old data
  if (progress.currentMilestoneIndex === undefined) progress.currentMilestoneIndex = 0;
  if (progress.currentMilestoneTasks === undefined) progress.currentMilestoneTasks = 0;

  progress.tasksCompleted += 1;
  progress.currentMilestoneTasks += 1;
  data.totalTasksEver += 1;

  // Check if current milestone is completed
  let newMilestone: JourneyMilestone | undefined;
  if (!progress.milestonesReachedAt) progress.milestonesReachedAt = {};

  const currentMs = journey.milestones[progress.currentMilestoneIndex];
  if (currentMs && progress.currentMilestoneTasks >= currentMs.tasksRequired) {
    // Milestone reached!
    if (!progress.milestonesReached.includes(currentMs.id)) {
      progress.milestonesReached.push(currentMs.id);
      progress.milestonesReachedAt[currentMs.id] = new Date().toISOString();
      newMilestone = currentMs;
    }
    // Move to next milestone and reset counter
    progress.currentMilestoneIndex += 1;
    progress.currentMilestoneTasks = 0;
  }

  // Check journey completion (all milestones done)
  let journeyCompleted = false;
  if (progress.currentMilestoneIndex >= journey.milestones.length) {
    progress.completedAt = new Date().toISOString();
    if (!data.completedJourneys.includes(journey.id)) {
      data.completedJourneys.push(journey.id);
    }
    journeyCompleted = true;
  }

  saveJourneyData(data);
  return { newMilestone, journeyCompleted };
};

export const getActiveJourney = (): { journey: Journey; progress: JourneyProgress } | null => {
  const data = loadJourneyData();
  if (!data.activeJourneyId) return null;
  const journey = ALL_JOURNEYS.find(j => j.id === data.activeJourneyId);
  const progress = data.journeyProgress[data.activeJourneyId];
  if (!journey || !progress) return null;
  return { journey, progress };
};

export const getJourneyBadges = (data: VirtualJourneyData = loadJourneyData()): JourneyBadge[] => {
  const badges: JourneyBadge[] = [];

  for (const journey of ALL_JOURNEYS) {
    const progress = data.journeyProgress[journey.id];
    if (!progress) continue;

    for (let i = 0; i < journey.milestones.length; i++) {
      const milestone = journey.milestones[i];
      if (progress.milestonesReached.includes(milestone.id)) {
        badges.push({
          id: milestone.id,
          journeyId: journey.id,
          journeyName: journey.name,
          label: milestone.name,
          icon: milestone.icon,
          description: milestone.description,
          type: 'milestone',
          earnedAt: progress.milestonesReachedAt?.[milestone.id],
          rarity: getRarityFromJourney(journey, 'milestone', i),
        });
      }
    }

    if (data.completedJourneys.includes(journey.id)) {
      badges.push({
        id: `${journey.id}_complete`,
        journeyId: journey.id,
        journeyName: journey.name,
        label: `${journey.name} Conqueror`,
        icon: '🏆',
        description: `Completed the full ${journey.name} journey`,
        type: 'journey_complete',
        earnedAt: progress.completedAt,
        rarity: getRarityFromJourney(journey, 'journey_complete'),
      });
    }
  }

  return badges;
};

export const abandonJourney = () => {
  const data = loadJourneyData();
  data.activeJourneyId = null;
  saveJourneyData(data);
};
