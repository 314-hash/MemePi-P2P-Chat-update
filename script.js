// Register GSAP plugins (if using GSAP, ensure GSAP CDN is loaded in HTML before this script)
if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(); // No specific plugins needed for the animations I added, but good to keep if you add more complex ones
}

// --- Global Constants & Configurations ---
// IMPORTANT: Replace with your actual deployed MemePi token address on Optimism Mainnet or Sepolia
const MEMEPI_TOKEN_ADDRESS = '0x746F0F67a6FB3c7362De547ce3249F37a138A128';
const GATED_ROOMS = { // Define rooms that require a minimum balance
    'memepi_dev': { requiredBalance: 10 } // Example: 10 MEMEPI needed for #memepi-dev
};
const MEMEPI_TOKEN_ABI = [ // Minimal ABI for ERC-20 functions we need
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint256 amount) returns (bool)" // Added for tipping
];

// Uniswap Link Configuration
const UNISWAP_BASE_URL = 'https://app.uniswap.org/swap';
const OPTIMISM_CHAIN_ID_UNISWAP = 'optimism'; // Uniswap app uses 'optimism' string for chain ID
const NATIVE_ETH_UNISWAP_KEYWORD = 'ETH'; // Uniswap app uses 'ETH' for native Ether

// Room Inactivity Timeout (24 hours in milliseconds) - For flagging, not automatic deletion
const ROOM_INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROOMS = ['general', 'memepi_dev', 'random']; // Rooms that are always present

// --- SUPER ADMIN CONFIGURATION ---
// IMPORTANT: REPLACE THIS WITH YOUR OWN GUN.JS PUBLIC KEY
// To get your public key: Log in to your Gun.js account in the app, open console (F12), type `gun.user().is.pub` and copy the output.
const SUPER_ADMIN_PUB_KEY = 'YOUR_ACTUAL_GUN_JS_PUBLIC_KEY_HERE'; 

// --- Gun.js Initialization ---
const gun = Gun({
    peers: [
        'https://gun-manhattan.herokuapp.com/gun',
        'https://gun-us.herokuapp.com/gun',
        'https://gun-eu.herokuapp.com/gun'
    ],
    radisk: true // Enable IndexedDB for local persistence
});

// --- DOM Element References ---
const logoImg = document.getElementById('logo-img'); // For GSAP
const mainTitle = document.querySelector('h1'); // For GSAP
const subtitleLocation = document.querySelector('.subtitle-location'); // For GSAP
const appContainer = document.getElementById('app-container'); // For GSAP

const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const signupButton = document.getElementById('signup-button');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const authStatusSpan = document.getElementById('auth-status');

const walletAddressSpan = document.getElementById('wallet-address');
const memepiBalanceSpan = document.getElementById('memepi-balance');
const connectWalletButton = document.getElementById('connect-wallet-button');
const buyMemepiButton = document.getElementById('buy-memepi-button');

const aiBotToggle = document.getElementById('ai-bot-toggle');

const roomList = document.getElementById('room-list');
const createRoomButton = document.getElementById('create-room-button');
const userList = document.getElementById('user-list');
const typingIndicator = document.getElementById('typing-indicator');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');

// New Moderator UI elements
const moderatorControlsDiv = document.createElement('div');
moderatorControlsDiv.id = 'moderator-controls';
moderatorControlsDiv.innerHTML = `
    <hr style="border-color: var(--border-light); margin: 15px 0;">
    <h3>Moderator Tools</h3>
    <button id="manage-moderators-button" style="display: none; width: calc(100% - 10px); padding: 10px; background-color: var(--primary-purple); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.95em; transition: background-color 0.2s ease, transform 0.1s ease;">Manage Moderators</button>
`;
document.getElementById('sidebar').appendChild(moderatorControlsDiv);

// Modals
const tipModal = document.getElementById('tipModal');
const tipRecipientAliasSpan = document.getElementById('tipRecipientAlias');
const tipAmountInput = document.getElementById('tipAmountInput');
const tipMessageDiv = document.getElementById('tipMessage');
const confirmTipButton = document.getElementById('confirmTipButton');
const cancelTipButton = document.getElementById('cancelTipButton');

const createRoomModal = document.getElementById('createRoomModal');
const newRoomNameInput = document.getElementById('newRoomNameInput');
const createRoomMessageDiv = document.getElementById('createRoomMessage');
const confirmCreateRoomButton = document.getElementById('confirmCreateRoomButton');
const cancelCreateRoomButton = document.getElementById('cancelCreateRoomButton');

// New Moderator Management Modal
const manageModeratorsModal = document.createElement('div');
manageModeratorsModal.id = 'manageModeratorsModal';
manageModeratorsModal.classList.add('modal');
manageModeratorsModal.innerHTML = `
    <div class="modal-content">
        <h3>Manage Chat Moderators</h3>
        <input type="text" id="modAliasInput" placeholder="Enter user's alias">
        <div class="modal-message" id="modMessage"></div>
        <button class="confirm-button" id="addModButton">Add Moderator</button>
        <button class="cancel-button" id="removeModButton">Remove Moderator</button>
        <button class="cancel-button" id="closeModModalButton">Close</button>
        <hr>
        <h4>Current Moderators:</h4>
        <ul id="currentModsList" style="list-style: none; padding: 0; text-align: left;"></ul>
    </div>
`;
document.body.appendChild(manageModeratorsModal);

// References for new moderator modal
const manageModeratorsButton = document.getElementById('manage-moderators-button');
const modAliasInput = document.getElementById('modAliasInput');
const modMessage = document.getElementById('modMessage');
const addModButton = document.getElementById('addModButton');
const removeModButton = document.getElementById('removeModButton');
const closeModModalButton = document.getElementById('closeModModalButton');
const currentModsList = document.getElementById('currentModsList');

// CAPTCHA Modal references
const captchaModal = document.getElementById('captcha-modal');
const captchaChallengeDiv = document.getElementById('captcha-challenge');
const captchaInput = document.getElementById('captcha-input');
const captchaMessageDiv = document.getElementById('captcha-message');
const captchaConfirmButton = document.getElementById('captcha-confirm-button');
const captchaCancelButton = document.getElementById('captcha-cancel-button');

// --- Global State Variables ---
let currentUserAlias = null;
let currentUserPub = null;
let currentRoomName = 'general';
let chatRoomRef = null;
let messageListener = null;
let typingTimeout = null;
let aiBotIsActive = false;
let aiBotLastResponseTime = 0;
const AI_BOT_RESPONSE_DELAY = 3000;

let walletProvider = null;
let walletSigner = null;
let connectedWalletAddress = null;
let memepiContract = null;
let memepiDecimals = 18;

let tippingTargetAlias = null;

