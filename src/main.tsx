import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// No loading screen - render nothing during suspense for instant feel
const EmptyFallback = () => null;

// Schedule non-critical work after first paint
const scheduleDeferred = (fn: () => void) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: 3000 });
  } else {
    setTimeout(fn, 100);
  }
};

// Render immediately — no blocking initializations
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<EmptyFallback />}>
      <App />
    </Suspense>
  </React.StrictMode>
);

// Defer ALL non-critical initialization until after first paint
scheduleDeferred(async () => {
  try {
    const [
      { migrateLocalStorageToIndexedDB, getSetting },
      { migrateNotesToIndexedDB },
      { initializeTaskOrder },
      { initializeProtectionSettings },
      { startBackgroundScheduler },
      { initializeReminders },
      { initializeStreakNotifications },
      { initializeSmartNotifications },
      { configureStatusBar },
    ] = await Promise.all([
      import("./utils/settingsStorage"),
      import("./utils/noteStorage"),
      import("./utils/taskOrderStorage"),
      import("./utils/noteProtection"),
      import("./utils/backgroundScheduler"),
      import("./utils/reminderScheduler"),
      import("./utils/streakNotifications"),
      import("./utils/smartNotifications"),
      import("./utils/statusBar"),
    ]);

    // Run migrations in parallel
    await Promise.all([
      migrateLocalStorageToIndexedDB(),
      migrateNotesToIndexedDB(),
      initializeTaskOrder(),
      initializeProtectionSettings(),
    ]);

    // Start background scheduler
    startBackgroundScheduler();

    // Fire-and-forget notification initializations
    initializeReminders().catch(console.warn);
    initializeStreakNotifications().catch(console.warn);
    initializeSmartNotifications().catch(console.warn);

    // Configure status bar
    const theme = await getSetting<string>('theme', 'light');
    await configureStatusBar(theme !== 'light');
  } catch (error) {
    console.error('Deferred initialization error:', error);
  }
});
