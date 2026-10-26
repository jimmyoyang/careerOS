declare namespace chrome {
  namespace tabs {
    type Tab = { id?: number };
    function query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Tab[]>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
  }
  namespace scripting {
    function executeScript(options: { target: { tabId: number }; files: string[] }): Promise<unknown>;
  }
  namespace storage {
    namespace local {
      function get<T extends Record<string, unknown>>(keys: string[]): Promise<T>;
      function set(items: Record<string, unknown>): Promise<void>;
    }
  }
  namespace runtime {
    function onMessageAddListener(listener: (message: unknown, sender: unknown, sendResponse: (value: unknown) => void) => void): void;
    const lastError: { message?: string } | undefined;
  }
}
