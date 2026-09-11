import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Client, Consultation, ChangeEvent } from '../../types';

interface AstroDB extends DBSchema {
  clients: {
    key: string;
    value: Client;
    indexes: { 'by-name': string; 'by-phone': string; 'by-code': string };
  };
  consultations: {
    key: string;
    value: Consultation;
    indexes: { 'by-client': string; 'by-date': string };
  };
  sync_queue: {
    key: string; // idempotency_key
    value: ChangeEvent;
    indexes: { 'by-timestamp': string };
  };
}

const DB_NAME = 'astroledger_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AstroDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<AstroDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Clients store
        if (!db.objectStoreNames.contains('clients')) {
          const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
          clientStore.createIndex('by-name', 'name');
          clientStore.createIndex('by-phone', 'phone');
          clientStore.createIndex('by-code', 'client_code');
        }

        // Consultations store
        if (!db.objectStoreNames.contains('consultations')) {
          const consultStore = db.createObjectStore('consultations', { keyPath: 'id' });
          consultStore.createIndex('by-client', 'client');
          consultStore.createIndex('by-date', 'consultation_date');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'idempotency_key' });
          queueStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
};

export async function saveClientOffline(client: Client) {
  const db = await getDB();
  await db.put('clients', client);
}

export async function getClientsOffline(): Promise<Client[]> {
  const db = await getDB();
  return db.getAll('clients');
}

export async function saveConsultationOffline(consultation: Consultation) {
  const db = await getDB();
  await db.put('consultations', consultation);
}

export async function getConsultationsByClientOffline(clientId: string): Promise<Consultation[]> {
  const db = await getDB();
  return db.getAllFromIndex('consultations', 'by-client', clientId);
}

export async function enqueueOfflineEvent(event: ChangeEvent) {
  const db = await getDB();
  await db.put('sync_queue', event);
}

export async function getQueuedOfflineEvents(): Promise<ChangeEvent[]> {
  const db = await getDB();
  return db.getAll('sync_queue');
}

export async function removeQueuedOfflineEvent(idempotencyKey: string) {
  const db = await getDB();
  await db.delete('sync_queue', idempotencyKey);
}
