import { parseMenuBatchDraft, type MenuBatchDraft } from "./batch-draft-schema"

const DATABASE_NAME = "tavvi-menu-batch-drafts"
const STORE_NAME = "drafts"
const DATABASE_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Rascunhos locais não estão disponíveis neste navegador."))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "restaurantId" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o rascunho local."))
    request.onblocked = () => reject(new Error("Feche outra aba do cardápio para usar os rascunhos locais."))
  })
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: unknown) => void) => void): Promise<T> {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    let settled = false
    let hasResult = false
    let result: T | undefined
    const fail = (reason: unknown) => {
      if (settled) return
      settled = true
      database.close()
      reject(reason)
    }
    transaction.oncomplete = () => {
      database.close()
      if (settled) return
      settled = true
      if (hasResult) resolve(result as T)
      else reject(new Error("A operação do rascunho local não foi confirmada."))
    }
    transaction.onerror = () => fail(transaction.error ?? new Error("Não foi possível salvar o rascunho local."))
    transaction.onabort = () => fail(transaction.error ?? new Error("O rascunho local foi interrompido."))
    try {
      operation(transaction.objectStore(STORE_NAME), (value) => { result = value; hasResult = true }, fail)
    } catch (cause) {
      fail(cause)
    }
  })
}

export const batchDraftStore = {
  load(restaurantId: string): Promise<MenuBatchDraft | null> {
    return transact("readonly", (store, resolve, reject) => {
      const request = store.get(restaurantId)
      request.onsuccess = () => resolve(parseMenuBatchDraft(request.result, restaurantId))
      request.onerror = () => reject(request.error ?? new Error("Não foi possível ler o rascunho local."))
    })
  },
  save(draft: Omit<MenuBatchDraft, "schemaVersion" | "updatedAt">): Promise<void> {
    const value: MenuBatchDraft = { ...draft, schemaVersion: 1, updatedAt: Date.now() }
    return transact("readwrite", (store, resolve, reject) => {
      const request = store.put(value)
      request.onsuccess = () => resolve(undefined)
      request.onerror = () => reject(request.error ?? new Error("Não foi possível salvar o rascunho local."))
    })
  },
  remove(restaurantId: string): Promise<void> {
    return transact("readwrite", (store, resolve, reject) => {
      const request = store.delete(restaurantId)
      request.onsuccess = () => resolve(undefined)
      request.onerror = () => reject(request.error ?? new Error("Não foi possível remover o rascunho local."))
    })
  },
}
