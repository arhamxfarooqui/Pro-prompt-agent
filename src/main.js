import { initDB, createNewProfile, saveContextChunk, saveSnippet, getAllSnippets, checkStorageQuota } from './module1_engine/storage.js';

async function runTests() {
  const output = document.getElementById('app');
  if (!output) return;

  function log(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    output.appendChild(p);
  }

  try {
    log("⏱️ Starting Storage tests...");

    log("1. Testing initDB()...");
    await initDB();
    log("✅ initDB() resolved successfully.");

    log("2. Testing createNewProfile()...");
    const profileId = await createNewProfile({
      name: "Local Tester",
      description: "Validation Profile",
      initialRules: "You are a test runner. Assume nothing."
    });
    log(`✅ createNewProfile() returned ID: ${profileId}`);

    log("3. Testing saveContextChunk()...");
    // Generate a long text over 512 words to trigger chunk splitting
    const longText = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const saved = await saveContextChunk(profileId, longText, "Automated Test");
    if (saved) {
      log(`✅ saveContextChunk() returned true.`);
    } else {
      throw new Error("saveContextChunk failed");
    }

    log("4. Testing checkStorageQuota() execution gracefully...");
    await checkStorageQuota();
    log("✅ checkStorageQuota() handled perfectly without errors.");

    log("5. Testing Snippets CRUD (saveSnippet & getAllSnippets)...");
    await saveSnippet("/test-trigger", "Here is a quick template string.");
    const snippets = await getAllSnippets();
    if (snippets.length > 0 && snippets[0].triggerId === "/test-trigger") {
      log(`✅ Snippets CRUD verified. Retrieved count: ${snippets.length}`);
    } else {
      throw new Error("Snippet fetch returned invalid array");
    }

    log("🚀 ALL TESTS PASSED.");
    
    // Append a specific ID so the browser agent knows it finished
    const done = document.createElement('div');
    done.id = 'test-done';
    done.textContent = 'DONE';
    output.appendChild(done);

  } catch (err) {
    log(`❌ TEST FAILED: ${err.message || err}`);
    console.error(err);
  }
}

runTests();