// --- Data Maps for UI Rendering ---
const messagesMap = new Map();
const renderedMessageKeys = new Set();
const onlineUsersMap = new Map();
const typingUsersMap = new Map();
const allRoomsMap = new Map();
const moderatorsMap = new Map();

// --- CAPTCHA State ---
let correctCaptchaAnswer = 0;
let captchaCallback = null;

// --- Gun.js User Object ---
const user = gun.user();

// --- AI Bot User Object ---
const aiBotAlias = 'MemePiOracle';
const aiBotPassword = 'memepi-secret-bot-password-123';
const aiBotUser = gun.user();

// --- Helper Functions ---
function isSuperAdmin() {
    return currentUserPub === SUPER_ADMIN_PUB_KEY;
}

function isModerator() {
    return isSuperAdmin() || moderatorsMap.has(currentUserPub);
}

function renderModeratorControls() {
    if (isSuperAdmin()) {
        moderatorControlsDiv.style.display = 'block';
        manageModeratorsButton.style.display = 'block';
    } else {
        moderatorControlsDiv.style.display = 'none';
        manageModeratorsButton.style.display = 'none';
    }
}

// --- UI Update Functions ---

function updateLoginStatus(alias) {
    currentUserAlias = alias;
    currentUserPub = user.is && user.is.pub ? user.is.pub : null;
    console.log('updateLoginStatus called. Alias:', alias, 'currentUserAlias (global):', currentUserAlias, 'currentUserPub:', currentUserPub);
    if (alias) {
        authStatusSpan.textContent = `Logged In: ${alias}`;
        messageInput.disabled = false;
        sendButton.disabled = false;
        authUsernameInput.value = '';
        authPasswordInput.value = '';
        authUsernameInput.disabled = true;
        authPasswordInput.disabled = true;
        signupButton.style.display = 'none';
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        user.get('status').put('online');
        requestNotificationPermission();
    } else {
        authStatusSpan.textContent = 'Not Logged In';
        messageInput.disabled = true;
        sendButton.disabled = true;
        authUsernameInput.disabled = false;
        authPasswordInput.disabled = false;
        signupButton.style.display = 'block';
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        if (currentUserAlias) {
            user.get('status').put('offline');
        }
        currentUserAlias = null;
        currentUserPub = null;
    }
    renderModeratorControls();
}

