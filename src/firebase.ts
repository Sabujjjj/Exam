import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDsDLL0hNaf57gkd-zOn7B9bwSLHGZivzs",
  authDomain: "gen-lang-client-0995122028.firebaseapp.com",
  projectId: "gen-lang-client-0995122028",
  storageBucket: "gen-lang-client-0995122028.firebasestorage.app",
  messagingSenderId: "685643203455",
  appId: "1:685643203455:web:720afe6682dfaa5516904a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Use custom Firestore Database ID if provided
const firestoreDatabaseId = "ai-studio-d290963f-f3ca-477f-8b2f-b864c116f585";
const db = getFirestore(app, firestoreDatabaseId);

const auth = getAuth(app);

export { db, auth };
