// Wymiary manekina (metry, wzrost ~1,77 m). Wspólne dla modelu 3D i kinematyki ćwiczeń.
export const DIMS = {
  hipHeight: 0.96,     // wysokość środka bioder w pozycji stojącej (= początek układu "root")
  lumbarY: 0.08,       // staw lędźwiowy względem bioder
  shoulderY: 0.42,     // barki względem stawu lędźwiowego
  shoulderX: 0.225,
  neckY: 0.45,
  hipX: 0.1,
  upperArm: 0.30,
  forearm: 0.27,
  thigh: 0.45,
  shin: 0.43,
  ankleHeight: 0.08,   // kostka nad podeszwą
  footBack: -0.05,     // pięta (z, względem kostki)
  footFront: 0.17,     // czubki palców
};

// Barki w układzie bioder (root)
export const SHOULDER_IN_ROOT = { z: 0, y: DIMS.lumbarY + DIMS.shoulderY };