function appendMessageElement(msg) {
    if (!msg || !msg.text || !msg.sender || !msg.timestamp || renderedMessageKeys.has(msg._id)) {
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    if (msg.sender === currentUserAlias) {
        messageElement.classList.add('my-message');
    } else if (msg.sender === aiBotAlias) {
        messageElement.classList.add('ai-bot-message');
    }

    // GSAP Animation for new messages (NEW)
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(messageElement, 
            { opacity: 0, y: 20, scale: 0.95 }, 
            { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
        );
    }

    const timestamp = new Date(msg.timestamp).toLocaleString();
    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');
    messageContentDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;

    messageElement.appendChild(messageContentDiv);

    if (msg.sender !== currentUserAlias && msg.sender !== aiBotAlias && currentUserAlias && connectedWalletAddress) {
        const tipButton = document.createElement('button');
        tipButton.classList.add('tip-button');
        tipButton.textContent = 'Tip MEMEPI';
        tipButton.onclick = () => openTipModal(msg.sender);
        messageElement.appendChild(tipButton);
    }

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = timestamp;
    messageElement.appendChild(timestampSpan);


    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    renderedMessageKeys.add(msg._id);
}

function initialRenderMessages() {
    messagesDiv.innerHTML = '';
    renderedMessageKeys.clear();
    const sortedMessages = Array.from(messagesMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    sortedMessages.forEach(msg => {
        if (!msg || !msg.text || !msg.sender || !msg.timestamp) {
            return;
        }
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (msg.sender === currentUserAlias) {
            messageElement.classList.add('my-message');
        } else if (msg.sender === aiBotAlias) {
            messageElement.classList.add('ai-bot-message');
        }
        // No GSAP animation on initial render, just append
        if (typeof gsap !== 'undefined') {
             gsap.set(messageElement, { opacity: 1, y: 0, scale: 1 }); // Ensure no GSAP animation interferes with initial render
        } else {
             messageElement.style.animation = 'none'; // Fallback for CSS animation
        }
        

        const timestamp = new Date(msg.timestamp).toLocaleString();
        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');
        messageContentDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
        messageElement.appendChild(messageContentDiv);

        if (msg.sender !== currentUserAlias && msg.sender !== aiBotAlias && currentUserAlias && connectedWalletAddress) {
            const tipButton = document.createElement('button');
            tipButton.classList.add('tip-button');
            tipButton.textContent = 'Tip MEMEPI';
            tipButton.onclick = () => openTipModal(msg.sender);
            messageElement.appendChild(tipButton);
        }

        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = timestamp;
        messageElement.appendChild(timestampSpan);

        messagesDiv.appendChild(messageElement);
        renderedMessageKeys.add(msg._id);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function renderOnlineUsers() {
    userList.innerHTML = '';
    const sortedUsers = Array.from(onlineUsersMap.keys()).sort();
    sortedUsers.forEach(alias => {
        const status = onlineUsersMap.get(alias);
        const userElement = document.createElement('li');
        const dotClass = status === 'online' ? 'online-dot' : 'offline-dot';
        userElement.innerHTML = `<span class="${dotClass}"></span>${alias}`;
        userList.appendChild(userElement);
    });
}

function renderTypingIndicator() {
    const typingAliases = Array.from(typingUsersMap.keys()).filter(alias => {
        return typingUsersMap.get(alias) === true && alias !== currentUserAlias;
    });

    if (typingAliases.length > 0) {
        typingIndicator.textContent = `${typingAliases.join(', ')}`;
        typingIndicator.classList.add('active');
    } else {
        typingIndicator.textContent = '';
        typingIndicator.classList.remove('active');
    }
}

// --- Wallet & Token Gating Logic ---

async function connectWallet() {
    console.log("connectWallet called.");
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            connectedWalletAddress = accounts[0];
            walletAddressSpan.textContent = connectedWalletAddress.substring(0, 6) + '...' + connectedWalletAddress.substring(38);
            connectWalletButton.textContent = 'Wallet Connected';
            connectWalletButton.disabled = true;

            // Initialize Ethers.js provider and signer
            walletProvider = new ethers.providers.Web3Provider(window.ethereum);
            walletSigner = walletProvider.getSigner();

            // Initialize MemePi token contract
            memepiContract = new ethers.Contract(MEMEPI_TOKEN_ADDRESS, MEMEPI_TOKEN_ABI, walletProvider);

            // Get decimals for correct balance display
            memepiDecimals = await memepiContract.decimals();
            console.log('MemePi Token Decimals:', memepiDecimals);

            // Fetch and display balance
            await updateMemePiBalance();

            // Listen for account changes
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            // Re-evaluate room access based on new balance
            await evaluateRoomAccess();
            console.log("Wallet connected successfully:", connectedWalletAddress);

        } catch (error) {
            console.error("User denied account access or other wallet connection error:", error);
            alert("Failed to connect wallet: " + (error.message || "Unknown error. Check console."));
            resetWalletUI();
        }
    } else {
        alert("MetaMask or compatible wallet is not detected. Please install it.");
        console.warn("MetaMask not detected.");
        resetWalletUI();
    }
}

async function updateMemePiBalance() {
    if (connectedWalletAddress && memepiContract) {
        try {
            const balance = await memepiContract.balanceOf(connectedWalletAddress);
            const formattedBalance = ethers.utils.formatUnits(balance, memepiDecimals);
            memepiBalanceSpan.textContent = parseFloat(formattedBalance).toFixed(2);
            console.log("MemePi balance updated:", formattedBalance);
        } catch (error) {
            console.error("Error fetching MemePi balance:", error);
            memepiBalanceSpan.textContent = "Error";
        }
    } else {
        memepiBalanceSpan.textContent = "0.00";
    }
}

function resetWalletUI() {
    console.log("resetWalletUI called.");
    connectedWalletAddress = null;
    walletProvider = null;
    walletSigner = null;
    memepiContract = null;
    walletAddressSpan.textContent = "Not Connected";
    memepiBalanceSpan.textContent = "0.00";
    connectWalletButton.textContent = "Connect Wallet";
    connectWalletButton.disabled = false;
    // Re-evaluate room access (e.g., disable gated rooms)
    evaluateRoomAccess();
}

// Handle account changes (e.g., user switches account in MetaMask)
async function handleAccountsChanged(accounts) {
    console.log('MetaMask: accountsChanged event detected. Accounts:', accounts);
    if (accounts.length === 0) {
        // User disconnected all accounts
        console.log('MetaMask: No accounts connected. Resetting wallet UI.');
        resetWalletUI();
    } else if (accounts[0] !== connectedWalletAddress) {
        connectedWalletAddress = accounts[0];
        console.log('MetaMask: Account changed to:', connectedWalletAddress);
        walletAddressSpan.textContent = connectedWalletAddress.substring(0, 6) + '...' + connectedWalletAddress.substring(38);
        await updateMemePiBalance();
        await evaluateRoomAccess();
    }
}

// Handle chain changes (e.g., user switches network in MetaMask)
async function handleChainChanged(chainId) {
    console.log('MetaMask: Chain changed to:', chainId);
    // Optimism Mainnet Chain ID is 10 (0xA)
    // Optimism Sepolia Testnet Chain ID is 11155420 (0xAA36A7)
    if (chainId !== '0xA' && chainId !== '0xAA36A7') { // Check for Optimism Mainnet or Sepolia
        alert("Please switch to Optimism Mainnet or Sepolia Testnet in your wallet.");
        console.warn(`MetaMask: Incorrect chain detected. Expected 0xA or 0xAA36A7, got ${chainId}.`);
        // Optionally disable chat or wallet features until on correct chain
    }
    // Re-initialize provider/signer if needed and update balance
    if (window.ethereum && connectedWalletAddress) {
        walletProvider = new ethers.providers.Web3Provider(window.ethereum);
        walletSigner = walletProvider.getSigner();
        memepiContract = new ethers.Contract(MEMEPI_TOKEN_ADDRESS, MEMEPI_TOKEN_ABI, walletProvider);
        memepiDecimals = await memepiContract.decimals(); // Re-fetch decimals
        await updateMemePiBalance();
        await evaluateRoomAccess();
    }
}

// Evaluate and update UI for gated rooms
async function evaluateRoomAccess() {
    const currentBalance = parseFloat(memepiBalanceSpan.textContent);
    Array.from(roomList.children).forEach(li => {
        const roomName = li.dataset.room;
        if (GATED_ROOMS[roomName]) {
            const required = GATED_ROOMS[roomName].requiredBalance;
            if (currentBalance < required) {
                li.classList.add('locked-room');
                li.title = `Requires ${required} MEMEPI`;
            } else {
                li.classList.remove('locked-room');
                li.title = '';
            }
        }
    });
    console.log("Room access evaluated.");
}

// --- Buy MEMEPI Logic ---
function buyMemepi() {
    const uniswapUrl = `${UNISWAP_BASE_URL}?chain=${OPTIMISM_CHAIN_ID_UNISWAP}&inputCurrency=${NATIVE_ETH_UNISWAP_KEYWORD}&outputCurrency=${MEMEPI_TOKEN_ADDRESS}`;
    window.open(uniswapUrl, '_blank');
    console.log("Opening Uniswap link:", uniswapUrl);
}

// --- Core Chat Logic ---

async function switchRoom(newRoom) {
    console.log(`Attempting to switch to room: #${newRoom}`);
    if (newRoom === currentRoomName) {
        console.log(`Already in room: #${newRoom}. Aborting switch.`);
        return;
    }

    if (GATED_ROOMS[newRoom]) {
        if (!connectedWalletAddress || !memepiContract) {
            alert("Please connect your wallet to access this gated room.");
            console.warn(`Access denied to #${newRoom}: Wallet not connected.`);
            return;
        }
        const currentBalance = parseFloat(memepiBalanceSpan.textContent);
        const required = GATED_ROOMS[newRoom].requiredBalance;

        if (currentBalance < required) {
            alert(`Access Denied: You need at least ${required} MEMEPI to enter #${newRoom}. Your current balance is ${currentBalance}.`);
            console.warn(`Access denied to #${newRoom}: Insufficient balance (${currentBalance} < ${required}).`);
            return;
        }
    }

    // Check if room is marked inactive (being deleted)
    if (allRoomsMap.has(newRoom) && allRoomsMap.get(newRoom).status === 'inactive') {
        alert(`Room #${newRoom} is currently marked inactive and is being removed.`);
        console.warn(`Attempted to switch to inactive room #${newRoom}.`);
        return;
    }


    if (chatRoomRef && messageListener) {
        console.log(`Unsubscribing from old room: #${currentRoomName}`);
        chatRoomRef.map().off(messageListener);
    }

    messagesMap.clear();
    renderedMessageKeys.clear();
    messagesDiv.innerHTML = '';

    currentRoomName = newRoom;
    chatRoomRef = gun.get(`memepi_chat_room_${currentRoomName}`); // This is where chatRoomRef is assigned
    console.log(`Switched to room: #${currentRoomName}. chatRoomRef is now:`, chatRoomRef);

    messageListener = chatRoomRef.map().on(function(data, key) {
        if (data && data.text && data.sender && data.timestamp) {
            messagesMap.set(key, { ...data, _id: key });
            if (!renderedMessageKeys.has(key)) {
                appendMessageElement({ ...data, _id: key });
            }
            if (data.sender !== currentUserAlias && document.hidden) {
                showNotification(data.sender, data.text, currentRoomName);
            }
            if (aiBotIsActive && data.sender !== aiBotAlias) {
                handleAIBotResponse(data.text);
            }
            updateRoomLastActivity(currentRoomName);
        }
    });

    // For initial load of new room, fetch existing messages and render them without animation
    chatRoomRef.map().once(function(data, key){
        if (data && data.text && data.sender && data.timestamp) {
            messagesMap.set(key, { ...data, _id: key });
        }
    }, () => {
        initialRenderMessages();
    });

    messagesDiv.innerHTML = `<div class="message" style="text-align: center; font-style: italic;">Welcome to #${currentRoomName}!</div>`;
}

// --- Event Listeners ---

gun.on('auth', async function() {
    const alias = await user.get('alias').then();
    updateLoginStatus(alias);
    console.log('Gun.js: User authenticated:', alias, 'currentUserAlias (global):', currentUserAlias, 'currentUserPub:', currentUserPub);
    // Ensure room is set up after authentication
    if (alias) {
        switchRoom(currentRoomName); // Re-switch to current room or default
    }
});

// This attempts to recall previous session. It's crucial for Gun.js user state.
user.recall({ sessionStorage: true });
console.log('Gun.js: User recall initiated.');

signupButton.addEventListener('click', function() {
    captchaCallback = () => { // Define callback for successful CAPTCHA
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();
        if (!username || !password) { alert('Please enter both username and password to sign up.'); return; }
        console.log('Auth: Attempting to create user:', username);
        user.create(username, password, function(ack) {
            if (ack.err) { alert('Sign Up Error: ' + ack.err); console.error('Auth: Sign Up Error:', ack.err); }
            else { alert('Account created successfully! You are now logged in.'); console.log('Auth: Account created:', ack); }
        });
    };
    showCaptcha();
});

loginButton.addEventListener('click', function() {
    captchaCallback = () => { // Define callback for successful CAPTCHA
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();
        if (!username || !password) { alert('Please enter both username and password to log in.'); return; }
        console.log('Auth: Attempting to log in user:', username);
        user.auth(username, password, function(ack) {
            if (ack.err) { alert('Login Error: ' + ack.err); console.error('Auth: Login Error:', ack.err); }
            else { alert('Logged in successfully!'); console.log('Auth: Logged in:', ack); }
            renderModeratorControls(); // Re-evaluate moderator controls after login
        });
    };
    showCaptcha();
});

// Logout Button Listener
logoutButton.addEventListener('click', function() {
    if (user.is) {
        console.log('Auth: Attempting to log out user:', currentUserAlias);
        user.leave();
        updateLoginStatus(null);
        alert('Logged out successfully.');
        console.log('Auth: Logged out.');
    }
});


connectWalletButton.addEventListener('click', connectWallet);
buyMemepiButton.addEventListener('click', buyMemepi);

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// --- Send Message Functionality (with added checks) ---
function sendMessage() {
    console.log('sendMessage called.');
    console.log('  -> currentUserAlias:', currentUserAlias);
    console.log('  -> user.is:', user.is);
    console.log('  -> chatRoomRef:', chatRoomRef);

    if (!user.is || !currentUserAlias) {
        alert("You must be logged in to send messages.");
        console.warn("Message not sent: User not logged in (user.is or currentUserAlias is false/null).");
        return;
    }
    // Ensure chatRoomRef is properly initialized and has a .set method
    if (!chatRoomRef || typeof chatRoomRef.set !== 'function') {
        alert("Cannot send message: Chat room is not ready. Please try switching rooms or refresh the page.");
        console.error("Message not sent: chatRoomRef is null, undefined, or missing 'set' method.");
        return;
    }

    const messageText = messageInput.value.trim();
    if (!messageText) {
        console.warn("Message not sent: Empty message text.");
        return;
    }

    const message = {
        sender: currentUserAlias,
        text: messageText,
        timestamp: Date.now()
    };

    try {
        // This is the core Gun.js operation to add data
        chatRoomRef.set(message);
        console.log("Message sent to Gun.js:", message);
        updateRoomLastActivity(currentRoomName);
    } catch (e) {
        console.error("Error setting message in Gun.js:", e);
        alert("Failed to send message due to an internal error. Check console for details.");
    }


    messageInput.value = '';
    clearTimeout(typingTimeout);
    // Ensure user.get('typing') is valid before calling .put()
    if (user.get('typing')) {
        user.get('typing').put(false);
    } else {
        console.warn("user.get('typing') is undefined, cannot set typing status.");
    }
    typingUsersMap.delete(currentUserAlias);
    renderTypingIndicator();
}

// --- Presence (Online Users) ---
gun.get('~').map().on(function(userNode, userPub) {
    if (userNode && userNode.alias) {
        userNode.get('status').on(function(status) {
            if (status) {
                onlineUsersMap.set(userNode.alias, status);
                renderOnlineUsers();
            } else {
                onlineUsersMap.delete(userNode.alias);
                renderOnlineUsers();
            }
        });
    }
});

window.addEventListener('beforeunload', () => {
    if (user.is) {
        user.get('status').put('offline');
        user.get('typing').put(false);
    }
    if (aiBotIsActive) {
        aiBotUser.get('status').put('offline');
    }
});

// --- Typing Indicator ---
messageInput.addEventListener('input', function() {
    if (!user.is || !currentUserAlias) return;

    // Ensure user.get('typing') is valid before calling .put()
    if (user.get('typing')) {
        user.get('typing').put(true);
    } else {
        console.warn("user.get('typing') is undefined, cannot set typing status.");
    }
    typingUsersMap.set(currentUserAlias, true);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (user.get('typing')) {
            user.get('typing').put(false);
        }
        typingUsersMap.delete(currentUserAlias);
        renderTypingIndicator();
    }, 2000);
});

gun.get('~').map().on(function(userNode, userPub) {
    if (userNode && userNode.alias && userNode.alias !== currentUserAlias) {
        userNode.get('typing').on(function(typingStatus) {
            if (typingStatus === true) {
                typingUsersMap.set(userNode.alias, true);
            } else {
                typingUsersMap.delete(userNode.alias);
            }
            renderTypingIndicator();
        });
    }
});

// --- Desktop Notifications ---
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
        console.log("Notification permission already granted.");
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                console.log("Notification permission granted.");
            }
        });
    }
}

