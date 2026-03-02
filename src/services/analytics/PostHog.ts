/**
 * PostHog Analytics Integration
 * Tracks user behavior and app events for analytics
 */

import PostHog from 'posthog-react-native';
import { logger } from '../../utils/logger';

// ============================================================================
// PostHog Initialization
// ============================================================================

export class AnalyticsService {
  private static initialized = false;

  /**
   * Initialize PostHog analytics
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    if (!apiKey) {
      logger.warn('EXPO_PUBLIC_POSTHOG_API_KEY is not set. Analytics disabled.');
      return;
    }

    try {
      PostHog.setupWithApiKey(apiKey, {
        host: 'https://us.posthog.com',
        captureApplicationLifecycleEvents: true,
        recordScreenViews: true,
        enableSessionReplay: true,
        // Don't capture PII
        captureLaunchOptions: false,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize PostHog:', error);
    }
  }

  /**
   * Set user identity
   */
  static identifyUser(userId: string, properties?: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    try {
      PostHog.identify(userId, properties);
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  }

  /**
   * Set user properties
   */
  static setUserProperties(properties: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    try {
      PostHog.setPersonProperties(properties);
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }

  /**
   * Track event
   */
  static trackEvent(eventName: string, properties?: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    try {
      PostHog.capture(eventName, properties);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Reset analytics (when user logs out)
   */
  static reset(): void {
    if (!this.initialized) {
      return;
    }

    try {
      PostHog.reset();
    } catch (error) {
      console.error('Failed to reset analytics:', error);
    }
  }

  /**
   * Flush pending events
   */
  static flush(): void {
    if (!this.initialized) {
      return;
    }

    try {
      PostHog.flush();
    } catch (error) {
      console.error('Failed to flush analytics:', error);
    }
  }
}

// ============================================================================
// Event Tracking Functions
// ============================================================================

export const analyticsEvents = {
  // Authentication events
  auth: {
    signUp: (method: 'email' | 'google') =>
      AnalyticsService.trackEvent('auth_sign_up', { method }),
    signIn: (method: 'email' | 'google') =>
      AnalyticsService.trackEvent('auth_sign_in', { method }),
    signOut: () => AnalyticsService.trackEvent('auth_sign_out'),
    passwordReset: () => AnalyticsService.trackEvent('auth_password_reset'),
  },

  // Onboarding events
  onboarding: {
    started: () => AnalyticsService.trackEvent('onboarding_started'),
    completed: (experienceLevel: string) =>
      AnalyticsService.trackEvent('onboarding_completed', { experienceLevel }),
    skipped: () => AnalyticsService.trackEvent('onboarding_skipped'),
    midiSetupStarted: () =>
      AnalyticsService.trackEvent('midi_setup_started'),
    midiSetupCompleted: (deviceName: string) =>
      AnalyticsService.trackEvent('midi_setup_completed', { deviceName }),
    midiSetupFailed: (reason: string) =>
      AnalyticsService.trackEvent('midi_setup_failed', { reason }),
  },

  // Exercise events
  exercise: {
    started: (exerciseId: string, title: string) =>
      AnalyticsService.trackEvent('exercise_started', { exerciseId, title }),
    completed: (exerciseId: string, score: number, attempts: number) =>
      AnalyticsService.trackEvent('exercise_completed', {
        exerciseId,
        score,
        attempts,
      }),
    paused: (exerciseId: string, currentBeat: number) =>
      AnalyticsService.trackEvent('exercise_paused', { exerciseId, currentBeat }),
    skipped: (exerciseId: string, reason: string) =>
      AnalyticsService.trackEvent('exercise_skipped', { exerciseId, reason }),
    failed: (exerciseId: string, attempts: number) =>
      AnalyticsService.trackEvent('exercise_failed', { exerciseId, attempts }),
  },

  // Progress events
  progress: {
    lessonCompleted: (lessonId: string, totalTime: number) =>
      AnalyticsService.trackEvent('lesson_completed', { lessonId, totalTime }),
    levelUp: (newLevel: number, totalXp: number) =>
      AnalyticsService.trackEvent('level_up', { newLevel, totalXp }),
    xpEarned: (amount: number, source: string) =>
      AnalyticsService.trackEvent('xp_earned', { amount, source }),
    streakAchieved: (streakDays: number) =>
      AnalyticsService.trackEvent('streak_achieved', { streakDays }),
    streakBroken: (streakDays: number) =>
      AnalyticsService.trackEvent('streak_broken', { streakDays }),
    achievementUnlocked: (achievementId: string, achievementName: string) =>
      AnalyticsService.trackEvent('achievement_unlocked', {
        achievementId,
        achievementName,
      }),
  },

  // AI Coach events
  aiCoach: {
    feedbackRequested: (exerciseId: string, score: number) =>
      AnalyticsService.trackEvent('ai_feedback_requested', { exerciseId, score }),
    feedbackReceived: (exerciseId: string, cached: boolean) =>
      AnalyticsService.trackEvent('ai_feedback_received', { exerciseId, cached }),
    feedbackError: (reason: string) =>
      AnalyticsService.trackEvent('ai_feedback_error', { reason }),
  },

  // Audio/Input events
  audio: {
    midiConnected: (deviceName: string) =>
      AnalyticsService.trackEvent('midi_connected', { deviceName }),
    midiDisconnected: (reason: string) =>
      AnalyticsService.trackEvent('midi_disconnected', { reason }),
    inputMethodChanged: (newMethod: 'midi' | 'microphone' | 'screen') =>
      AnalyticsService.trackEvent('input_method_changed', { newMethod }),
  },

  // Settings events
  settings: {
    changed: (setting: string, oldValue: any, newValue: any) =>
      AnalyticsService.trackEvent('settings_changed', {
        setting,
        oldValue,
        newValue,
      }),
    soundToggled: (enabled: boolean) =>
      AnalyticsService.trackEvent('sound_toggled', { enabled }),
    hapticToggled: (enabled: boolean) =>
      AnalyticsService.trackEvent('haptic_toggled', { enabled }),
    dailyGoalChanged: (minutes: number) =>
      AnalyticsService.trackEvent('daily_goal_changed', { minutes }),
  },

  // Sync events
  sync: {
    started: (changeCount: number) =>
      AnalyticsService.trackEvent('sync_started', { changeCount }),
    completed: (changeCount: number, conflictCount: number) =>
      AnalyticsService.trackEvent('sync_completed', { changeCount, conflictCount }),
    failed: (reason: string) =>
      AnalyticsService.trackEvent('sync_failed', { reason }),
  },

  // Error events
  error: {
    audioLatencyHigh: (latencyMs: number) =>
      AnalyticsService.trackEvent('audio_latency_high', { latencyMs }),
    apiError: (functionName: string, errorCode: string) =>
      AnalyticsService.trackEvent('api_error', { functionName, errorCode }),
    crashReported: (errorMessage: string, stackTrace: string) =>
      AnalyticsService.trackEvent('crash_reported', {
        errorMessage,
        stackTrace: stackTrace.slice(0, 500),
      }),
  },

  // Session events
  session: {
    started: () => AnalyticsService.trackEvent('session_started'),
    ended: (durationSeconds: number, exercisesCompleted: number) =>
      AnalyticsService.trackEvent('session_ended', {
        durationSeconds,
        exercisesCompleted,
      }),
    backgrounded: () => AnalyticsService.trackEvent('app_backgrounded'),
    foregrounded: () => AnalyticsService.trackEvent('app_foregrounded'),
  },

  // Monetization events
  monetization: {
    upgradeViewed: () => AnalyticsService.trackEvent('upgrade_viewed'),
    upgradePurchased: (tier: string, price: number) =>
      AnalyticsService.trackEvent('upgrade_purchased', { tier, price }),
    upgradeRestored: () => AnalyticsService.trackEvent('upgrade_restored'),
  },
};

// ============================================================================
// User Property Tracking
// ============================================================================

export function updateUserAnalyticsProperties(profile: {
  displayName?: string;
  level?: number;
  currentStreak?: number;
  hasMidiKeyboard?: boolean;
  preferredInputMethod?: string;
  totalMinutesPracticed?: number;
  lessonCompletionRate?: number;
}): void {
  const props: Record<string, any> = {};

  if (profile.displayName) props.display_name = profile.displayName;
  if (profile.level !== undefined) props.level = profile.level;
  if (profile.currentStreak !== undefined) props.current_streak = profile.currentStreak;
  if (profile.hasMidiKeyboard !== undefined)
    props.has_midi_keyboard = profile.hasMidiKeyboard;
  if (profile.preferredInputMethod)
    props.preferred_input_method = profile.preferredInputMethod;
  if (profile.totalMinutesPracticed !== undefined)
    props.total_minutes_practiced = profile.totalMinutesPracticed;
  if (profile.lessonCompletionRate !== undefined)
    props.lesson_completion_rate = profile.lessonCompletionRate;

  if (Object.keys(props).length > 0) {
    AnalyticsService.setUserProperties(props);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Track a timed event
 */
export function trackTimedEvent(
  eventName: string,
  durationMs: number,
  properties?: Record<string, any>
): void {
  AnalyticsService.trackEvent(eventName, {
    ...properties,
    duration_ms: durationMs,
  });
}

/**
 * Track API latency
 */
export function trackApiLatency(
  endpoint: string,
  latencyMs: number,
  status: 'success' | 'error'
): void {
  if (latencyMs > 2000) {
    analyticsEvents.error.apiError(endpoint, 'HIGH_LATENCY');
  }

  AnalyticsService.trackEvent('api_call', {
    endpoint,
    latency_ms: latencyMs,
    status,
  });
}

/**
 * Create funnel tracking
 */
export function trackFunnelStep(
  funnelName: string,
  stepName: string,
  metadata?: Record<string, any>
): void {
  AnalyticsService.trackEvent(`funnel_${funnelName}_${stepName}`, metadata);
}
