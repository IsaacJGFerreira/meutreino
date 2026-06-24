import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export type WebFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  config: WebFirebaseConfig;
};

const CONFIG_KEY = "meutreino.firebase.webConfig";
let services: FirebaseServices | null = null;

export function hasUsableConfig(config: Partial<WebFirebaseConfig> | null | undefined): config is WebFirebaseConfig {
  return Boolean(
    config?.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId
  );
}

export function readEnvConfig(): Partial<WebFirebaseConfig> {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? ""
  };
}

export function readSavedConfig(): WebFirebaseConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WebFirebaseConfig>;
    return hasUsableConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readInitialConfig(): WebFirebaseConfig | null {
  const saved = readSavedConfig();
  if (saved) return saved;

  const env = readEnvConfig();
  return hasUsableConfig(env) ? env : null;
}

export function saveConfig(config: WebFirebaseConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearSavedConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export function initFirebase(config: WebFirebaseConfig): FirebaseServices {
  if (services) return services;

  const app = initializeApp(config);
  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
    config
  };
  return services;
}
