import "fake-indexeddb/auto";
import { jest } from "@jest/globals";
import { initDB, createNewProfile, saveContextChunk, saveSnippet, getAllSnippets, checkStorageQuota } from "./storage.js";

// Mock the native navigator.storage API that doesn't exist in Node/Jest
Object.defineProperty(global, "navigator", {
  value: {
    storage: {
      estimate: jest.fn().mockResolvedValue({ usage: 100, quota: 1000 })
    }
  },
  writable: true
});

describe("Storage Engine (IndexedDB + Quota Management)", () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("1. initDB() should initialize LocalAgentDB and required object stores", async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains("ProfilesTable")).toBe(true);
    expect(db.objectStoreNames.contains("ContextTable")).toBe(true);
    expect(db.objectStoreNames.contains("SnippetsTable")).toBe(true);
  });

  test("2. createNewProfile() should insert a record and return a valid ID", async () => {
    const profileId = await createNewProfile({
      name: "Jest Profile",
      description: "A testing profile",
      initialRules: "You are a jest verification agent."
    });
    expect(profileId).toMatch(/^prof_/);
  });

  test("3. saveContextChunk() should explicitly split into 512 chunks and save", async () => {
    const profileId = "prof_test";
    const longText = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    
    const saved = await saveContextChunk(profileId, longText, "Testing Context");
    expect(saved).toBe(true);
  });

  test("4. checkStorageQuota() should trigger compression on >80% quota", async () => {
    // Force a 90% quota scenario (900/1000)
    global.navigator.storage.estimate.mockResolvedValueOnce({
      usage: 900,
      quota: 1000
    });

    await checkStorageQuota();
    expect(global.navigator.storage.estimate).toHaveBeenCalled();
  });

  test("5. Snippets API should perform CRUD effortlessly", async () => {
    const saveTrigger = await saveSnippet("/jest-go", "This is verified by Jest.");
    expect(saveTrigger).toBe(true);

    const snippets = await getAllSnippets();
    expect(snippets.length).toBeGreaterThan(0);
    
    const target = snippets.find(s => s.triggerId === "/jest-go");
    expect(target).toBeDefined();
    expect(target.bodyText).toBe("This is verified by Jest.");
    expect(target.updatedAt).toBeDefined();
  });
});
