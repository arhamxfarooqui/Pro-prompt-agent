import { jest } from '@jest/globals';

// Mocks for engine.js
const mockInitEngine = jest.fn().mockResolvedValue();
const mockLoadGemmaModel = jest.fn().mockResolvedValue();
const mockGenerate = jest.fn().mockResolvedValue({
  generations: [{ text: 'Mocked summary text' }]
});

jest.unstable_mockModule('./engine.js', () => {
  return {
    LLMManager: jest.fn().mockImplementation(() => ({
      initEngine: mockInitEngine,
      loadGemmaModel: mockLoadGemmaModel
    })),
    LocalWebLLMBridge: jest.fn().mockImplementation(() => ({
      _generate: mockGenerate
    }))
  };
});

jest.unstable_mockModule('@langchain/core/messages', () => {
  return {
    HumanMessage: jest.fn(),
    SystemMessage: jest.fn()
  };
});

// Setup full global mocks for the Chrome Extension APIs
const mockAlarmsGet = jest.fn();
const mockAlarmsCreate = jest.fn();
const mockOnAlarmAddListener = jest.fn();
const mockOnInstalledAddListener = jest.fn();
const mockOnStartupAddListener = jest.fn();

// New Mocks
const mockContextMenusCreate = jest.fn();
const mockOnContextMenusClickedAddListener = jest.fn();
const mockTabsSendMessage = jest.fn().mockResolvedValue({ success: true, text: 'Sample text' });
const mockNotificationsCreate = jest.fn();
const mockStorageLocalGet = jest.fn().mockResolvedValue({});

global.chrome = {
  alarms: {
    get: (name, callback) => mockAlarmsGet(name, callback),
    create: mockAlarmsCreate,
    onAlarm: {
      addListener: mockOnAlarmAddListener
    }
  },
  runtime: {
    onInstalled: {
      addListener: mockOnInstalledAddListener
    },
    onStartup: {
      addListener: mockOnStartupAddListener
    }
  },
  contextMenus: {
    create: mockContextMenusCreate,
    onClicked: {
      addListener: mockOnContextMenusClickedAddListener
    }
  },
  tabs: {
    sendMessage: mockTabsSendMessage
  },
  notifications: {
    create: mockNotificationsCreate
  },
  storage: {
    local: {
      get: mockStorageLocalGet
    }
  }
};

describe('Background Script Integration', () => {
  beforeAll(async () => {
    jest.clearAllMocks();
    await import('./background.js');
  });

  it('should register runtime, alarm, and context menu listeners on execution', () => {
    expect(mockOnInstalledAddListener).toHaveBeenCalledTimes(1);
    expect(mockOnStartupAddListener).toHaveBeenCalledTimes(1);
    expect(mockOnAlarmAddListener).toHaveBeenCalledTimes(1);
    expect(mockOnContextMenusClickedAddListener).toHaveBeenCalledTimes(1);
  });

  it('should create context menu upon extension installation', () => {
    const onInstalledCallback = mockOnInstalledAddListener.mock.calls[0][0];
    onInstalledCallback();

    expect(mockContextMenusCreate).toHaveBeenCalledWith({
      id: "summarize-page",
      title: "Summarize Page Content with AI",
      contexts: ["page"]
    });
  });

  it('should handle native awake-timer period creations properly', () => {
    mockAlarmsCreate.mockClear();
    mockAlarmsGet.mockClear();

    const onInstalledCallback = mockOnInstalledAddListener.mock.calls[0][0];
    onInstalledCallback();

    const alarmsGetCallback = mockAlarmsGet.mock.calls[0][1];
    alarmsGetCallback(undefined);

    // Verify it created the exact alarm parameter specifications
    expect(mockAlarmsCreate).toHaveBeenCalledWith('awake-timer', {
      periodInMinutes: 20 / 60
    });
  });

  it('should hit dummy storage.local to reset idle timer silently on alarm', async () => {
    mockStorageLocalGet.mockClear();
    
    const alarmCallback = mockOnAlarmAddListener.mock.calls[0][0];
    
    await alarmCallback({ name: 'awake-timer' });
    
    expect(mockStorageLocalGet).toHaveBeenCalledWith('dummy_ping_key');
  });

  it('should handle summarize-page context menu click properly', async () => {
    const onClickedCallback = mockOnContextMenusClickedAddListener.mock.calls[0][0];
    
    // Trigger context menu click
    const info = { menuItemId: "summarize-page" };
    const tab = { id: 101 };
    
    await onClickedCallback(info, tab);
    
    expect(mockNotificationsCreate).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Extracting")
    }));
    
    expect(mockTabsSendMessage).toHaveBeenCalledWith(101, { action: 'EXTRACT_PAGE_CONTEXT' });
    
    expect(mockInitEngine).toHaveBeenCalledTimes(1);
    expect(mockLoadGemmaModel).toHaveBeenCalledTimes(1);
    
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    
    expect(mockNotificationsCreate).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Mocked summary text'
    }));
  });
});

