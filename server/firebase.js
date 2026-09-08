// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require("firebase/firestore/lite");

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBs6bDE3zmPlPcQ6-Yp2GJYuX7G3sSOt10",
    authDomain: "blindcode-mx.firebaseapp.com",
    projectId: "blindcode-mx",
    storageBucket: "blindcode-mx.firebasestorage.app",
    messagingSenderId: "1087280667021",
    appId: "1:1087280667021:web:67fae25eb2bb9255a1c5c4",
    measurementId: "G-V4BPEGNPPG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { app, db, collection, getDocs, doc, setDoc, getDoc };
