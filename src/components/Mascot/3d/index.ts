// Only export Cat3DCanvas (which has runtime guards for expo-gl)
// and pure-TS config (no Three.js / R3F imports).
// DO NOT re-export CatModel3D or CatAccessories3D here — they have
// static imports from @react-three/fiber which crash at module-eval
// time when expo-gl native module is missing.
export { Cat3DCanvas } from './Cat3DCanvas';
export { getCat3DConfig, getAnimationName, getAccessoryProps, MODEL_PATHS } from './cat3DConfig';
export type { Cat3DConfig, Cat3DMaterials, BodyType3D, AccessoryProps } from './cat3DConfig';
