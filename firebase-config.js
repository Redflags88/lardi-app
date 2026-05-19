// Firebase configuration — one deployment per school, credentials set here directly
const firebaseConfig = {
  apiKey:            "AIzaSyDnZpYj6OBJEGIdZ7zZVLGkQHdFhV3sSgA",
  authDomain:        "schoolmanagementsystem-e6554.firebaseapp.com",
  projectId:         "schoolmanagementsystem-e6554",
  storageBucket:     "schoolmanagementsystem-e6554.firebasestorage.app",
  messagingSenderId: "613321242934",
  appId:             "1:613321242934:web:c59ff104159dd248135b97",
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();