function showNotification(sender, message, room) {
    if (Notification.permission === "granted" && document.hidden) {
        const notification = new Notification(`New message in #${room} from ${sender}`, {
            body: message,
            icon: 'images/memepi-logo.png'
        });
        setTimeout(() => notification.close(), 5000);
    }
}

// --- AI Bot Logic ---

function aiBotLogin() {
    aiBotUser.create(aiBotAlias, aiBotPassword, function(ack) {
        if (ack.err) {
            aiBotUser.auth(aiBotAlias, aiBotPassword, function(authAck) {
                if (authAck.err) { console.error('AI Bot Auth Error:', authAck.err); }
                else { console.log('AI Bot logged in via auth:', authAck); aiBotUser.get('status').put('online'); }
            });
        } else {
            console.log('AI Bot account created and logged in:', ack);
            aiBotUser.get('status').put('online');
        }
    });
    aiBotIsActive = true;
    console.log('MemePi Oracle Bot activated!');
}

function aiBotLogout() {
    aiBotUser.leave();
    aiBotUser.get('status').put('offline');
    aiBotIsActive = false;
    console.log('MemePi Oracle Bot deactivated!');
}

function handleAIBotResponse(messageText) {
    const lowerCaseMessage = messageText.toLowerCase();
    let botResponse = '';

    const now = Date.now();
    if (now - aiBotLastResponseTime < AI_BOT_RESPONSE_DELAY) {
        return;
    }

    if (lowerCaseMessage.includes('hello') || lowerCaseMessage.includes('hi')) {
        botResponse = 'Hello there, fellow MemePi enthusiast!';
    } else if (lowerCaseMessage.includes('how are you')) {
        botResponse = 'As a decentralized oracle, I am always in optimal state! How about you?';
    } else if (lowerCaseMessage.includes('what is memepi')) {
        botResponse = 'MemePi is a community-driven token on the Optimism Superchain, focused on fun, innovation, and decentralized growth! We are building exciting utilities!';
    } else if (lowerCaseMessage.includes('optimism')) {
        botResponse = 'Optimism is a fast, stable, and scalable Layer 2 blockchain. It\'s where MemePi thrives!';
    } else if (lowerCaseMessage.includes('joke')) {
        botResponse = 'Why did the crypto investor break up with the blockchain? Because he couldn\'t see a future with all those blocks!';
    } else if (lowerCaseMessage.includes('thank you') || lowerCaseMessage.includes('thanks')) {
        botResponse = 'You\'re most welcome! Always here to assist.';
    } else if (lowerCaseMessage.includes('bye')) {
        botResponse = 'Farewell for now! May your memes be plentiful and your transactions swift!';
    } else if (lowerCaseMessage.includes('coin price') || lowerCaseMessage.includes('price')) {
        botResponse = 'I cannot give financial advice, nor can I access real-time market data. Always DYOR!';
    } else if (lowerCaseMessage.includes('utility')) {
        botResponse = 'We\'re planning features like staking, governance, and more DeFi integrations! Stay tuned!';
    }

    if (botResponse) {
        aiBotLastResponseTime = now;
        setTimeout(() => {
            // Make sure botMessage is defined before using it
            const botMessage = {
                sender: aiBotAlias,
                text: botResponse,
                timestamp: Date.now()
            };
            chatRoomRef.set(botMessage);
        }, Math.random() * 1500 + 500);
    }
}

