/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CSP_CONNECT_SRC?: string;
  readonly VITE_QIKO_BASE_URL?: string;
  readonly VITE_QIKO_API_KEY?: string;
  readonly VITE_QIKO_TENANT_ID?: string;
  /**
   * When true (local `vite` only), browser calls same-origin `/admin` + `/storage`
   * and Vite proxies them to `VITE_API_BASE_URL` (avoids CORS). Default/false = direct.
   */
  readonly VITE_USE_API_PROXY?: string;
  /** When true, app uses src/data/mock-data.json + localStorage mocks. Default/false = live APIs. */
  readonly VITE_USE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
