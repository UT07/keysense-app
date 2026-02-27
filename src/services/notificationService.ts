/**
 * Notification Service — local notifications for streak reminders,
 * league results, and challenge updates.
 *
 * Uses expo-notifications for scheduling local notifications.
 * Remote push (FCM) can be added later via expo-notifications push token.
 */
import * as Notifications from 'expo-notifications';

// Configure notification handler (shows when app is foregrounded)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request notification permissions */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Schedule a daily practice reminder */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
): Promise<string> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to practice!',
      body: "Your cat misses you. Keep your streak alive!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

/** Schedule a streak-at-risk reminder (fires at 8pm daily) */
export async function scheduleStreakReminder(): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Streak at risk!',
      body: 'Practice now to keep your streak going!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
  return id;
}

/** Send an immediate local notification */
export async function sendLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/** Cancel all scheduled notifications */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
