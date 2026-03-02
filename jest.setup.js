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
    useIsFocused: () => true,
    NavigationContainer: ({ children }) => children,
  };
});

// Mock expo-av (Audio engine dependency — expo-av uses ESM internals)
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({ sound: { playAsync: jest.fn(), unloadAsync: jest.fn(), setStatusAsync: jest.fn(), replayAsync: jest.fn() }, status: {} })
      ),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-speech (TTS)
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((size) => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }),
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
}));

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

// Mock @shopify/react-native-skia (GPU-accelerated 2D — not available in Jest)
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  return {
    Canvas: ({ children, ...props }) => React.createElement('View', props, children),
    Circle: (props) => React.createElement('View', props),
    Rect: (props) => React.createElement('View', props),
    RoundedRect: (props) => React.createElement('View', props),
    Path: (props) => React.createElement('View', props),
    Line: (props) => React.createElement('View', props),
    Group: ({ children, ...props }) => React.createElement('View', props, children),
    LinearGradient: (props) => React.createElement('View', props),
    RadialGradient: (props) => React.createElement('View', props),
    Blur: (props) => React.createElement('View', props),
    BackdropFilter: ({ children, ...props }) => React.createElement('View', props, children),
    BackdropBlur: ({ children, ...props }) => React.createElement('View', props, children),
    Shadow: (props) => React.createElement('View', props),
    useSharedValueEffect: jest.fn(),
    useClockValue: jest.fn(() => ({ current: 0 })),
    useComputedValue: jest.fn((fn) => ({ current: fn() })),
    useValue: jest.fn((val) => ({ current: val })),
    Skia: {
      Path: { Make: jest.fn(() => ({ moveTo: jest.fn(), lineTo: jest.fn(), close: jest.fn() })) },
      Color: jest.fn((c) => c),
    },
    vec: jest.fn((x, y) => ({ x, y })),
    useFont: jest.fn(() => null),
    matchFont: jest.fn(() => null),
  };
});

// Mock 3D rendering modules (not available in Jest node environment)
jest.mock('@react-three/fiber/native', () => ({
  Canvas: jest.fn(({ children }) => children),
  useFrame: jest.fn(),
}));

jest.mock('@react-three/drei/native', () => ({
  useGLTF: jest.fn(() => ({
    scene: { clone: jest.fn(() => ({ traverse: jest.fn() })) },
    animations: [],
  })),
  useAnimations: jest.fn(() => ({
    actions: {},
    mixer: null,
  })),
}));

jest.mock('three', () => {
  const MockGeometry = jest.fn();
  const MockColor = jest.fn(() => ({
    multiplyScalar: jest.fn().mockReturnThis(),
    offsetHSL: jest.fn().mockReturnThis(),
    lerp: jest.fn().mockReturnThis(),
    clone: jest.fn(() => MockColor()),
    getHexString: jest.fn(() => '000000'),
  }));
  return {
    Color: MockColor,
    Mesh: jest.fn(),
    Group: jest.fn(),
    MeshStandardMaterial: jest.fn(),
    MeshToonMaterial: jest.fn(),
    MeshBasicMaterial: jest.fn(),
    DataTexture: jest.fn(),
    BufferAttribute: jest.fn(),
    RedFormat: 1028,
    NearestFilter: 1003,
    SphereGeometry: MockGeometry,
    BoxGeometry: MockGeometry,
    TorusGeometry: MockGeometry,
    ConeGeometry: MockGeometry,
    RingGeometry: MockGeometry,
    CylinderGeometry: MockGeometry,
    DoubleSide: 2,
    BackSide: 1,
    SkinnedMesh: jest.fn(),
  };
});

jest.mock('expo-gl', () => ({
  GLView: jest.fn(),
}));

// Mock Firebase modules (prevent real Firebase initialization in test environment)
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({
    emulatorConfig: null,
    currentUser: null,
    onAuthStateChanged: jest.fn(() => jest.fn()),
  })),
  getReactNativePersistence: jest.fn(() => ({})),
  connectAuthEmulator: jest.fn(),
  signInAnonymously: jest.fn(() => Promise.resolve({ user: { uid: 'test-uid' } })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn(() => jest.fn()),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  connectFirestoreEmulator: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  serverTimestamp: jest.fn(),
  increment: jest.fn(),
  Timestamp: {
    fromMillis: jest.fn((ms) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 })),
    fromDate: jest.fn((d) => ({ toMillis: () => d.getTime(), seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
    now: jest.fn(() => ({ toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
  },
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.reject(new Error('Cloud Function not available in test')))),
  connectFunctionsEmulator: jest.fn(),
}));