aiBotToggle.addEventListener('change', function() {
    if (this.checked) {
        aiBotLogin();
    } else {
        aiBotLogout();
    }
});

// --- Tipping Logic ---
function openTipModal(recipientAlias) {
    if (!connectedWalletAddress || !walletSigner || !memepiContract) {
        alert("Please connect your wallet to send MEMEPI tips.");
        console.warn("Tip attempt failed: Wallet not connected.");
        return;
    }
    if (recipientAlias === currentUserAlias) {
        alert("You cannot tip yourself!");
        console.warn("Tip attempt failed: Cannot tip self.");
        return;
    }
    if (recipientAlias === aiBotAlias) {
         alert("You cannot tip the MemePi Oracle Bot.");
         console.warn("Tip attempt failed: Cannot tip AI bot.");
         return;
    }

    tippingTargetAlias = recipientAlias;
    tipRecipientAliasSpan.textContent = recipientAlias;
    tipAmountInput.value = '';
    tipMessageDiv.textContent = '';
    showModal(tipModal); // Use GSAP for modal opening
}

async function sendTip() {
    const amount = parseFloat(tipAmountInput.value);
    if (isNaN(amount) || amount <= 0) {
        tipMessageDiv.textContent = 'Please enter a valid amount.';
        tipMessageDiv.style.color = 'var(--error-red)';
        console.warn("Tip attempt failed: Invalid amount entered.");
        return;
    }

    // Get recipient's wallet address from their Gun.js user data
    const recipientUserNode = gun.get('~').get(tippingTargetAlias);
    let recipientWalletAddress = null;

    // Use .once() to fetch the public key/wallet address
    // This is asynchronous, so we need to ensure recipientWalletAddress is set before proceeding
    // Wrap the rest of the sendTip logic in an async block or promise chain
    await new Promise(resolve => {
        recipientUserNode.get('pub').once(pub => {
            if (pub) {
                recipientWalletAddress = pub;
                console.log(`Found recipient wallet address for ${tippingTargetAlias}: ${recipientWalletAddress}`);
            } else {
                console.error(`Could not retrieve public key (wallet address) for alias: ${tippingTargetAlias}. User might not have a public wallet associated with their Gun account.`);
            }
            resolve(); // Resolve the promise once pub is checked
        });
    });


    if (!recipientWalletAddress) {
        tipMessageDiv.textContent = `Could not find wallet address for ${tippingTargetAlias}. User might not have a public wallet associated with their Gun account.`;
        tipMessageDiv.style.color = 'var(--error-red)';
        return;
    }

    tipMessageDiv.textContent = 'Confirming transaction in wallet...';
    tipMessageDiv.style.color = 'var(--text-color)';

    try {
        const amountWei = ethers.utils.parseUnits(amount.toString(), memepiDecimals);
        const memepiContractWithSigner = memepiContract.connect(walletSigner);
        
        console.log(`Sending ${amount} MEMEPI to ${recipientWalletAddress}...`);
        const tx = await memepiContractWithSigner.transfer(recipientWalletAddress, amountWei);
        
        tipMessageDiv.textContent = `Transaction sent! Waiting for confirmation... Tx Hash: ${tx.hash.substring(0, 10)}...`;
        tipMessageDiv.style.color = 'var(--success-green)';
        console.log('Tip transaction sent:', tx);

        await tx.wait();

        tipMessageDiv.textContent = `Tip of ${amount} MEMEPI sent to ${tippingTargetAlias} successfully!`;
        tipMessageDiv.style.color = 'var(--success-green)';
        console.log('Tip transaction confirmed:', tx);

        const tipMessage = {
            sender: currentUserAlias,
            text: `Tipped ${tippingTargetAlias} ${amount} MEMEPI! 🎉`,
            timestamp: Date.now()
        };
        chatRoomRef.set(tipMessage);
        updateMemePiBalance();

        setTimeout(() => hideModal(tipModal), 2000); // Use GSAP for modal closing

    } catch (error) {
        console.error("Error sending tip:", error);
        tipMessageDiv.textContent = `Error sending tip: ${error.message || error.code}`;
        tipMessageDiv.style.color = 'var(--error-red)';
    }
}

