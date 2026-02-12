import '@testing-library/jest-native/extend-expect';

// Mock expo modules
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: {
    Screen: jest.fn(),
    Navigator: jest.fn(({ children }) => children),
  },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: jest.fn(),
}));

jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn(() => Promise.resolve()),
  OrientationLock: {
    PORTRAIT_UP: 1,
    LANDSCAPE: 6,
    LANDSCAPE_LEFT: 2,
    LANDSCAPE_RIGHT: 3,
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const MockIcon = (props) => React.createElement('Text', props, props.name);
  return new Proxy({}, {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      return MockIcon;
    },
  });
});

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({
      params: {},
    }),
    NavigationContainer: ({ children }) => children,
  };
});

// Mock AsyncStorage (Expo Go compatible version)
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map();

  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      getItem: jest.fn(async (key) => {
        return Promise.resolve(storage.get(key) ?? null);
      }),
      removeItem: jest.fn(async (key) => {
        storage.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(async () => {
        storage.clear();
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(async () => {
        return Promise.resolve(Array.from(storage.keys()));
      }),
      multiGet: jest.fn(async (keys) => {
        return Promise.resolve(keys.map(key => [key, storage.get(key) ?? null]));
      }),
      multiSet: jest.fn(async (keyValuePairs) => {
        keyValuePairs.forEach(([key, value]) => storage.set(key, value));
        return Promise.resolve();
      }),
      multiRemove: jest.fn(async (keys) => {
        keys.forEach(key => storage.delete(key));
        return Promise.resolve();
      }),
    },
  };
});
