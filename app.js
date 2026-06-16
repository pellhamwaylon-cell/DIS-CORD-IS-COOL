// 1. Import the specific Firebase modules we need for a chat app
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// 2. Your live Firebase web app configuration
const firebaseConfig = {
    apiKey: "AIzaSyDAPas1NVJSTOk4XWECmX4oTFty-wVyyp4",
    authDomain: "discord-49114.firebaseapp.com",
    projectId: "discord-49114",
    storageBucket: "discord-49114.firebasestorage.app",
    messagingSenderId: "356073121381",
    appId: "1:356073121381:web:98cd7cb57723e58680c88c",
    measurementId: "G-J1XVSM39T7"
};

// 3. Initialize the database and storage services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Local App State
let currentUser = "Guest";

// DOM Setup Elements
const authModal = document.getElementById("auth-modal");
const usernameInput = document.getElementById("username-input");
const loginBtn = document.getElementById("login-btn");
const currentUsernameText = document.getElementById("current-username");
const userAvatarInitial = document.getElementById("user-avatar-initial");
const chatInput = document.getElementById("chat-input");
const messagesContainer = document.getElementById("messages-container");
const mediaUpload = document.getElementById("media-upload");
const uploadStatus = document.getElementById("upload-status");

// Handle Username Prompt Sign-In
loginBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        currentUsernameText.innerText = name;
        userAvatarInitial.innerText = name.charAt(0).toUpperCase();
        authModal.classList.add("hidden"); 
        loadMessages(); 
    }
});

// Format Timestamps dynamically
function formatTimestamp(firebaseDate) {
    if (!firebaseDate) return "Just now";
    const date = firebaseDate.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Send Standard Text Message
chatInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && chatInput.value.trim() !== "") {
        const textMessage = chatInput.value.trim();
        chatInput.value = ""; 

        try {
            await addDoc(collection(db, "messages"), {
                user: currentUser,
                text: textMessage,
                mediaUrl: null,
                mediaType: null,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    }
});

// Handle Image & Short Video Drag/Uploads
mediaUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
        alert("Only images and short videos are allowed!");
        return;
    }

    uploadStatus.classList.remove("hidden");
    
    try {
        const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "messages"), {
            user: currentUser,
            text: "",
            mediaUrl: downloadUrl,
            mediaType: isImage ? "image" : "video",
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Upload failed: ", error);
    } finally {
        uploadStatus.classList.add("hidden");
        mediaUpload.value = ""; 
    }
});

// Stream Dynamic Real-Time Messages Stream 
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = ""; 
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const timeStr = formatTimestamp(data.timestamp);
            
            let mediaContent = "";
            if (data.mediaUrl) {
                if (data.mediaType === "image") {
                    mediaContent = `<img src="${data.mediaUrl}" class="mt-2 max-w-xs md:max-w-md rounded border border-[#232428] max-h-80 object-contain">`;
                } else if (data.mediaType === "video") {
                    mediaContent = `<video src="${data.mediaUrl}" controls class="mt-2 max-w-xs md:max-w-md rounded border border-[#232428] max-h-80"></video>`;
                }
            }

            const msgHTML = `
                <div class="flex items-start gap-4 hover:bg-[#2e3035]/30 px-4 py-1 -mx-4 transition">
                    <div class="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center font-bold text-white uppercase shrink-0">
                        ${data.user.charAt(0)}
                    </div>
                    <div class="flex flex-col min-w-0">
                        <div class="flex items-baseline gap-2">
                            <span class="text-white font-medium text-sm hover:underline cursor-pointer">${data.user}</span>
                            <span class="text-[#949ba4] text-xs">${timeStr}</span>
                        </div>
                        <p class="text-[#dbdee1] text-sm break-words whitespace-pre-wrap">${data.text || ""}</p>
                        ${mediaContent}
                    </div>
                </div>
            `;
            messagesContainer.insertAdjacentHTML("beforeend", msgHTML);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}