// --- Room Creation Logic ---
createRoomButton.addEventListener('click', () => {
    if (!user.is || !currentUserAlias) {
        alert("You must be logged in to create a room.");
        console.warn("Create room failed: User not logged in.");
        return;
    }
    newRoomNameInput.value = '';
    createRoomMessageDiv.textContent = '';
    showModal(createRoomModal); // Use GSAP for modal opening
});

confirmCreateRoomButton.addEventListener('click', createNewRoom);

async function createNewRoom() {
    let newRoomName = newRoomNameInput.value.trim().toLowerCase();
    if (!newRoomName) {
        createRoomMessageDiv.textContent = 'Room name cannot be empty.';
        createRoomMessageDiv.style.color = 'var(--error-red)';
        return;
    }
    if (!/^[a-z0-9_-]+$/.test(newRoomName)) {
        createRoomMessageDiv.textContent = 'Room name can only contain lowercase letters, numbers, hyphens, or underscores.';
        createRoomMessageDiv.style.color = 'var(--error-red)';
        return;
    }
    if (newRoomName.startsWith('#')) {
        newRoomName = newRoomName.substring(1);
    }

    // Check if room already exists
    if (allRoomsMap.has(newRoomName)) {
        createRoomMessageDiv.textContent = `Room #${newRoomName} already exists.`;
        createRoomMessageDiv.style.color = 'var(--error-red)';
        return;
    }

    const roomData = {
        name: newRoomName,
        creator: currentUserAlias,
        creatorPub: currentUserPub, // Store creator's public key (for metadata, not deletion rights)
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: 'active'
    };

    gun.get('memepi_all_rooms').get(newRoomName).put(roomData, (ack) => {
        if (ack.err) {
            createRoomMessageDiv.textContent = `Error creating room: ${ack.err}`;
            createRoomMessageDiv.style.color = 'var(--error-red)';
            console.error('Error creating room:', ack.err);
        } else {
            createRoomMessageDiv.textContent = `Room #${newRoomName} created successfully!`;
            createRoomMessageDiv.style.color = 'var(--success-green)';
            console.log(`Room #${newRoomName} created.`);
            setTimeout(() => hideModal(createRoomModal), 1500); // Use GSAP for modal closing
        }
    });
}


// --- Room Inactivity Logic & Moderator Deletion ---

gun.get('memepi_all_rooms').map().on(function(roomData, roomName) {
    if (roomData && roomName) {
        if (roomData === null) {
            console.log(`Room #${roomName} detected as null (deleted). Removing from map.`);
            allRoomsMap.delete(roomName);
        } else {
            console.log(`Updating room map for #${roomName}:`, roomData);
            allRoomsMap.set(roomName, roomData);
        }
        renderRoomList();
    }
});

function updateRoomLastActivity(roomName) {
    if (DEFAULT_ROOMS.includes(roomName)) {
        return;
    }
    gun.get('memepi_all_rooms').get(roomName).get('lastActivity').put(Date.now(), (ack) => {
        if (ack.err) {
            console.error(`Error updating lastActivity for room ${roomName}:`, ack.err);
        } else {
            console.log(`Updated lastActivity for room #${roomName}.`);
        }
    });
}

function renderRoomList() {
    console.log("Rendering room list...");
    roomList.innerHTML = '';

    const roomsToRender = new Map();

    DEFAULT_ROOMS.forEach(roomName => {
        roomsToRender.set(roomName, {
            name: roomName,
            creator: 'System',
            creatorPub: 'system_pub_key', // Placeholder for system rooms
            createdAt: 0,
            lastActivity: Infinity,
            status: 'active'
        });
    });

    Array.from(allRoomsMap.entries()).forEach(([roomName, roomData]) => {
        if (!DEFAULT_ROOMS.includes(roomName)) {
            roomsToRender.set(roomName, { name: roomName, ...roomData });
        }
    });

    const sortedRooms = Array.from(roomsToRender.values()).sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name);
    });

    sortedRooms.forEach(room => {
        const li = document.createElement('li');
        li.dataset.room = room.name;
        li.textContent = `#${room.name}`;

        if (room.name === currentRoomName) {
            li.classList.add('active');
        }

        if (GATED_ROOMS[room.name]) {
            const lockSpan = document.createElement('span');
            lockSpan.classList.add('lock-icon');
            lockSpan.textContent = '🔒';
            li.appendChild(lockSpan);
            if (room.name !== currentRoomName) {
                li.classList.add('locked-room');
                li.title = `Requires ${GATED_ROOMS[room.name].requiredBalance} MEMEPI`;
            }
        }

        // Flag inactive rooms visually, but don't auto-delete
        if (room.status === 'active' && room.lastActivity !== Infinity && (Date.now() - room.lastActivity) > ROOM_INACTIVITY_TIMEOUT_MS) {
            li.classList.add('inactive-room');
            li.title = `Inactive for >${ROOM_INACTIVITY_TIMEOUT_MS / (60 * 60 * 1000)}h. Moderator can remove.`;
        } else if (room.status === 'inactive') {
             li.classList.add('inactive-room');
             li.title = `Room #${room.name} is being deleted due to inactivity.`;
        }

        // Moderator Delete Icon
        if (isModerator()) { // Only show delete icon if current user is a moderator
            const deleteIcon = document.createElement('span');
            deleteIcon.textContent = ' 🗑️'; // Trash can emoji
            deleteIcon.style.cursor = 'pointer';
            deleteIcon.style.marginLeft = 'auto'; // Push it to the right
            deleteIcon.title = `Moderator: Click to remove room #${room.name}`;
            deleteIcon.classList.add('moderator-delete-room');

            deleteIcon.addEventListener('click', async (event) => {
                event.stopPropagation(); // Prevent the li's click event from firing
                const confirmDelete = confirm(`As a moderator, do you want to remove room #${room.name} from the public list? This action is irreversible for public visibility.`);
                if (confirmDelete) {
                    deleteRoom(room.name);
                }
            });
            li.appendChild(deleteIcon);
        }

        li.addEventListener('click', async () => {
            // Allow switching to active rooms
            if (!li.classList.contains('inactive-room') || room.status === 'active') {
                await switchRoom(room.name);
            } else {
                // If it's an inactive room, only moderators can initiate removal
                if (isModerator()) {
                    const confirmDelete = confirm(`Room #${room.name} is inactive. As a moderator, do you want to remove it from the list for everyone?`);
                    if (confirmDelete) {
                        deleteRoom(room.name);
                    }
                } else {
                    alert(`Room #${room.name} is inactive and can only be removed by a moderator.`);
                }
            }
        });
        roomList.appendChild(li);
    });
    evaluateRoomAccess();
}

