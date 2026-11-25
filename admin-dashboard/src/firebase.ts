import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBCbCHIrrwzsjznt31jIdNEBuiBoyQjdMM",
    authDomain: "sufficient-grace-devotion.firebaseapp.com",
    projectId: "sufficient-grace-devotion",
    storageBucket: "sufficient-grace-devotion.firebasestorage.app",
    messagingSenderId: "540335524014",
    appId: "1:540335524014:web:fd04a13ab9be069845053f",
    measurementId: "G-1VCYJQM070"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
