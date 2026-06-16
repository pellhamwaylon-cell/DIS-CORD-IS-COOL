import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDAPas1NVJSTOk4XWECmX4oTFty-wVyyp4",
    authDomain: "discord-49114.firebaseapp.com",
    projectId: "discord-49114",
    storageBucket: "discord-49114.firebasestorage.app",
    messagingSenderId: "356073121381",
    appId: "1:356073121381:web:98cd7cb57723e58680c88c"
};

// Initialize App & Services
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
const storage = getStorage(app);

// Global State Variables
let currentUser = "Guest";
let currentUserPfp = null;
let currentChannel = "general";
let unsubscribeMessages = null; // Keeps track of the active message listener

// DOM Elements
const authModal = document.getElementById("auth-modal");
const usernameInput = document.getElementById("username-input");
const pfpInput = document.getElementById("pfp-input");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const currentUsernameText = document.getElementById("current-username");
const userAvatarInitial = document.getElementById("user-avatar-initial");
const logoutBtn = document.getElementById("logout-btn");

const channelModal = document.getElementById("channel-modal");
const newChannelNameInput = document.getElementById("new-channel-name");
const confirmChannelBtn = document.getElementById("confirm-channel-btn");
const cancelChannelBtn = document.getElementById("cancel-channel-btn");
const openCreateChannelBtn = document.getElementById("open-create-channel-btn");
const channelsContainer = document.getElementById("channels-container");
const channelHeaderName = document.getElementById("channel-header-name");

const chatInput = document.getElementById("chat-input");
const messagesContainer = document.getElementById("messages-container");
const mediaUpload = document.getElementById("media-upload");
const uploadStatus = document.getElementById("upload-status");

// --- AUTH & LOGIN LOGIC ---
loginBtn.addEventListener("click", async () => {
    const name = usernameInput.value.trim();
    const pfpFile = pfpInput.files[0];

    if (!name) return alert("You need a username!");

    loginBtn.classList.add("hidden");
    loginStatus.classList.remove("hidden");

    try {
        currentUser = name;
        currentUsernameText.innerText = name;

        if (pfpFile) {
            const pfpRef = ref(storage, `pfps/${Date.now()}_${pfpFile.name}`);
            const snapshot = await uploadBytes(pfpRef, pfpFile);
            currentUserPfp = await getDownloadURL(snapshot.ref);
            userAvatarInitial.innerHTML = `<img src="${currentUserPfp}" class="w-full h-full rounded-full object-cover">`;
        } else {
            userAvatarInitial.innerText = name.charAt(0).toUpperCase();
        }

        authModal.classList.add("hidden"); 
        
        // Start the app logic once logged in
        ensureGeneralChannelExists();
        loadChannels();
        switchChannel("general"); 

    } catch (error) {
        console.error("Login Error: ", error);
        alert("Login failed.");
        loginBtn.classList.remove("hidden");
        loginStatus.classList.add("hidden");
    }
});

logoutBtn.addEventListener("click", () => {
    window.location.reload(); // Simple brute-force way to wipe memory and restart
});

// --- CHANNEL MANAGEMENT LOGIC ---

// Open/Close Modal
openCreateChannelBtn.addEventListener("click", () => channelModal.classList.remove("hidden"));
cancelChannelBtn.addEventListener("click", () => channelModal.classList.add("hidden"));

// Ensure 'general' always exists in the DB
async function ensureGeneralChannelExists() {
    await setDoc(doc(db, "channels", "general"), {
        name: "general",
        timestamp: serverTimestamp()
    }, { merge: true });
}

// Create a new channel
confirmChannelBtn.addEventListener("click", async () => {
    let newName = newChannelNameInput.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!newName) return;

    try {
        await setDoc(doc(db, "channels", newName), {
            name: newName,
            timestamp: serverTimestamp()
        });
        channelModal.classList.add("hidden");
        newChannelNameInput.value = "";
        switchChannel(newName); // Auto-jump to the new channel
    } catch (error) {
        console.error("Error creating channel", error);
    }
});

// Listen for all channels to populate sidebar
function loadChannels() {
    const q = query(collection(db, "channels"), orderBy("name", "asc"));
    onSnapshot(q, (snapshot) => {
        channelsContainer.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const channelName = docSnap.id;
            
            const div = document.createElement("div");
            div.className = `flex items-center px-2 py-1.5 rounded cursor-pointer transition mb-0.5 ${channelName === currentChannel ? 'bg-[#404249] text-white' : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'}`;
            div.innerHTML = `<span class="text-[#949ba4] mr-1.5 text-xl">#</span> font-medium ${channelName}`;
            
            // Allow clicking to switch channels
            div.addEventListener("click", () => switchChannel(channelName));
            channelsContainer.appendChild(div);
        });
    });
}

// Switch the active channel and reload messages
function switchChannel(channelName) {
    currentChannel = channelName;
    channelHeaderName.innerText = channelName;
    chatInput.placeholder = `Message #${channelName}`;
    
    // Re-render the sidebar to highlight the correct active channel
    loadChannels(); 
    loadMessages(channelName);
}


// --- MESSAGING LOGIC ---

function formatTimestamp(firebaseDate) {
    if (!firebaseDate) return "Just now";
    return firebaseDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

chatInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && chatInput.value.trim() !== "") {
        const textMessage = chatInput.value.trim();
        chatInput.value = ""; 

        try {
            // NOTE: We now save to the specific channel's subcollection!
            await addDoc(collection(db, "channels", currentChannel, "messages"), {
                user: currentUser,
                pfpUrl: currentUserPfp,
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

mediaUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return alert("Images and short videos only!");

    uploadStatus.classList.remove("hidden");
    
    try {
        const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "channels", currentChannel, "messages"), {
            user: currentUser,
            pfpUrl: currentUserPfp,
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

// Stream real-time messages for the CURRENT channel
function loadMessages(channelName) {
    // If we were listening to another channel, disconnect from it first
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    const q = query(collection(db, "channels", channelName, "messages"), orderBy("timestamp", "asc"));
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = ""; 
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const timeStr = formatTimestamp(data.timestamp);
            
            let mediaContent = "";
            if (data.mediaUrl) {
                if (data.mediaType === "image") {
                    mediaContent = `<img src="${data.mediaUrl}" class="mt-2 max-w-xs md:max-w-md rounded border border-[#232428] max-h-80 object-contain">`;
                } else if (data.mediaType === "video") {
                    mediaContent = `<video src="${data.mediaUrl}" controls class="mt-2 max-w-xs md:max-w-md rounded border border-[#232428] max-h-80"></video>`;
                }
            }

            const avatarHTML = data.pfpUrl 
                ? `<img src="${data.pfpUrl}" class="w-10 h-10 rounded-full object-cover shrink-0">`
                : `<div class="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center font-bold text-white uppercase shrink-0">${data.user.charAt(0)}</div>`;

            const msgHTML = `
                <div class="flex items-start gap-4 hover:bg-[#2e3035]/30 px-4 py-1 -mx-4 transition">
                    ${avatarHTML}
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