// Modified deleteRoom: only moderators can delete
function deleteRoom(roomName) {
    if (!isModerator()) {
        alert("You are not authorized to delete rooms.");
        console.warn(`Unauthorized attempt to delete room #${roomName} by ${currentUserAlias}.`);
        return;
    }

    if (DEFAULT_ROOMS.includes(roomName)) {
        console.warn(`Moderator attempted to delete default room #${roomName}. Aborting.`);
        alert(`Default room #${roomName} cannot be deleted.`); // User feedback
        return;
    }

    console.log(`Moderator (${currentUserAlias}) initiating deletion for room #${roomName}.`);

    // Proceed with marking inactive and nullifying
    gun.get('memepi_all_rooms').get(roomName).get('status').put('inactive', (ack) => {
         if (ack.err) { console.error(`Error marking room #${roomName} inactive:`, ack.err); return; }
         console.log(`Room #${roomName} marked inactive. Now attempting to nullify.`);
         gun.get('memepi_all_rooms').get(roomName).put(null, (ack2) => {
             if (ack2.err) {
                 console.error(`Error deleting room #${roomName}:`, ack2.err);
             } else {
                 console.log(`Room #${roomName} successfully deleted.`);
                 if (currentRoomName === roomName) {
                     switchRoom('general');
                 }
             }
         });
    });
}

// --- Moderator Management Logic ---
gun.get('memepi_global_moderators').map().on(function(isMod, pubKey) {
    if (isMod === true) {
        moderatorsMap.set(pubKey, true);
    } else if (isMod === null) {
        moderatorsMap.delete(pubKey);
    }
    renderCurrentModsList();
    renderRoomList(); // Re-render room list to update delete icons
});

function renderCurrentModsList() {
    currentModsList.innerHTML = '';
    // Display super admin first
    const superAdminLi = document.createElement('li');
    superAdminLi.textContent = `(Super Admin) ${SUPER_ADMIN_PUB_KEY.substring(0, 10)}...`;
    superAdminLi.style.fontWeight = 'bold';
    superAdminLi.style.color = 'var(--primary-purple)';
    currentModsList.appendChild(superAdminLi);

    moderatorsMap.forEach((_, pubKey) => {
        if (pubKey !== SUPER_ADMIN_PUB_KEY) { // Don't list super admin again
            const li = document.createElement('li');
            // Fetch alias for display, if available
            gun.get('~').get(pubKey).get('alias').once(alias => {
                li.textContent = `${alias || pubKey.substring(0, 10) + '...'}` + (alias ? '' : ' (PubKey)');
            });
            currentModsList.appendChild(li);
        }
    });
    if (moderatorsMap.size === 0 && SUPER_ADMIN_PUB_KEY) { // If only super admin
        const li = document.createElement('li');
        li.textContent = "No additional moderators.";
        currentModsList.appendChild(li);
    }
}

async function addModerator() {
    if (!isSuperAdmin()) {
        modMessage.textContent = 'Only the Super Admin can add moderators.';
        modMessage.style.color = 'var(--error-red)';
        return;
    }

    const alias = modAliasInput.value.trim();
    if (!alias) {
        modMessage.textContent = 'Please enter an alias.';
        modMessage.style.color = 'var(--error-red)';
        return;
    }

    modMessage.textContent = 'Fetching user public key...';
    modMessage.style.color = 'var(--text-color)';

    // Fetch user's public key by alias
    const userRef = gun.get('~@' + alias);
    userRef.get('pub').once(pubKey => {
        if (pubKey) {
            if (pubKey === SUPER_ADMIN_PUB_KEY) {
                modMessage.textContent = 'You are already the Super Admin.';
                modMessage.style.color = 'var(--error-red)';
                return;
            }
            if (moderatorsMap.has(pubKey)) {
                modMessage.textContent = `${alias} is already a moderator.`;
                modMessage.style.color = 'var(--error-red)';
                return;
            }
            gun.get('memepi_global_moderators').get(pubKey).put(true, (ack) => {
                if (ack.err) {
                    modMessage.textContent = `Error adding moderator: ${ack.err}`;
                    modMessage.style.color = 'var(--error-red)';
                    console.error('Add Moderator Error:', ack.err);
                } else {
                    modMessage.textContent = `${alias} added as moderator!`;
                    modMessage.style.color = 'var(--success-green)';
                    modAliasInput.value = '';
                }
            });
        } else {
            modMessage.textContent = `User '${alias}' not found or has no public key.`;
            modMessage.style.color = 'var(--error-red)';
        }
    });
}

async function removeModerator() {
    if (!isSuperAdmin()) {
        modMessage.textContent = 'Only the Super Admin can remove moderators.';
        modMessage.style.color = 'var(--error-red)';
        return;
    }

    const alias = modAliasInput.value.trim();
    if (!alias) {
        modMessage.textContent = 'Please enter an alias.';
        modMessage.style.color = 'var(--error-red)';
        return;
    }

    modMessage.textContent = 'Fetching user public key...';
    modMessage.style.color = 'var(--text-color)';

    const userRef = gun.get('~@' + alias);
    userRef.get('pub').once(pubKey => {
        if (pubKey) {
            if (pubKey === SUPER_ADMIN_PUB_KEY) {
                modMessage.textContent = 'Cannot remove Super Admin.';
                modMessage.style.color = 'var(--error-red)';
                return;
            }
            if (!moderatorsMap.has(pubKey)) {
                modMessage.textContent = `${alias} is not a moderator.`;
                modMessage.style.color = 'var(--error-red)';
                return;
            }
            gun.get('memepi_global_moderators').get(pubKey).put(null, (ack) => {
                if (ack.err) {
                    modMessage.textContent = `Error removing moderator: ${ack.err}`;
                    modMessage.style.color = 'var(--error-red)';
                    console.error('Remove Moderator Error:', ack.err);
                } else {
                    modMessage.textContent = `${alias} removed as moderator.`;
                    modMessage.style.color = 'var(--success-green)';
                    modAliasInput.value = '';
                }
            });
        } else {
            modMessage.textContent = `User '${alias}' not found or has no public key.`;
            modMessage.style.color = 'var(--error-red)';
        }
    });
}

// --- CAPTCHA Logic ---
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    correctCaptchaAnswer = num1 + num2;
    captchaChallengeDiv.textContent = `${num1} + ${num2} = ?`;
    captchaInput.value = '';
    captchaMessageDiv.textContent = '';
    showModal(captchaModal); // Use GSAP for modal opening
    captchaInput.focus();
}

function verifyCaptcha() {
    const userAnswer = parseInt(captchaInput.value, 10);
    if (userAnswer === correctCaptchaAnswer) {
        hideModal(captchaModal); // Use GSAP for modal closing
        if (captchaCallback) {
            captchaCallback();
        }
    } else {
        captchaMessageDiv.textContent = 'Incorrect answer. Please try again.';
        captchaMessageDiv.style.color = 'var(--error-red)';
        captchaInput.value = '';
        captchaInput.focus();
        generateCaptcha();
    }
}

