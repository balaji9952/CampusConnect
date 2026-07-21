import os

firebase_content = """import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
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
"""

portals = ['admin-portal', 'parent-portal']

for portal in portals:
    # write firebase.js
    with open(os.path.join(portal, 'firebase.js'), 'w', encoding='utf-8') as f:
        f.write(firebase_content)
    
    # inject into html files
    for file in os.listdir(portal):
        if file.endswith('.html'):
            path = os.path.join(portal, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            script_tag = '  <script type="module" src="firebase.js"></script>\n'
            
            if script_tag not in content:
                content = content.replace('</body>', script_tag + '</body>')
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)

print("Firebase integration completed successfully!")
