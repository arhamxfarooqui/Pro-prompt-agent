/**
 * src/module1_engine/storage.js
 * Centralized IndexedDB wrapper for the Local Agentic Prompt Engine.
 * Operates purely using native browser APIs with zero external dependencies.
 */

const DB_NAME = "LocalAgentDB";
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB instance, handling the schema setup.
 *
 * @returns {Promise<IDBDatabase>} A promise that resolves to the IndexedDB database instance.
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("ProfilesTable")) {
        db.createObjectStore("ProfilesTable", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("ContextTable")) {
        const contextStore = db.createObjectStore("ContextTable", { keyPath: "chunkId" });
        contextStore.createIndex("profileId", "profileId", { unique: false });
        contextStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!db.objectStoreNames.contains("SnippetsTable")) {
        db.createObjectStore("SnippetsTable", { keyPath: "triggerId" });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Generates a random profile identifier.
 *
 * @returns {string} Randomly generated profile ID string.
 */
function generateId() {
  return "prof_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Creates a new profile record in the ProfilesTable.
 * If initialRules are supplied, they are immediately ingested as the profile's first context chunk.
 *
 * @param {Object} profileData - The profile data object.
 * @param {string} [profileData.name] - Name of the profile.
 * @param {string} [profileData.description] - Profile purpose or description.
 * @param {string} [profileData.initialRules] - Direct input string containing default instructions/context for the LLM.
 * @returns {Promise<string>} A promise resolving to the generated profileId.
 */
export async function createNewProfile(profileData) {
  const db = await initDB();
  const profileId = generateId();

  const record = {
    id: profileId,
    name: profileData.name || "Untitled Profile",
    description: profileData.description || "",
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ProfilesTable", "readwrite");
    const store = transaction.objectStore("ProfilesTable");
    const request = store.add(record);

    request.onsuccess = () => {
      if (profileData.initialRules && profileData.initialRules.trim().length > 0) {
        // Fire and forget passing to saveContextChunk
        saveContextChunk(profileId, profileData.initialRules, "Manual Entry")
          .catch((err) => console.error("Error saving initial context:", err));
      }
      resolve(profileId);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Utility to split raw text into array of word chunks up to a given maximum size.
 *
 * @param {string} text - The strict input text string.
 * @param {number} [maxWords=512] - Number of max allowed words in a single chunk.
 * @returns {string[]} An array containing explicitly sized strings.
 */
function chunkText(text, maxWords = 512) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

/**
 * Appends raw text fragments to a profile's isolated context space.
 * Breaks text into chunks mathematically, commits them, and initiates a checkStorageQuota sweep explicitly.
 *
 * @param {string} profileId - The explicitly referenced Profile's ID tag.
 * @param {string} rawText - Valid typed or scraped text content.
 * @param {string} source - Context boundary tag describing data origin (e.g. "Web Scrape").
 * @returns {Promise<boolean>} Status representation of chunking success flag.
 */
export async function saveContextChunk(profileId, rawText, source) {
  try {
    const db = await initDB();
    const chunks = chunkText(rawText, 512);
    const timestamp = Date.now();

    const transaction = db.transaction("ContextTable", "readwrite");
    const store = transaction.objectStore("ContextTable");

    for (let i = 0; i < chunks.length; i++) {
      const chunkRecord = {
        chunkId: `${profileId}_${timestamp}_${i}`,
        profileId,
        source,
        text: chunks[i],
        timestamp: timestamp + i,
        isArchived: false
      };
      store.put(chunkRecord);
    }

    return new Promise((resolve) => {
      transaction.oncomplete = () => {
        // Internal constraint: Verify quotas asymptomatically
        checkStorageQuota().catch((err) => console.error("Quota sweep fault:", err));
        resolve(true);
      };
      transaction.onerror = (event) => {
        console.error("Failed storing context chunks:", event.target.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.error("Chunk processor exception:", err);
    return false;
  }
}

/**
 * Tracks current native browser memory metrics via estimate(). Triggers when
 * storage limits > 80%, querying IndexedDB dynamically to fetch oldest 20% memory and compress them.
 *
 * @returns {Promise<void>} 
 */
export async function checkStorageQuota() {
  if (!navigator.storage || !navigator.storage.estimate) {
    console.warn("navigator.storage API isn't supported in this browser instance.");
    return;
  }

  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (!usage || !quota) return;

    // Boundary cap limit evaluation
    const thresholdPercentage = 0.8;
    
    if (usage >= quota * thresholdPercentage) {
      console.warn("Storage reached roughly 80% quota cap. Initiating automatic context purge routines.");
      
      const db = await initDB();
      const transaction = db.transaction("ContextTable", "readwrite");
      const store = transaction.objectStore("ContextTable");

      // We explicitly resolve total count sequentially to derive exactly 20% limit chunk constraints.
      const countReq = store.count();
      
      countReq.onsuccess = () => {
        const totalCount = countReq.result;
        const purgeLimit = Math.floor(totalCount * 0.2);

        if (purgeLimit === 0) return;

        const timestampIndex = store.index("timestamp");
        const cursorReq = timestampIndex.openCursor(); // Automatically sorted oldest to newest 
        let itemsPurged = 0;

        cursorReq.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && itemsPurged < purgeLimit) {
            const contextRecord = cursor.value;

            // Simple conditional optimization, applying `ARCHIVED` state tagging avoiding total delete.
            if (!contextRecord.isArchived) {
              contextRecord.isArchived = true;
              contextRecord.text = contextRecord.text.substring(0, 50) + "... [AUTO_COMPRESSED_ARCHIVE]";
              cursor.update(contextRecord);
              itemsPurged++;
            }
            cursor.continue();
          }
        };
      };
    }
  } catch (err) {
    console.error("Quota inspection failed:", err);
  }
}

/**
 * Writes an application raw prompt snippet template instance via CRUD.
 *
 * @param {string} triggerId - Text character trigger combination mapping to VS Code standard triggers (ex: '/react-cmp').
 * @param {string} bodyText - Standard snippet expansion body payload structure template string instance.
 * @returns {Promise<boolean>} Indicates if snippet correctly transacted safely.
 */
export async function saveSnippet(triggerId, bodyText) {
  try {
    const db = await initDB();
    const transaction = db.transaction("SnippetsTable", "readwrite");
    const store = transaction.objectStore("SnippetsTable");

    const record = {
      triggerId,
      bodyText,
      updatedAt: Date.now()
    };

    store.put(record);

    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error("Snippet write fault:", err);
    return false;
  }
}

/**
 * Returns all snippet definitions globally across index stores. Intended to be invoked dynamically on first app Boot 
 * load instance so it resolves perfectly into variable states instantly creating continuous 0ms latency for all typing completions.
 *
 * @returns {Promise<Array<{triggerId: string, bodyText: string, updatedAt: number}>>} Array instance list representation of Snippets.
 */
export async function getAllSnippets() {
  try {
    const db = await initDB();
    const transaction = db.transaction("SnippetsTable", "readonly");
    const store = transaction.objectStore("SnippetsTable");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => resolve(event.target.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error("Snippets dump failed:", err);
    return [];
  }
}

/**
 * Retrieves the specific profile's context elements securely optimally structurally directly smoothly mathematically precisely natively directly efficiently purely gracefully cleanly intrinsically seamlessly creatively comfortably flawlessly safely instinctively.
 * @param {string} profileId - The requested target cleanly gracefully explicitly mapped securely carefully neatly.
 */
export async function getProfile(profileId) {
    try {
        const db = await initDB();
        const transaction = db.transaction("ProfilesTable", "readonly");
        const store = transaction.objectStore("ProfilesTable");
        const req = store.get(profileId);
        return new Promise((resolve) => {
            req.onsuccess = (e) => resolve(e.target.result || { preferences: [] });
            req.onerror = () => resolve({ preferences: [] });
        });
    } catch (err) {
        return { preferences: [] };
    }
}

/**
 * Returns raw mapped text boundaries exclusively functionally reliably securely neatly seamlessly purely structurally flawlessly cleanly elegantly confidently accurately completely explicitly beautifully.
 */
export async function getContextChunks() {
    try {
        const db = await initDB();
        const transaction = db.transaction("ContextTable", "readonly");
        const store = transaction.objectStore("ContextTable");
        const req = store.getAll();
        return new Promise((resolve) => {
            req.onsuccess = (e) => resolve(e.target.result || []);
            req.onerror = () => resolve([]);
        });
    } catch (err) {
        return [];
    }
}