function showCaptcha() {
    generateCaptcha();
    showModal(captchaModal);
}

// --- GSAP Modal Open/Close Functions (NEW) ---
function showModal(modalElement) {
    modalElement.style.display = 'flex'; // Make it visible for GSAP to animate
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(modalElement, 
            { opacity: 0 }, 
            { opacity: 1, duration: 0.3, ease: "power2.out" }
        );
        gsap.fromTo(modalElement.querySelector('.modal-content'),
            { scale: 0.8, opacity: 0, y: -50 },
            { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" }
        );
    }
}

function hideModal(modalElement) {
    if (typeof gsap !== 'undefined') {
        gsap.to(modalElement.querySelector('.modal-content'), {
            scale: 0.8, opacity: 0, y: 50, duration: 0.3, ease: "power2.in",
            onComplete: () => {
                gsap.to(modalElement, {
                    opacity: 0, duration: 0.2, ease: "power2.in",
                    onComplete: () => {
                        modalElement.style.display = 'none'; // Hide completely after animation
                    }
                });
            }
        });
    } else {
        modalElement.style.display = 'none'; // Fallback
    }
}

// --- Modals Event Listeners ---
cancelTipButton.addEventListener('click', () => hideModal(tipModal));
confirmTipButton.addEventListener('click', sendTip);
cancelCreateRoomButton.addEventListener('click', () => hideModal(createRoomModal));
confirmCreateRoomButton.addEventListener('click', createNewRoom);

manageModeratorsButton.addEventListener('click', () => {
    if (isSuperAdmin()) {
        showModal(manageModeratorsModal); // Use GSAP for modal opening
        renderCurrentModsList();
        modAliasInput.value = '';
        modMessage.textContent = '';
    } else {
        alert("You are not authorized to manage moderators.");
    }
});
addModButton.addEventListener('click', addModerator);
removeModButton.addEventListener('click', removeModerator);
closeModModalButton.addEventListener('click', () => hideModal(manageModeratorsModal));

captchaConfirmButton.addEventListener('click', verifyCaptcha);
captchaCancelButton.addEventListener('click', () => {
    hideModal(captchaModal);
    captchaCallback = null;
});
captchaInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        verifyCaptcha();
    }
});


// --- GSAP Page Load & Element Animations (NEW) ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial states for elements to be animated by GSAP
    if (typeof gsap !== 'undefined') {
        gsap.set(logoImg, { opacity: 0, scale: 0.5, y: -50 });
        gsap.set(mainTitle, { opacity: 0, y: 30 });
        gsap.set(subtitleLocation, { opacity: 0, y: 20 });
        gsap.set(appContainer, { opacity: 0, scale: 0.8 });
        gsap.set(['#auth-section button', '.abstract-element'], { opacity: 0 }); // Hide other elements

        // Main Intro Timeline
        const introTl = gsap.timeline({ defaults: { ease: "power3.out" } });

        introTl
            .to("body", { duration: 0.5, opacity: 1, ease: "none" })
            .to(logoImg, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.7)" })
            .to(logoImg, { scale: 1.02, repeat: -1, yoyo: true, duration: 2, ease: "power1.inOut" }, "-=0.2") // Start pulse after initial pop
            .to(mainTitle, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, "<0.2")
            .to(subtitleLocation, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "<0.1")
            .to(appContainer, { opacity: 1, scale: 1, duration: 1, ease: "elastic.out(1, 0.5)" }, "-=0.5")
            .to('#auth-section button', { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "back.out(1.7)" }, "-=0.7");

        // Abstract elements animation
        gsap.fromTo(document.querySelector('.star-1'), { rotation: 0 }, {
            rotation: 360,
            x: 'random(-50, 50)',
            y: 'random(-50, 50)',
            repeat: -1,
            duration: 15,
            ease: "none"
        });
        gsap.fromTo(document.querySelector('.star-2'), { rotation: 0 }, {
            rotation: -360,
            x: 'random(-30, 30)',
            y: 'random(-30, 30)',
            repeat: -1,
            duration: 20,
            ease: "none"
        });
        gsap.fromTo(document.querySelector('.squiggle'), 
            { opacity: 0, scale: 0.5 }, 
            { opacity: 0.7, scale: 1, duration: 1.5, ease: "elastic.out(1, 0.5)" }
        );
        gsap.to(document.querySelector('.squiggle'), {
            x: '+=20',
            y: '+=10',
            repeat: -1,
            yoyo: true,
            duration: 8,
            ease: "power1.inOut"
        });
    }
});

// --- Initialization ---
console.log("MemePi Chat App: Initializing...");

// Add default rooms if they don't exist in the Gun.js graph initially
DEFAULT_ROOMS.forEach(roomName => {
    gun.get('memepi_all_rooms').get(roomName).once(data => {
        if (!data) {
            console.log(`Creating default room #${roomName} as it does not exist.`);
            gun.get('memepi_all_rooms').get(roomName).put({
                name: roomName,
                creator: 'System',
                creatorPub: 'system_pub_key', // Placeholder for system rooms
                createdAt: 0,
                lastActivity: Infinity,
                status: 'active'
            });
        }
    });
});

// Initialize UI status based on current user state
// This ensures updateLoginStatus and switchRoom are called AFTER Gun.js user recall/auth is processed
gun.on('auth', async function() {
    const alias = await user.get('alias').then();
    updateLoginStatus(alias);
    console.log('Gun.js: User authenticated:', alias, 'currentUserAlias (global):', currentUserAlias, 'currentUserPub:', currentUserPub);
    // After successful login/recall, switch to the current room (or default)
    if (alias) {
        switchRoom(currentRoomName);
    }
});

// If user is already logged in from previous session, recall their state
user.recall({ sessionStorage: true });
console.log('Gun.js: User recall initiated.');

// Initial display for users not yet logged in or recalled
if (!user.is) {
    messagesDiv.innerHTML = '<div class="message" style="text-align: center; font-style: italic;">Welcome! Please sign up or log in to chat.</div>';
    updateLoginStatus(null); // Set initial UI for not logged in
}

// Initial check for wallet connection on load
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
            if (accounts.length > 0) {
                console.log("MetaMask: Found existing wallet connection, attempting to re-connect.");
                connectWallet();
            } else {
                console.log("MetaMask: No existing wallet connection found on load.");
            }
        })
        .catch(error => console.error("MetaMask: Error checking existing accounts on load:", error));
} else {
    console.warn("MetaMask or compatible wallet not detected in browser.");
}
console.log("MemePi Chat App: Initialization complete.");


// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js', { scope: './' })
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    });
}
