// src/utils/analyticsDB.ts
import { openDB } from 'idb';

const DB_NAME = 'ghoststream-analytics';
const STORE_NAME = 'transfers';

export interface TransferRecord {
  id?: number;
  fileName: string;
  fileSize: number;
  speed: number;
  timestamp: number;
  status: 'sent' | 'received' | 'failed';
}

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const logTransfer = async (record: TransferRecord) => {
  const db = await initDB();
  await db.add(STORE_NAME, record);
};

export const getAnalytics = async () => {
  const db = await initDB();
  const records = await db.getAll(STORE_NAME) as TransferRecord[];

  const totalTransfers = records.length;
  const successful = records.filter(r => r.status !== 'failed');
  
  const totalBytes = successful.reduce((acc, curr) => acc + curr.fileSize, 0);
  let totalDataDisplay = "0 MB";
  
  if (totalBytes > 1024 * 1024 * 1024) {
      totalDataDisplay = `${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  } else {
      totalDataDisplay = `${(totalBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const speeds = successful.map(r => r.speed).filter(s => s > 0);
  const avgSpeed = speeds.length > 0 
    ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) 
    : '0';

  const maxSpeed = speeds.length > 0 ? Math.max(...speeds).toFixed(1) : '0';

  return { 
      totalTransfers, 
      totalDataDisplay,
      avgSpeed, 
      maxSpeed, 
      records: records.reverse().slice(0, 5) 
  };
};