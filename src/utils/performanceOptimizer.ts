// Performance Optimizer for handling unlimited data
// Provides debouncing, throttling, batch operations, and RAF-based updates

// ============ Debounce with leading/trailing options ============
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = { trailing: true }
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let hasLeadingCall = false;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (options.leading && !hasLeadingCall && !timeoutId) {
      hasLeadingCall = true;
      fn(...args);
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (options.trailing && lastArgs && (!options.leading || hasLeadingCall)) {
        fn(...lastArgs);
      }
      timeoutId = null;
      hasLeadingCall = false;
      lastArgs = null;
    }, delay);
  };
}

// ============ Throttle with RAF ============
export function throttleRAF<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs);
        }
        rafId = null;
      });
    }
  };
}

// ============ Batch Operations ============
interface BatchOperation<T> {
  id: string;
  data: T;
  timestamp: number;
}

export class BatchProcessor<T> {
  private queue: BatchOperation<T>[] = [];
  private processing = false;
  private batchSize: number;
  private delay: number;
  private processor: (items: T[]) => Promise<void>;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    processor: (items: T[]) => Promise<void>,
    options: { batchSize?: number; delay?: number } = {}
  ) {
    this.processor = processor;
    this.batchSize = options.batchSize || 50;
    this.delay = options.delay || 100;
  }

  add(id: string, data: T): void {
    // Remove existing item with same id
    this.queue = this.queue.filter(item => item.id !== id);
    this.queue.push({ id, data, timestamp: Date.now() });
    this.scheduleProcess();
  }

  private scheduleProcess(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.process();
    }, this.delay);
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await this.processor(batch.map(item => item.data));
    } catch (e) {
      console.error('Batch processing failed:', e);
    }

    this.processing = false;

    if (this.queue.length > 0) {
      this.scheduleProcess();
    }
  }

  clear(): void {
    this.queue = [];
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

// ============ Virtual List Helpers ============
export interface VirtualRange {
  start: number;
  end: number;
  overscan: number;
}

export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 5
): VirtualRange {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const end = Math.min(totalItems - 1, start + visibleCount + overscan * 2);

  return { start, end, overscan };
}

// ============ Memory-Efficient Chunk Iterator ============
export async function* chunkIterator<T>(
  items: T[],
  chunkSize: number = 100
): AsyncGenerator<T[], void, unknown> {
  for (let i = 0; i < items.length; i += chunkSize) {
    yield items.slice(i, i + chunkSize);
    // Allow other operations to run
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// ============ Smooth Drag Animation ============
export class DragAnimator {
  private animationId: number | null = null;
  private currentY = 0;
  private targetY = 0;
  private velocity = 0;
  private readonly friction = 0.85;
  private readonly precision = 0.5;
  private onUpdate: (y: number) => void;

  constructor(onUpdate: (y: number) => void) {
    this.onUpdate = onUpdate;
  }

  setTarget(y: number): void {
    this.targetY = y;
    if (!this.animationId) {
      this.animate();
    }
  }

  setImmediate(y: number): void {
    this.currentY = y;
    this.targetY = y;
    this.velocity = 0;
    this.onUpdate(y);
  }

  private animate = (): void => {
    const diff = this.targetY - this.currentY;
    
    if (Math.abs(diff) < this.precision && Math.abs(this.velocity) < this.precision) {
      this.currentY = this.targetY;
      this.velocity = 0;
      this.onUpdate(this.currentY);
      this.animationId = null;
      return;
    }

    // Spring physics
    this.velocity += diff * 0.2;
    this.velocity *= this.friction;
    this.currentY += this.velocity;

    this.onUpdate(this.currentY);
    this.animationId = requestAnimationFrame(this.animate);
  };

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  get isAnimating(): boolean {
    return this.animationId !== null;
  }
}

// ============ Lazy Initializer ============
export function lazy<T>(factory: () => T): () => T {
  let instance: T | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      instance = factory();
      initialized = true;
    }
    return instance!;
  };
}

// ============ Memoization with LRU ============
export function memoizeWithLimit<T extends (...args: any[]) => any>(
  fn: T,
  limit: number = 100,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      // Move to end (most recently used)
      const value = cache.get(key)!;
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn(...args);

    if (cache.size >= limit) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, result);
    return result;
  }) as T;
}

// ============ Idle Callback for Non-Critical Work ============
export function scheduleIdleWork(
  callback: () => void,
  options: { timeout?: number } = {}
): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, options);
  } else {
    setTimeout(callback, options.timeout || 1);
  }
}

// ============ Memory Pressure Detection ============
export function onMemoryPressure(callback: () => void): () => void {
  if ('memory' in performance) {
    const check = () => {
      const memory = (performance as any).memory;
      if (memory && memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
        callback();
      }
    };

    const intervalId = setInterval(check, 10000);
    return () => clearInterval(intervalId);
  }

  return () => {};
}

// ============ Progressive Data Loading ============
export async function loadProgressively<T>(
  items: T[],
  onBatch: (batch: T[], progress: number) => void,
  batchSize: number = 50
): Promise<void> {
  const total = items.length;
  
  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const progress = Math.min(1, (i + batchSize) / total);
    
    onBatch(batch, progress);
    
    // Yield to main thread
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
