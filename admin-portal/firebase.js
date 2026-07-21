import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRh7ZzQueEWTOjvgOeT7YkCZYH44-ds2o",
  authDomain: "campus-connect-9a7c6.firebaseapp.com",
  projectId: "campus-connect-9a7c6",
  storageBucket: "campus-connect-9a7c6.firebasestorage.app",
  messagingSenderId: "609668322154",
  appId: "1:609668322154:web:8c8d203d2b196517de4b13",
  measurementId: "G-3YCYQKGDL3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
