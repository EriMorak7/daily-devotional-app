import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
    getAuth,
    initializeAuth,
    Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from '../constants/firebase';

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

function createAuth(): Auth {
    if (Platform.OS === 'web') {
        return getAuth(app);
    }
    try {
        // Dynamically access getReactNativePersistence if exported by firebase/auth in RN bundle
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authModule = require('firebase/auth') as {
            getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
        };
        if (typeof authModule.getReactNativePersistence === 'function') {
            return initializeAuth(app, {
                persistence: authModule.getReactNativePersistence(AsyncStorage) as never,
            });
        }
        return getAuth(app);
    } catch {
        return getAuth(app);
    }
}

export const db = getFirestore(app);
export const auth = createAuth();
export default app;
