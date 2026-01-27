export type TransferMode = 'speed' | 'balanced' | 'stable';

export const MODES = {
  speed: {
    label: '⚡ Speed',
    chunkSize: 256 * 1024,
    uiInterval: 200, 
    description: "Max throughput. Best for LAN/Fiber."
  },
  balanced: {
    label: '⚖️ Balanced',
    chunkSize: 64 * 1024,
    uiInterval: 500,
    description: "Standard reliability."
  },
  stable: {
    label: '🛡️ Stable',
    chunkSize: 16 * 1024,
    uiInterval: 1000, 
    description: "High reliability. Best for Mobile/Bad WiFi."
  }
};