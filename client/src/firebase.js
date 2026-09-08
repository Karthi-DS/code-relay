import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBs6bDE3zmPlPcQ6-Yp2GJYuX7G3sSOt10",
    authDomain: "blindcode-mx.firebaseapp.com",
    projectId: "blindcode-mx",
    storageBucket: "blindcode-mx.firebasestorage.app",
    messagingSenderId: "1087280667021",
    appId: "1:1087280667021:web:67fae25eb2bb9255a1c5c4",
    measurementId: "G-V4BPEGNPPG"
};

const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

export { app, analytics };
