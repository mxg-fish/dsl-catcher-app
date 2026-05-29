/**
 * Offline queue using IndexedDB (via idb).
 * Events logged without wifi are stored here and flushed when connectivity returns.
 */
import { openDB } from 'idb'
import api from './api'

const DB_NAME = 'dsl-offline'
const STORE   = 'queue'

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) { db.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true }) }
  })
}

export async function enqueue(gameId, type, payload) {
  const db = await getDB()
  await db.add(STORE, { gameId, type, payload, ts: Date.now() })
}

export async function getPendingCount() {
  const db = await getDB()
  return db.count(STORE)
}

export async function flushQueue() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  if (!all.length) return 0

  // Group by game to use bulk sync endpoint
  const byGame = {}
  for (const item of all) {
    if (!byGame[item.gameId]) byGame[item.gameId] = { throws: [], blocks: [], receiving: [] }
    byGame[item.gameId][item.type + 's'].push(item.payload)
  }

  let synced = 0
  for (const [gameId, batch] of Object.entries(byGame)) {
    try {
      await api.post(`/games/${gameId}/sync`, batch)
      synced += all.filter(i => i.gameId === parseInt(gameId)).length
    } catch (e) {
      console.warn('Sync failed for game', gameId, e)
      return synced  // stop on first error, will retry next time
    }
  }

  // Clear synced items
  const tx = db.transaction(STORE, 'readwrite')
  for (const item of all) await tx.store.delete(item.localId)
  await tx.done

  return synced
}

// Auto-flush when back online
window.addEventListener('online', async () => {
  const n = await flushQueue()
  if (n > 0) console.log(`Synced ${n} offline events`)
})
