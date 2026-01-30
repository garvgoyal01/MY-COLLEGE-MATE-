/**
 * Simple SPA Router and State Management with Authentication
 */

// --- Auth Service ---
const AuthService = {
    STORAGE_KEY_USERS: 'collegemate_users',
    STORAGE_KEY_SESSION: 'collegemate_session',

    // Temporary state for OTP flow
    pendingDetails: null, // { email, password, ...otherData, type: 'LOGIN' | 'SIGNUP' }
    otp: null,
    otpExpiry: null,

    getUsers() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY_USERS) || '[]');
    },

    saveUser(user) {
        const users = this.getUsers();
        // Check if email exists
        if (users.find(u => u.email === user.email)) {
            throw new Error('Email already registered');
        }
        users.push({ ...user, isVerified: true }); // Mark verified on save
        localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
        return user;
    },

    // Step 1: Initiate Login (Check creds -> Send OTP)
    initiateLogin(email, password) {
        const users = this.getUsers();
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            throw new Error('Invalid email or password');
        }

        // Credentials OK, start OTP
        this.pendingDetails = { ...user, type: 'LOGIN' };
        this.generateAndSendOTP(email);
        return true;
    },

    // Step 1: Initiate Signup (Store details -> Send OTP)
    initiateSignup(user) {
        const users = this.getUsers();
        if (users.find(u => u.email === user.email)) {
            throw new Error('Email already registered');
        }

        this.pendingDetails = { ...user, type: 'SIGNUP' };
        this.generateAndSendOTP(user.email);
        return true;
    },

    generateAndSendOTP(email) {
        // Generate 6 digit code
        this.otp = Math.floor(100000 + Math.random() * 900000).toString();
        this.otpExpiry = Date.now() + 60000; // 1 minute

        // Mock Send
        console.log(`[MOCK EMAIL SERVICE] Sending OTP to ${email}: ${this.otp}`);

        // In real app, this would be backend call.
        // For demo, we alert user slightly delayed so they get UI feedback first
        setTimeout(() => {
            alert(`🔐 COLLEGE MATE OTP\n\nYour verification code is: ${this.otp}\n\n(Valid for 60 seconds)`);
        }, 500);
    },

    verifyOTP(inputOTP) {
        if (!this.pendingDetails || !this.otp) {
            throw new Error('No pending verification found.');
        }

        if (Date.now() > this.otpExpiry) {
            this.otp = null;
            throw new Error('OTP Expired. Please resend.');
        }

        if (inputOTP === this.otp) {
            // Success!
            const details = this.pendingDetails;

            if (details.type === 'SIGNUP') {
                // Remove type field and save
                const { type, ...userData } = details;
                this.saveUser(userData);
                this.loginInternal(userData);
            } else if (details.type === 'LOGIN') {
                this.loginInternal(details);
            }

            // Clear pending
            this.pendingDetails = null;
            this.otp = null;
            return true;
        }

        throw new Error('Incorrect OTP. Please try again.');
    },

    loginInternal(user) {
        localStorage.setItem(this.STORAGE_KEY_SESSION, JSON.stringify(user));
    },

    logout() {
        localStorage.removeItem(this.STORAGE_KEY_SESSION);
        window.location.hash = '/';
        window.location.reload();
    },

    getCurrentUser() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY_SESSION));
    },

    isLoggedIn() {
        return !!this.getCurrentUser();
    },

    requireAuth(action) {
        if (!this.isLoggedIn()) {
            window.location.hash = '/login';
            return false;
        }
        return true;
    }
};

// --- Storage Service (for dynamic content) ---
const StorageService = {
    KEY_UPLOADS: 'collegemate_uploads',

    getUploads() {
        return JSON.parse(localStorage.getItem(this.KEY_UPLOADS) || '[]');
    },

    addUpload(item) {
        const uploads = this.getUploads();
        uploads.push({ ...item, id: Date.now(), isCustom: true });
        localStorage.setItem(this.KEY_UPLOADS, JSON.stringify(uploads));
    }
};

// --- Bunk Poll Service ---
const BunkPollService = {
    STORAGE_KEY_VOTES: 'collegemate_bunk_votes',
    STORAGE_KEY_VOTED_TODAY: 'collegemate_bunk_voted_today',
    STORAGE_KEY_POLL_DATE: 'collegemate_bunk_poll_date',
    POLL_OPTIONS: ['Yes 😎', 'No 🤓', 'Maybe 🤔'],

    getTodayDate() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    },

    resetIfNewDay() {
        const lastDate = localStorage.getItem(this.STORAGE_KEY_POLL_DATE);
        const today = this.getTodayDate();
        
        if (lastDate !== today) {
            // New day - reset votes
            localStorage.setItem(this.STORAGE_KEY_VOTES, JSON.stringify({ 'Yes 😎': 0, 'No 🤓': 0, 'Maybe 🤔': 0 }));
            localStorage.setItem(this.STORAGE_KEY_POLL_DATE, today);
            localStorage.removeItem(this.STORAGE_KEY_VOTED_TODAY);
        }
    },

    getVotes() {
        this.resetIfNewDay();
        const votes = localStorage.getItem(this.STORAGE_KEY_VOTES);
        if (!votes) {
            const defaultVotes = { 'Yes 😎': 0, 'No 🤓': 0, 'Maybe 🤔': 0 };
            localStorage.setItem(this.STORAGE_KEY_VOTES, JSON.stringify(defaultVotes));
            return defaultVotes;
        }
        return JSON.parse(votes);
    },

    hasVotedToday() {
        this.resetIfNewDay();
        return !!localStorage.getItem(this.STORAGE_KEY_VOTED_TODAY);
    },

    addVote(option) {
        if (this.hasVotedToday()) {
            return { success: false, message: 'You have already voted today! Come back tomorrow.' };
        }

        if (!this.POLL_OPTIONS.includes(option)) {
            return { success: false, message: 'Invalid option.' };
        }

        const votes = this.getVotes();
        votes[option] = (votes[option] || 0) + 1;
        localStorage.setItem(this.STORAGE_KEY_VOTES, JSON.stringify(votes));
        localStorage.setItem(this.STORAGE_KEY_VOTED_TODAY, 'true');

        return { success: true, message: 'Vote recorded! Thanks for participating 🎉' };
    },

    getResults() {
        const votes = this.getVotes();
        const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
        
        return {
            votes,
            total,
            percentages: {
                'Yes 😎': total > 0 ? Math.round((votes['Yes 😎'] / total) * 100) : 0,
                'No 🤓': total > 0 ? Math.round((votes['No 🤓'] / total) * 100) : 0,
                'Maybe 🤔': total > 0 ? Math.round((votes['Maybe 🤔'] / total) * 100) : 0
            }
        };
    }
};

// --- Mock Data (Content only) ---
const CONTENT_DATA = {
    notices: [
        { id: 1, title: "End Semester Exams Schedule", date: "2 hrs ago", type: "academic", content: "The end semester exams will commence from May 15th. Detailed datesheet attached." },
        { id: 2, title: "TechFest Registration Open", date: "1 day ago", type: "event", content: "Register for the annual TechFest. Early bird tickets available till Friday." },
        { id: 3, title: "Library Due Date Extended", date: "2 days ago", type: "admin", content: "All books due this week can be returned by next Monday without fine." }
    ],
    events: [
        { id: 1, title: "Hackathon 2026", date: "Feb 15", time: "10:00 AM", venue: "Main Auditorium", image: "https://placehold.co/600x300/4f46e5/ffffff?text=Hackathon", organizer: "Coding Club" },
        { id: 2, title: "Robotics Workshop", date: "Feb 18", time: "02:00 PM", venue: "Lab 3", image: "https://placehold.co/600x300/10b981/ffffff?text=Robotics", organizer: "RoboSoc" },
        { id: 3, title: "Cultural Night", date: "Feb 25", time: "06:00 PM", venue: "Open Air Theatre", image: "https://placehold.co/600x300/f43f5e/ffffff?text=Cultural+Night", organizer: "Arts Society" }
    ],
    societies: [
        { id: 1, name: "Coding Club", category: "Tech", members: 120, logo: "https://placehold.co/100/4f46e5/ffffff?text=CC", desc: "For the love of code." },
        { id: 2, name: "RoboSoc", category: "Tech", members: 85, logo: "https://placehold.co/100/10b981/ffffff?text=RS", desc: "Building the future, one bot at a time." },
        { id: 3, name: "Shutterbugs", category: "Arts", members: 50, logo: "https://placehold.co/100/f43f5e/ffffff?text=SB", desc: "Capturing moments." }
    ],
    studyMaterial: {
        "Semester 1": [
            { name: "Maths Handbook", file: "https://drive.google.com/file/d/10jZONPm6VC3dHeNh4IdRmDBjErWrzqhl/view" }
        ],
        "Semester 2": [],
        "Semester 3": [],
        "Semester 4": []
    }
};

// --- Exam Mode Data ---
const EXAM_DATA = {
    1: {
        subjects: [
            {
                name: 'Applied Mathematics-I',
                questions: 'https://drive.google.com/file/d/YOUR_MATH1_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_MATH1_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_MATH1_NOTES/view?usp=sharing'
            },
            {
                name: 'Applied Physics-I',
                questions: 'https://drive.google.com/file/d/YOUR_PHYSICS1_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_PHYSICS1_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_PHYSICS1_NOTES/view?usp=sharing'
            },
            {
                name: 'Chemistry',
                questions: 'https://drive.google.com/file/d/YOUR_CHEM_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CHEM_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CHEM_NOTES/view?usp=sharing'
            },
            {
                name: 'Electrical Science ',
                questions: 'https://drive.google.com/file/d/YOUR_PROG_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_PROG_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_PROG_NOTES/view?usp=sharing'
            },
            {
                name: 'Manufacturing Process',
                questions: 'https://drive.google.com/file/d/YOUR_CHEM_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CHEM_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CHEM_NOTES/view?usp=sharing'
            }
        ]
    },
    2: {
        subjects: [
            {
                name: ' Applied Mathematics-II',
                questions: 'https://drive.google.com/file/d/YOUR_MATH2_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_MATH2_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_MATH2_NOTES/view?usp=sharing'
            },
            {
                name: 'Applied Physics-II',
                questions: 'https://drive.google.com/file/d/YOUR_PHYSICS2_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_PHYSICS2_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_PHYSICS2_NOTES/view?usp=sharing'
            },
            {
                name: 'Environmental Studies',
                questions: 'https://drive.google.com/file/d/YOUR_DS_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_DS_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_DS_NOTES/view?usp=sharing'
            },
            {
                name: 'Programming in C',
                questions: 'https://drive.google.com/file/d/YOUR_LOGIC_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_LOGIC_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_LOGIC_NOTES/view?usp=sharing'
            },
            {
                name: 'Engineering Mechanics',
                questions: 'https://drive.google.com/file/d/YOUR_DS_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_DS_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_DS_NOTES/view?usp=sharing'
            }
        ]
    },
    3: {
        subjects: [
            {
                name: 'Discrete Mathematics',
                questions: 'https://drive.google.com/file/d/YOUR_DM_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_DM_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_DM_NOTES/view?usp=sharing'
            },
            {
                name: 'Database Systems',
                questions: 'https://drive.google.com/file/d/YOUR_DB_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_DB_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_DB_NOTES/view?usp=sharing'
            },
            {
                name: 'Web Development',
                questions: 'https://drive.google.com/file/d/YOUR_WEB_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_WEB_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_WEB_NOTES/view?usp=sharing'
            },
            {
                name: 'Algorithms',
                questions: 'https://drive.google.com/file/d/YOUR_ALGO_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_ALGO_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_ALGO_NOTES/view?usp=sharing'
            }
        ]
    },
    4: {
        subjects: [
            {
                name: 'Operating Systems',
                questions: 'https://drive.google.com/file/d/YOUR_OS_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_OS_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_OS_NOTES/view?usp=sharing'
            },
            {
                name: 'Software Engineering',
                questions: 'https://drive.google.com/file/d/YOUR_SE_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_SE_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_SE_NOTES/view?usp=sharing'
            },
            {
                name: 'Computer Networks',
                questions: 'https://drive.google.com/file/d/YOUR_CN_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CN_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CN_NOTES/view?usp=sharing'
            },
            {
                name: 'OOP Concepts',
                questions: 'https://drive.google.com/file/d/YOUR_OOP_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_OOP_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_OOP_NOTES/view?usp=sharing'
            }
        ]
    },
    5: {
        subjects: [
            {
                name: 'Compiler Design',
                questions: 'https://drive.google.com/file/d/YOUR_CD_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CD_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CD_NOTES/view?usp=sharing'
            },
            {
                name: 'Cloud Computing',
                questions: 'https://drive.google.com/file/d/YOUR_CC_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CC_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CC_NOTES/view?usp=sharing'
            },
            {
                name: 'Cybersecurity',
                questions: 'https://drive.google.com/file/d/YOUR_CS_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CS_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CS_NOTES/view?usp=sharing'
            },
            {
                name: 'AI Basics',
                questions: 'https://drive.google.com/file/d/YOUR_AI_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_AI_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_AI_NOTES/view?usp=sharing'
            }
        ]
    },
    6: {
        subjects: [
            {
                name: 'Machine Learning',
                questions: 'https://drive.google.com/file/d/YOUR_ML_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_ML_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_ML_NOTES/view?usp=sharing'
            },
            {
                name: 'Distributed Systems',
                questions: 'https://drive.google.com/file/d/YOUR_DS2_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_DS2_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_DS2_NOTES/view?usp=sharing'
            },
            {
                name: 'Blockchain',
                questions: 'https://drive.google.com/file/d/YOUR_BC_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_BC_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_BC_NOTES/view?usp=sharing'
            },
            {
                name: 'Advanced Networking',
                questions: 'https://drive.google.com/file/d/YOUR_AN_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_AN_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_AN_NOTES/view?usp=sharing'
            }
        ]
    },
    7: {
        subjects: [
            {
                name: 'Project Management',
                questions: 'https://drive.google.com/file/d/YOUR_PM_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_PM_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_PM_NOTES/view?usp=sharing'
            },
            {
                name: 'Advanced ML',
                questions: 'https://drive.google.com/file/d/YOUR_AML_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_AML_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_AML_NOTES/view?usp=sharing'
            },
            {
                name: 'IoT Systems',
                questions: 'https://drive.google.com/file/d/YOUR_IOT_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_IOT_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_IOT_NOTES/view?usp=sharing'
            },
            {
                name: 'Advanced Security',
                questions: 'https://drive.google.com/file/d/YOUR_AS_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_AS_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_AS_NOTES/view?usp=sharing'
            }
        ]
    },
    8: {
        subjects: [
            {
                name: 'Capstone Project',
                questions: 'https://drive.google.com/file/d/YOUR_CAP_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_CAP_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_CAP_NOTES/view?usp=sharing'
            },
            {
                name: 'Advanced AI',
                questions: 'https://drive.google.com/file/d/YOUR_AAI_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_AAI_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_AAI_NOTES/view?usp=sharing'
            },
            {
                name: 'Research Methods',
                questions: 'https://drive.google.com/file/d/YOUR_RM_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_RM_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_RM_NOTES/view?usp=sharing'
            },
            {
                name: 'Professional Electives',
                questions: 'https://drive.google.com/file/d/YOUR_PE_QUESTIONS/view?usp=sharing',
                pyp: 'https://drive.google.com/file/d/YOUR_PE_PYP/view?usp=sharing',
                notes: 'https://drive.google.com/file/d/YOUR_PE_NOTES/view?usp=sharing'
            }
        ]
    }
};


// ... (Router and Init code remains same) ...

// ... (renderHome, renderEvents, renderSocieties, renderNotices, renderLogin, renderSignup, renderProfile, renderAdmin remain same) ...

// ... (renderHome, renderEvents, renderSocieties, renderNotices, renderLogin, renderSignup, renderProfile, renderAdmin views are defined below) ...

window.downloadNote = function (filePath) {
    if (AuthService.requireAuth('download notes')) {
        // Check if it's an external link (Google Drive or other URLs)
        if (filePath.startsWith('http')) {
            // For Google Drive links, convert to direct download URL
            if (filePath.includes('drive.google.com')) {
                const fileId = filePath.match(/\/d\/([a-zA-Z0-9-_]+)/);
                if (fileId && fileId[1]) {
                    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId[1]}`;
                    window.location.href = downloadUrl;
                    return;
                }
            }
            // For other URLs, open in new tab
            window.open(filePath, '_blank');
            return;
        }
  
        // Internal Mock Files
        const link = document.createElement('a');
        link.href = filePath;
        link.target = '_blank';
        link.download = filePath.split('/').pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

window.registerForEvent = function (eventName) {
    if (AuthService.requireAuth('register for events')) {
        alert(`Successfully registered for ${eventName}!`);
    }
};

// Bunk Poll Voting Function
window.voteBunkPoll = function (option) {
    const result = BunkPollService.addVote(option);
    if (result.success) {
        // Re-render the home page to show updated results
        router();
    } else {
        alert(result.message);
    }
};

// Build Bunk Poll Component HTML
function buildBunkPollHTML() {
    const results = BunkPollService.getResults();
    const hasVoted = BunkPollService.hasVotedToday();
    
    // Find the option with most votes
    const topOption = Object.entries(results.votes).reduce((a, b) => 
        b[1] > a[1] ? b : a
    );

    return `
        <div class="bunk-poll-container">
            <div class="bunk-poll-header">
                <h3 class="bunk-poll-title">Class Bunk Planner</h3>
                <p class="bunk-poll-subtitle">Let's see who's staying & who's bunking! 🎓</p>
            </div>

            <div class="bunk-poll-content">
                ${hasVoted ? `
                    <div class="bunk-poll-voted-message">
                        <p>✅ Your vote has been recorded!</p>
                        <p style="font-size: 0.85rem; margin-top: 6px; opacity: 0.9;">Thanks for participating! Come back tomorrow to vote again 😊</p>
                    </div>
                ` : `
                    <div class="bunk-poll-vote-buttons">
                        <button class="bunk-poll-btn" onclick="voteBunkPoll('Yes 😎')" title="Click to vote">
                            <span class="bunk-poll-btn-emoji">😎</span>
                            <span class="bunk-poll-btn-label">Yes</span>
                        </button>
                        <button class="bunk-poll-btn" onclick="voteBunkPoll('No 🤓')" title="Click to vote">
                            <span class="bunk-poll-btn-emoji">🤓</span>
                            <span class="bunk-poll-btn-label">No</span>
                        </button>
                        <button class="bunk-poll-btn" onclick="voteBunkPoll('Maybe 🤔')" title="Click to vote">
                            <span class="bunk-poll-btn-emoji">🤔</span>
                            <span class="bunk-poll-btn-label">Maybe</span>
                        </button>
                    </div>
                `}

                <div class="bunk-poll-results">
                    <div class="bunk-poll-results-title">Today's Breakdown</div>
                    
                    <div class="bunk-poll-result-item ${topOption[0] === 'Yes 😎' ? 'top-option' : ''}">
                        <div class="bunk-poll-result-label">
                            <span>Yes 😎</span>
                            <span class="bunk-poll-result-percentage">${results.percentages['Yes 😎']}%</span>
                        </div>
                        <div class="bunk-poll-result-bar">
                            <div class="bunk-poll-result-fill yes ${topOption[0] === 'Yes 😎' && results.total > 0 ? 'top' : ''}" style="width: ${Math.max(results.percentages['Yes 😎'], 8)}%;">
                                <span style="position: relative; z-index: 1;">${results.votes['Yes 😎']}</span>
                            </div>
                        </div>
                    </div>

                    <div class="bunk-poll-result-item ${topOption[0] === 'No 🤓' ? 'top-option' : ''}">
                        <div class="bunk-poll-result-label">
                            <span>No 🤓</span>
                            <span class="bunk-poll-result-percentage">${results.percentages['No 🤓']}%</span>
                        </div>
                        <div class="bunk-poll-result-bar">
                            <div class="bunk-poll-result-fill no ${topOption[0] === 'No 🤓' && results.total > 0 ? 'top' : ''}" style="width: ${Math.max(results.percentages['No 🤓'], 8)}%;">
                                <span style="position: relative; z-index: 1;">${results.votes['No 🤓']}</span>
                            </div>
                        </div>
                    </div>

                    <div class="bunk-poll-result-item ${topOption[0] === 'Maybe 🤔' ? 'top-option' : ''}">
                        <div class="bunk-poll-result-label">
                            <span>Maybe 🤔</span>
                            <span class="bunk-poll-result-percentage">${results.percentages['Maybe 🤔']}%</span>
                        </div>
                        <div class="bunk-poll-result-bar">
                            <div class="bunk-poll-result-fill maybe ${topOption[0] === 'Maybe 🤔' && results.total > 0 ? 'top' : ''}" style="width: ${Math.max(results.percentages['Maybe 🤔'], 8)}%;">
                                <span style="position: relative; z-index: 1;">${results.votes['Maybe 🤔']}</span>
                            </div>
                        </div>
                    </div>

                    <div class="bunk-poll-total">
                        👥 <strong>${results.total}</strong> student${results.total !== 1 ? 's' : ''} voted
                        ${results.total > 0 ? `• Most students are ${topOption[0]}` : '• Be the first to vote!'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Router ---
const routes = {
    '/': renderHome,
    '/study': renderStudy,
    '/events': renderEvents,
    '/societies': renderSocieties,
    '/notices': renderNotices,
    '/timetable': renderTimeTable,
    '/exam-mode': renderExamMode,
    '/internships': renderInternships,
    '/hackathons': renderHackathons,
    '/profile': renderProfile,
    '/admin': renderAdmin,
    '/login': renderLogin,
    '/signup': renderSignup,
    '/forgot-password': renderForgotPassword,
    '/otp': renderOTP,
    '/upload': renderUpload
};

function init() {
    window.addEventListener('hashchange', router);

    // Check global theme - default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    // Handle initial load auth check
    if (!AuthService.isLoggedIn() && !['/login', '/signup', '/forgot-password', '/otp'].includes(window.location.hash.slice(1))) {
        window.location.hash = '/login';
    } else {
        router();
    }
}

function router() {
    let path = window.location.hash.slice(1) || '/';

    // Auth Guard
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/otp'];
    if (!AuthService.isLoggedIn() && !publicRoutes.includes(path)) {
        window.location.hash = '/login';
        return;
    }

    // Redirect logged in users away from auth pages
    if (AuthService.isLoggedIn() && publicRoutes.includes(path)) {
        window.location.hash = '/';
        return;
    }

    const app = document.getElementById('app-content');
    const renderer = routes[path] || renderHome;

    // Scroll to top
    window.scrollTo(0, 0);
    app.innerHTML = renderer();
    updateNav(path);
    updateThemeToggle();
    if (window.lucide) {
        lucide.createIcons();
    }
}

function updateNav(path) {
    // Hide drawer toggle on auth pages
    const topHeader = document.getElementById('top-header');
    const sideDrawer = document.getElementById('side-drawer');
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/otp'];

    if (publicRoutes.includes(path)) {
        topHeader.classList.add('hidden');
        sideDrawer.classList.add('hidden');
        return;
    } else {
        topHeader.classList.remove('hidden');
        sideDrawer.classList.remove('hidden');
    }

    // Update active drawer item
    document.querySelectorAll('.side-drawer .drawer-item').forEach(el => {
        el.classList.remove('active');
        const href = el.getAttribute('href').replace('#', '');
        if (href === path || (path === '/' && href === '/')) {
            el.classList.add('active');
        }
    });
}

// --- Views ---

function renderHome() {
    const user = AuthService.getCurrentUser() || { name: 'Guest' };
    const greeting = AuthService.isLoggedIn() ? `Welcome back,` : `Hello,`;

    return `
        <header class="container" style="padding-top: var(--space-lg); padding-bottom: var(--space-xs);">
            <div class="flex justify-between items-center">
                <div>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">${greeting}</p>
                    <h1 style="margin:0;">${user.name} 👋</h1>
                </div>
                <a href="#/profile" style="width: 40px; height: 40px; background: var(--color-primary-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; text-decoration: none;">
                    ${AuthService.isLoggedIn() ? '🧑‍🎓' : '👤'}
                </a>
            </div>
        </header>

        <section class="container">
            <div class="card" style="background: linear-gradient(135deg, var(--color-primary), #4f46e5); color: white; border: none;">
                <h3 style="margin-bottom: var(--space-xs); font-size: 1.2rem;">Next Class: Data Structures</h3>
                <p style="color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="clock" style="width:16px;"></i> 10:00 AM • L-Hall 4
                </p>
            </div>
        </section>

        <!-- Quick Actions - Academic Navigation -->
        <section class="container flex justify-between text-center" style="margin-bottom: var(--space-lg);">
            <a href="#/notices" style="text-decoration:none; color: var(--text-main);">
                <div style="background:var(--color-surface); padding:1rem; border-radius:var(--radius-md); box-shadow:var(--shadow-sm);">
                    <i data-lucide="bell" style="color:var(--color-primary);"></i>
                </div>
                <span style="font-size:0.8rem; display:block; margin-top:4px;">Notices</span>
            </a>
            <a href="#/societies" style="text-decoration:none; color: var(--text-main);">
                <div style="background:var(--color-surface); padding:1rem; border-radius:var(--radius-md); box-shadow:var(--shadow-sm);">
                    <i data-lucide="users" style="color:var(--color-success);"></i>
                </div>
                <span style="font-size:0.8rem; display:block; margin-top:4px;">Societies</span>
            </a>
            <a href="#/timetable" style="text-decoration:none; color: var(--text-main);">
                <div style="background:var(--color-surface); padding:1rem; border-radius:var(--radius-md); box-shadow:var(--shadow-sm);">
                    <i data-lucide="calendar" style="color:var(--color-primary);"></i>
                </div>
                <span style="font-size:0.8rem; display:block; margin-top:4px;">TimeTable</span>
            </a>
            <a href="#/internships" style="text-decoration:none; color: var(--text-main);">
                 <div style="background:var(--color-surface); padding:1rem; border-radius:var(--radius-md); box-shadow:var(--shadow-sm);">
                    <i data-lucide="briefcase" style="color:#ec4899;"></i>
                </div>
                <span style="font-size:0.8rem; display:block; margin-top:4px;">Internships</span>
            </a>
        </section>

        <!-- Hackathons & Competitions -->
        <section class="container" style="margin-bottom: var(--space-lg);">
            <a href="#/hackathons" style="text-decoration:none; color: var(--text-main); display: inline-block; width: 100%;">
                <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ffa94d 100%); padding: var(--space-md); border-radius: var(--radius-md); box-shadow: var(--shadow-md); color: white; text-align: center;">
                    <i data-lucide="zap" style="color: white; width: 24px; height: 24px; display: block; margin: 0 auto var(--space-xs);"></i>
                    <div style="font-weight: 600; font-size: 0.95rem;">Hackathons & Competitions</div>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.9); margin-top: 4px;">Win prizes & recognition</div>
                </div>
            </a>
        </section>

        <!-- Latest Notices -->
        <section class="container">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-md);">
                <h3>Latest Notices</h3>
                <a href="#/notices" style="color: var(--color-primary); text-decoration: none; font-size: 0.9rem;">See All</a>
            </div>
            ${CONTENT_DATA.notices.slice(0, 2).map(notice => `
                <div class="card flex items-center gap-md" style="padding: var(--space-sm) var(--space-md);">
                    <div style="width: 4px; height: 32px; background-color: var(--color-primary); border-radius: var(--radius-pill);"></div>
                    <div style="flex:1;">
                        <h4 style="font-size: 0.95rem; font-weight: 600;">${notice.title}</h4>
                        <p style="font-size: 0.75rem;">${notice.date}</p>
                    </div>
                </div>
            `).join('')}
        </section>

        <!-- Upcoming Events -->
        <section class="container">
            <h3 style="margin-bottom: var(--space-md);">Upcoming Events</h3>
            <div class="flex gap-md" style="overflow-x: auto; padding-bottom: var(--space-sm); margin: 0 -var(--space-md); padding: 0 var(--space-md); scrollbar-width: none;">
                ${CONTENT_DATA.events.map(evt => `
                    <div class="card" style="min-width: 280px; padding: 0; overflow: hidden; flex-shrink: 0;">
                        <img src="${evt.image}" alt="${evt.title}" style="width: 100%; height: 130px; object-fit: cover;">
                        <div style="padding: var(--space-md);">
                            <span style="font-size: 0.7rem; color: var(--color-primary); font-weight: 700; text-transform: uppercase;">${evt.organizer}</span>
                            <h4 style="font-weight: 600; margin-top: 2px;">${evt.title}</h4>
                            <p style="font-size: 0.85rem; margin-top: 6px; color: var(--text-muted);">
                                <i data-lucide="calendar" style="width:14px; vertical-align:middle;"></i> ${evt.date} • ${evt.time}
                            </p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>

        <!-- Class Bunk Planner - Fun & Interactive Element (positioned at bottom) -->
        <section class="container">
            ${buildBunkPollHTML()}
        </section>
    `;
}

function renderStudy() {
    const customUploads = StorageService.getUploads();

    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-lg);">
                <h1 style="margin:0;">Study Material 📚</h1>
            </div>
            
            <p style="margin-bottom: var(--space-lg);">Select your semester to access resources.</p>
            
            <div class="flex flex-col gap-md">
                ${Object.entries(CONTENT_DATA.studyMaterial).map(([sem, subjects]) => {
        // Filter custom uploads for this semester
        const semUploads = customUploads.filter(u => u.semester === sem);
        const allSubjects = [...subjects, ...semUploads]; // Merge

        return `
                    <details class="card" style="padding: 0; overflow:hidden;">
                        <summary style="padding: var(--space-md); cursor: pointer; font-weight: 600; list-style: none; display: flex; justify-content: space-between; align-items: center;">
                            <div class="flex items-center gap-md">
                                <span style="width:32px; height:32px; background:var(--color-primary-light); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--color-primary);">
                                    <i data-lucide="folder"></i>
                                </span>
                                ${sem}
                            </div>
                            <div class="flex items-center gap-sm">
                                <span style="font-size:0.8rem; color:var(--text-muted);">${allSubjects.length} files</span>
                                <i data-lucide="chevron-down" style="width:16px;"></i>
                            </div>
                        </summary>
                        <div style="padding: 0 var(--space-md) var(--space-md); border-top: 1px solid rgba(0,0,0,0.05); background-color: rgba(0,0,0,0.01);">
                            ${allSubjects.map(sub => `
                                <div class="flex justify-between items-center" style="padding: var(--space-sm) 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                                    <div style="display:flex; flex-direction:column;">
                                        <span style="font-size: 0.9rem;">${sub.name}</span>
                                        ${sub.subject ? `<span style="font-size:0.75rem; color:var(--text-muted);">${sub.subject}</span>` : ''}
                                    </div>
                                    <a href="${sub.file}" target="_blank" style="border:none; background:none; color:var(--color-primary); cursor:pointer; text-decoration:none;">
                                        <i data-lucide="external-link" style="width:18px;"></i>
                                    </a>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                `}).join('')}
            </div>
        </div>
    `;
}

function renderUpload() {
    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <h1>Upload Material 📤</h1>
            <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">Share resources with the community.</p>
            
            <form onsubmit="handleUpload(event)" class="card">
                <div class="form-group">
                    <label class="form-label">Semester</label>
                    <select name="semester" required class="form-input" style="background:white;">
                        <option value="Semester 1">Semester 1</option>
                        <option value="Semester 2">Semester 2</option>
                        <option value="Semester 3">Semester 3</option>
                        <option value="Semester 4">Semester 4</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Subject</label>
                    <input type="text" name="subject" required placeholder="e.g. Mathematics" class="form-input">
                </div>
                
                <div class="form-group">
                    <label class="form-label">File Title</label>
                    <input type="text" name="name" required placeholder="e.g. Unit 1 Notes" class="form-input">
                </div>
                
                <div class="form-group">
                    <label class="form-label">File Link (Drive/Dropbox)</label>
                    <input type="url" name="file" required placeholder="https://..." class="form-input">
                </div>

                <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Upload Now</button>
            </form>
            
             <div class="auth-footer">
                <a href="#/study" class="auth-link">Cancel</a>
            </div>
        </div>
    `;
}

function renderTimeTable() {
    const user = AuthService.getCurrentUser() || { name: 'Student' };
    
    // Semester-wise time table data with Google Drive links
    const timetableLinks = {
        1: {
            name: 'Semester 1',
            driveLink: 'https://drive.google.com/file/d/1CFP4P_6FuSMNEoNDGbJ_jSeGdl3f_LDH/view?usp=drivesdk',
            description: 'First Semester Time Table'
        },
        2: {
            name: 'Semester 2',
            driveLink: 'https://drive.google.com/file/d/1nPcjBPtbmBHvG_MFrgKiSoY4P_NJCC4o/view?usp=drivesdk',
            description: 'Second Semester Time Table'
        },
        3: {
            name: 'Semester 3',
            driveLink: 'https://drive.google.com/file/d/YOUR_SEM3_FILE_ID/view?usp=sharing',
            description: 'Third Semester Time Table'
        },
        4: {
            name: 'Semester 4',
            driveLink: 'https://drive.google.com/file/d/YOUR_SEM4_FILE_ID/view?usp=sharing',
            description: 'Fourth Semester Time Table'
        },
        5: {
            name: 'Semester 5',
            driveLink: 'https://drive.google.com/file/d/YOUR_SEM5_FILE_ID/view?usp=sharing',
            description: 'Fifth Semester Time Table'
        },
        6: {
            name: 'Semester 6',
            driveLink: 'https://drive.google.com/file/d/YOUR_SEM6_FILE_ID/view?usp=sharing',
            description: 'Sixth Semester Time Table'
        },
        7: {
            name: 'Semester 7',
            driveLink: 'https://drive.google.com/file/d/YOUR_SEM7_FILE_ID/view?usp=sharing',
            description: 'Seventh Semester Time Table'
        },
        8: {
            name: 'Semester 8',
            driveLink: 'https://drive.google.com/file/d/YOUR_SEM8_FILE_ID/view?usp=sharing',
            description: 'Eighth Semester Time Table'
        }
    };

    return `
        <div class="container" style="padding-top: var(--space-lg); padding-bottom: var(--space-xl);">
            <h1 style="margin-bottom: var(--space-md);">Class Time Table 📅</h1>
            <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">Select your semester to view the time table</p>
            
            <div class="flex flex-col gap-md">
                ${Array.from({ length: 8 }, (_, i) => i + 1).map(sem => {
                    const data = timetableLinks[sem];
                    return `
                        <a href="${data.driveLink}" target="_blank" style="text-decoration: none; color: inherit;">
                            <div class="card" style="padding: var(--space-md); cursor: pointer; transition: all 0.3s ease; border-left: 4px solid var(--color-primary); display: flex; justify-content: space-between; align-items: center; hover: box-shadow var(--shadow-lg);">
                                <div>
                                    <h3 style="margin: 0 0 4px 0; font-size: 1.1rem;">${data.name}</h3>
                                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${data.description}</p>
                                </div>
                                <i data-lucide="external-link" style="color: var(--color-primary); width: 20px; height: 20px;"></i>
                            </div>
                        </a>
                    `;
                }).join('')}
            </div>

            <div style="margin-top: var(--space-xl); padding: var(--space-md); background: var(--color-primary-light); border-radius: var(--radius-md); text-align: center;">
                <p style="margin: 0; font-size: 0.9rem; color: var(--color-primary);">
                    <i data-lucide="info" style="width: 16px; display: inline-block; vertical-align: middle;"></i>
                    Click on any semester to open the time table in your browser.
                </p>
            </div>
        </div>
    `;
}

function renderEvents() {
    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <h1>All Events 🎉</h1>
            <div style="margin-top: var(--space-md);">
                 ${CONTENT_DATA.events.map(evt => `
                    <div class="card">
                        <img src="${evt.image}" alt="${evt.title}" style="width: 100%; height: 160px; object-fit: cover; border-radius: var(--radius-sm); margin-bottom: var(--space-md);">
                        <div class="flex justify-between items-start">
                             <div>
                                <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 600;">${evt.organizer}</span>
                                <h2 style="font-size: 1.25rem;">${evt.title}</h2>
                             </div>
                             <div style="text-align:center; background:var(--color-bg); padding:4px 8px; border-radius:8px;">
                                <span style="display:block; font-size:0.75rem; font-weight:bold; color:var(--color-danger);">FEB</span>
                                <span style="display:block; font-size:1.1rem; font-weight:bold;">${evt.date.split(' ')[1]}</span>
                             </div>
                        </div>
                        
                        <div style="margin: var(--space-md) 0; color: var(--text-muted); font-size: 0.9rem;">
                            <p class="flex items-center gap-sm"><i data-lucide="clock" style="width:16px;"></i> ${evt.time}</p>
                            <p class="flex items-center gap-sm" style="margin-top:4px;"><i data-lucide="map-pin" style="width:16px;"></i> ${evt.venue}</p>
                        </div>

                        <button class="btn btn-primary" style="width: 100%;" onclick="registerForEvent('${evt.title}')">RSVP Now</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderExamMode() {
    return `
        <div class="container exam-mode-container" style="padding-top: var(--space-lg); padding-bottom: var(--space-xl);">
            <!-- Header Section with Motivation -->
            <div class="exam-header">
                <div class="exam-header-content">
                    <h1 class="exam-title">Exam Mode 📚</h1>
                    <p class="exam-subtitle">Your Complete Exam Preparation Hub</p>
                    <p class="exam-description">Access curated resources for every semester. Important questions, previous year papers, and revision notes all in one place.</p>
                </div>
            </div>

            <!-- Motivational Stats Banner -->
            <div class="exam-stats-banner">
                <div class="stat-item">
                    <i data-lucide="book-marked"></i>
                    <div>
                        <div class="stat-number">8</div>
                        <div class="stat-label">Semesters</div>
                    </div>
                </div>
                <div class="stat-separator"></div>
                <div class="stat-item">
                    <i data-lucide="file-text"></i>
                    <div>
                        <div class="stat-number">40+</div>
                        <div class="stat-label">Subjects</div>
                    </div>
                </div>
                <div class="stat-separator"></div>
                <div class="stat-item">
                    <i data-lucide="target"></i>
                    <div>
                        <div class="stat-number">3x</div>
                        <div class="stat-label">Resources</div>
                    </div>
                </div>
            </div>

            <!-- Semester Grid -->
            <div class="exam-semesters-grid">
                ${Array.from({ length: 8 }, (_, i) => i + 1).map(sem => `
                    <button onclick="window.showExamSubjects(${sem})" class="semester-card" title="Click to view Semester ${sem} subjects">
                        <div class="semester-card-content">
                            <div class="semester-number">Sem ${sem}</div>
                            <div class="semester-subjects">
                                ${EXAM_DATA[sem]?.subjects?.length || 0} Subjects
                            </div>
                        </div>
                        <div class="semester-card-icon">
                            <i data-lucide="arrow-right"></i>
                        </div>
                        <div class="semester-card-background" style="background: linear-gradient(135deg, hsl(${225 + sem * 15}, 70%, 55%), hsl(${225 + sem * 15 + 30}, 70%, 45%));"></div>
                    </button>
                `).join('')}
            </div>

            <!-- Subject Details Container -->
            <div id="exam-subjects-container" class="exam-subjects-modal" style="display: none;">
                <!-- Subject list will be populated here -->
            </div>
        </div>
    `;
}

function renderInternships() {
    return `
        <div class="container" style="padding-top: var(--space-lg); padding-bottom: var(--space-xl);">
            <h1 style="margin-bottom: var(--space-md);">Internship Opportunities 💼</h1>
            <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">Find and apply for internship opportunities matching your skills and interests.</p>
            
            <div class="flex flex-col gap-md">
                <div class="card" style="border-left: 4px solid #3b82f6;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #1e40af;">Software Development Intern</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">TechCorp Solutions</p>
                        </div>
                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">3 Months</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Build scalable web applications. Work with experienced developers. Great learning opportunity.</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Java</span>
                        <span style="background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">React</span>
                        <span style="background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">MySQL</span>
                    </div>
                    <button style="background: #3b82f6; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        View Details
                    </button>
                </div>

                <div class="card" style="border-left: 4px solid #8b5cf6;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #5b21b6;">Data Science Intern</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">DataDrive Analytics</p>
                        </div>
                        <span style="background: #ede9fe; color: #6b21a8; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">6 Months</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Analyze real-world datasets. Work with machine learning models. Gain practical DS experience.</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #ede9fe; color: #6b21a8; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Python</span>
                        <span style="background: #ede9fe; color: #6b21a8; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Machine Learning</span>
                        <span style="background: #ede9fe; color: #6b21a8; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">SQL</span>
                    </div>
                    <button style="background: #8b5cf6; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        View Details
                    </button>
                </div>

                <div class="card" style="border-left: 4px solid #ec4899;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #9d174d;">UI/UX Design Intern</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Creative Studios Inc</p>
                        </div>
                        <span style="background: #fce7f3; color: #be185d; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">3 Months</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Design engaging user interfaces. Build responsive designs. Collaborate with design team.</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #fce7f3; color: #be185d; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Figma</span>
                        <span style="background: #fce7f3; color: #be185d; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">UI Design</span>
                        <span style="background: #fce7f3; color: #be185d; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Prototyping</span>
                    </div>
                    <button style="background: #ec4899; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        View Details
                    </button>
                </div>

                <div class="card" style="border-left: 4px solid #10b981;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #065f46;">Cybersecurity Intern</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">SecureNet Inc</p>
                        </div>
                        <span style="background: #d1fae5; color: #047857; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">4 Months</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Work on security audits. Learn penetration testing. Understand security protocols.</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #d1fae5; color: #047857; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Ethical Hacking</span>
                        <span style="background: #d1fae5; color: #047857; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Network Security</span>
                        <span style="background: #d1fae5; color: #047857; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Linux</span>
                    </div>
                    <button style="background: #10b981; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        View Details
                    </button>
                </div>
            </div>

            <div style="margin-top: var(--space-xl); padding: var(--space-md); background: var(--color-primary-light); border-radius: var(--radius-md); text-align: center;">
                <p style="margin: 0; font-size: 0.9rem; color: var(--color-primary);">
                    <i data-lucide="info" style="width: 16px; display: inline-block; vertical-align: middle;"></i>
                    Apply now and start your career journey!
                </p>
            </div>
        </div>
    `;
}

function renderHackathons() {
    return `
        <div class="container" style="padding-top: var(--space-lg); padding-bottom: var(--space-xl);">
            <h1 style="margin-bottom: var(--space-md);">Hackathons & Competitions 🚀</h1>
            <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">Showcase your skills and compete with the best. Win prizes and recognition!</p>
            
            <div class="flex flex-col gap-md">
                <div class="card" style="border-left: 4px solid #f59e0b;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #92400e;">TechFest 2026</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Annual Coding Competition</p>
                        </div>
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">Feb 28</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">48-hour hackathon with problems across multiple domains. Win exciting prizes and internship offers!</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Web Dev</span>
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">AI/ML</span>
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">₹50,000 Prize Pool</span>
                    </div>
                    <button style="background: #f59e0b; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        Register Now
                    </button>
                </div>

                <div class="card" style="border-left: 4px solid #ef4444;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #7f1d1d;">CodeChampion 2026</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Competitive Programming Marathon</p>
                        </div>
                        <span style="background: #fee2e2; color: #7f1d1d; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">Mar 15</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Solve challenging algorithmic problems. Compete with programmers from different colleges and win scholarships.</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #fee2e2; color: #7f1d1d; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Algorithms</span>
                        <span style="background: #fee2e2; color: #7f1d1d; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Data Structures</span>
                        <span style="background: #fee2e2; color: #7f1d1d; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">₹1,00,000 Prizes</span>
                    </div>
                    <button style="background: #ef4444; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        Register Now
                    </button>
                </div>

                <div class="card" style="border-left: 4px solid #06b6d4;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #164e63;">Mobile App Hackathon</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Build the Next Big App</p>
                        </div>
                        <span style="background: #cffafe; color: #164e63; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">Apr 5</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Develop innovative mobile applications. Mentorship from industry experts. Potential VC funding opportunities!</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #cffafe; color: #164e63; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Flutter</span>
                        <span style="background: #cffafe; color: #164e63; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">React Native</span>
                        <span style="background: #cffafe; color: #164e63; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">₹75,000 Prizes</span>
                    </div>
                    <button style="background: #06b6d4; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        Register Now
                    </button>
                </div>

                <div class="card" style="border-left: 4px solid #8b5cf6;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #5b21b6;">AI & ML Bootcamp</h3>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Machine Learning Innovation Challenge</p>
                        </div>
                        <span style="background: #ede9fe; color: #5b21b6; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">Apr 20</span>
                    </div>
                    <p style="margin: 0 0 var(--space-sm) 0; font-size: 0.9rem;">Create ML models to solve real-world problems. Learn from data scientists. Get recognized for innovation.</p>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-md);">
                        <span style="background: #ede9fe; color: #5b21b6; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">Deep Learning</span>
                        <span style="background: #ede9fe; color: #5b21b6; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">NLP</span>
                        <span style="background: #ede9fe; color: #5b21b6; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">₹60,000 Prizes</span>
                    </div>
                    <button style="background: #8b5cf6; color: white; border: none; padding: var(--space-sm) var(--space-md); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                        Register Now
                    </button>
                </div>
            </div>

            <div style="margin-top: var(--space-xl); padding: var(--space-md); background: var(--color-primary-light); border-radius: var(--radius-md); text-align: center;">
                <p style="margin: 0; font-size: 0.9rem; color: var(--color-primary);">
                    <i data-lucide="zap" style="width: 16px; display: inline-block; vertical-align: middle;"></i>
                    Challenge yourself and showcase your talent to the world!
                </p>
            </div>
        </div>
    `;
}

function renderSocieties() {
    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <h1>College Societies 🤝</h1>
            <p>Join a community that matches your passion.</p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-top: var(--space-lg);">
                ${CONTENT_DATA.societies.map(soc => `
                    <div class="card text-center" style="display: flex; flex-direction: column; align-items: center; gap: var(--space-sm);">
                        <img src="${soc.logo}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
                        <h3 style="font-size: 1rem;">${soc.name}</h3>
                        <span style="font-size: 0.75rem; background: var(--color-bg); padding: 2px 8px; border-radius: 12px;">${soc.category}</span>
                        <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.2;">${soc.members} Members</p>
                        <button class="btn" style="background:var(--color-primary-light); color:var(--color-primary); font-size: 0.8rem; padding: 0.5rem 1rem; width:100%; margin-top:4px;">View</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderNotices() {
    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <h1>Notice Board 📌</h1>
            <div class="flex flex-col gap-md" style="margin-top: var(--space-md);">
                ${CONTENT_DATA.notices.map(notice => `
                    <div class="card">
                        <div class="flex justify-between items-start">
                            <span class="flex items-center gap-sm" style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">
                                <span style="width:8px; height:8px; background-color: ${notice.type === 'academic' ? 'var(--color-primary)' : notice.type === 'event' ? 'var(--color-success)' : 'var(--color-danger)'}; border-radius:50%;"></span>
                                ${notice.type}
                            </span>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${notice.date}</span>
                        </div>
                        <h3 style="margin: var(--space-sm) 0;">${notice.title}</h3>
                        <p>${notice.content}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderLogin() {
    return `
        <div class="container" style="padding-top: var(--space-xl); display:flex; flex-direction:column; min-height:100vh;">
            <div style="flex:1;">
                <h1 style="font-size: 2rem; margin-bottom: var(--space-sm);">Welcome Back 👋</h1>
                <p style="color: var(--text-muted); margin-bottom: var(--space-xl);">Enter your credential to continue</p>
                
                <form onsubmit="handleLogin(event)" class="auth-form">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" name="email" required placeholder="student@college.edu" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" name="password" required placeholder="••••••••" class="form-input">
                        <div style="text-align: right; margin-top: 4px;">
                            <a href="#/forgot-password" class="auth-link" style="font-size: 0.8rem;">Forgot Password?</a>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="margin-top:var(--space-md);">Login</button>
                    
                    <div class="auth-footer">
                        <p>Don't have an account? <a href="#/signup" class="auth-link">Sign Up</a></p>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderSignup() {
    return `
        <div class="container auth-container">
            <div class="auth-header">
                <h1>Create Account 🚀</h1>
                <p>Join the college community</p>
            </div>
            
            <form onsubmit="handleSignup(event)" class="auth-form" style="padding-bottom: var(--space-xl);">
                <div class="form-group">
                   <label class="form-label">Full Name</label>
                   <input type="text" name="name" required placeholder="John Doe" class="form-input">
                </div>
                 <div class="form-group">
                   <label class="form-label">College Name</label>
                   <input type="text" name="college" required placeholder="Engineering College" class="form-input">
                </div>
                <div class="flex gap-md">
                     <div class="form-group" style="flex:1">
                        <label class="form-label">Branch</label>
                        <select name="branch" required class="form-input" style="background:white;">
                            <option value="">Select</option>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="ME">ME</option>
                            <option value="CIVIL">CIVIL</option>
                        </select>
                     </div>
                     <div class="form-group" style="flex:1">
                        <label class="form-label">Year</label>
                        <select name="year" required class="form-input" style="background:white;">
                             <option value="">Select</option>
                             <option value="1st Year">1st Year</option>
                             <option value="2nd Year">2nd Year</option>
                             <option value="3rd Year">3rd Year</option>
                             <option value="4th Year">4th Year</option>
                        </select>
                     </div>
                </div>
                <div class="form-group">
                   <label class="form-label">Roll Number</label>
                   <input type="text" name="rollno" required placeholder="2024CS..." class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" required placeholder="student@college.edu" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" required placeholder="Create a strong password" class="form-input">
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top:var(--space-md);">Sign Up</button>
                
                 <div class="auth-footer">
                    <p>Already have an account? <a href="#/login" class="auth-link">Login</a></p>
                </div>
            </form>
        </div>
    `;
}

function renderForgotPassword() {
    return `
        <div class="container auth-container">
            <div class="auth-header">
                <h1>Forgot Password? 🔒</h1>
                <p>Enter your email to reset your password</p>
            </div>
            
             <form onsubmit="handleForgotPassword(event)" class="auth-form">
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" required placeholder="student@college.edu" class="form-input">
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top:var(--space-md);">Send Reset Link</button>
                
                <div class="auth-footer">
                    <a href="#/login" class="auth-link">Back to Login</a>
                </div>
            </form>
        </div>
    `;
}

function renderOTP() {
    // If no pending process, go back to login
    if (!AuthService.pendingDetails) {
        window.location.hash = '/login';
        return '';
    }

    const mode = AuthService.pendingDetails.type === 'SIGNUP' ? 'Verify Account' : 'Security Check';
    const email = AuthService.pendingDetails.email;

    return `
        <div class="container auth-container">
            <div class="auth-header">
                <h1>${mode} 🔐</h1>
                <p>We've sent a 6-digit code to<br><strong>${email}</strong></p>
            </div>
            
            <div class="auth-form" style="text-align:center;">
                <div class="otp-input-container">
                    <input type="tel" maxlength="1" class="otp-input" onkeyup="handleOtpInput(this, 'otp2')" id="otp1">
                    <input type="tel" maxlength="1" class="otp-input" onkeyup="handleOtpInput(this, 'otp3')" id="otp2">
                    <input type="tel" maxlength="1" class="otp-input" onkeyup="handleOtpInput(this, 'otp4')" id="otp3">
                    <input type="tel" maxlength="1" class="otp-input" onkeyup="handleOtpInput(this, 'otp5')" id="otp4">
                    <input type="tel" maxlength="1" class="otp-input" onkeyup="handleOtpInput(this, 'otp6')" id="otp5">
                    <input type="tel" maxlength="1" class="otp-input" onkeyup="handleOtpInput(this, '')" id="otp6">
                </div>
                
                <div class="otp-timer" id="otp-timer">
                    Resend code in <span id="timer-count">60</span>s
                </div>
                
                <button onclick="handleVerifyOTP()" class="btn btn-primary" style="width:100%;">Verify & Proceed</button>
                <button onclick="handleResendOTP()" class="btn" style="width:100%; margin-top:10px; opacity:0.5; pointer-events:none;" id="btn-resend">Resend Code</button>
                
                <div class="auth-footer">
                    <a href="#/login" class="auth-link">Cancel</a>
                </div>
            </div>
        </div>
        <script>
            // Simple Timer Logic (Embedded for view-specific execution)
            (function() {
                let timeLeft = 60;
                const timerEl = document.getElementById('timer-count');
                const btnResend = document.getElementById('btn-resend');
                const timerText = document.getElementById('otp-timer');
                
                const interval = setInterval(() => {
                    timeLeft--;
                    if(timerEl) timerEl.textContent = timeLeft;
                    
                    if (timeLeft <= 0) {
                        clearInterval(interval);
                        if(timerText) timerText.innerHTML = "Didn't receive code?";
                        if(btnResend) {
                            btnResend.style.opacity = '1';
                            btnResend.style.pointerEvents = 'auto';
                            btnResend.style.color = 'var(--color-primary)';
                        }
                    }
                }, 1000);
            })();
        </script>
    `;
}

function renderProfile() {
    const user = AuthService.getCurrentUser();

    // Guest View
    if (!user) {
        return `
         <div class="container" style="padding-top: var(--space-xl); text-align:center; min-height:80vh; display:flex; flex-direction:column; justify-content:center;">
            <div style="width: 80px; height: 80px; background-color: var(--color-surface); border-radius: 50%; margin: 0 auto var(--space-md); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; box-shadow:var(--shadow-md);">👤</div>
            <h1 style="margin-bottom: var(--space-xs);">Guest User</h1>
            <p style="margin-bottom: var(--space-xl); color:var(--text-muted);">Login to access your profile, downloads and event registrations.</p>
            
            <a href="#/login" class="btn btn-primary" style="width:100%; margin-bottom:var(--space-md);">Login</a>
            <a href="#/signup" class="btn" style="width:100%; background:var(--color-surface); border:1px solid #ddd;">Create Account</a>

             <div class="card" style="text-align:left; margin-top:var(--space-xl);">
                 <div class="flex items-center gap-md" style="padding: var(--space-md); cursor:pointer;" onclick="toggleTheme()">
                    <i data-lucide="moon"></i> 
                    <div style="flex:1">Dark Mode</div>
                    <div style="pointer-events:none;">
                        <div class="dark-mode-toggle" id="dark-mode-toggle">
                            <div class="dark-mode-toggle-circle"></div>
                        </div>
                    </div>
                </div>
            </div>
         </div>
        `;
    }

    // Logged In View
    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <div class="text-center" style="margin-bottom: var(--space-xl);">
                <div style="width: 100px; height: 100px; background-color: var(--color-primary-light); border-radius: 50%; margin: 0 auto var(--space-md); display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">🧑‍🎓</div>
                <h2 style="margin-bottom: 4px;">${user.name}</h2>
                <div style="display:inline-block; background:var(--color-surface); border:1px solid rgba(0,0,0,0.1); padding:4px 12px; border-radius:20px; font-size:0.85rem; margin-bottom:8px;">
                    ${user.rollno}
                </div>
                <p>${user.branch} • ${user.year}</p>
                <p style="font-size:0.8rem; color:var(--text-muted);">${user.college}</p>
            </div>

            <div class="card flex justify-between text-center" style="margin-bottom: var(--space-lg);">
                <div>
                   <span style="display:block; font-weight:700; font-size:1.2rem; color:var(--color-primary);">--</span>
                   <span style="font-size:0.8rem; color:var(--text-muted);">CGPA</span>
                </div>
                <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                <div>
                   <span style="display:block; font-weight:700; font-size:1.2rem; color:var(--color-success);">--%</span>
                   <span style="font-size:0.8rem; color:var(--text-muted);">Attendance</span>
                </div>
                 <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                <div>
                   <span style="display:block; font-weight:700; font-size:1.2rem; color:var(--color-danger);">0</span>
                   <span style="font-size:0.8rem; color:var(--text-muted);">Backlogs</span>
                </div>
            </div>

            <h3 style="margin-bottom: var(--space-md);">Account & Settings</h3>
            <div class="card" style="padding: 0;">
                <div class="flex items-center gap-md" style="padding: var(--space-md); border-bottom: 1px solid rgba(0,0,0,0.05); cursor:pointer;">
                    <i data-lucide="download"></i> 
                    <div style="flex:1">Downloads <br><span style="font-size:0.75rem; color:var(--text-muted);">Offline notes and papers</span></div>
                    <i data-lucide="chevron-right" style="color:var(--text-muted);"></i>
                </div>
                <div class="flex items-center gap-md" style="padding: var(--space-md); border-bottom: 1px solid rgba(0,0,0,0.05); cursor:pointer;" onclick="toggleTheme()">
                    <i data-lucide="moon"></i> 
                    <div style="flex:1">Dark Mode <br><span style="font-size:0.75rem; color:var(--text-muted);">Tap to switch theme</span></div>
                    <div style="pointer-events:none;">
                         <div class="dark-mode-toggle" id="dark-mode-toggle">
                            <div class="dark-mode-toggle-circle"></div>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-md" style="padding: var(--space-md); border-bottom: 1px solid rgba(0,0,0,0.05); cursor:pointer;">
                    <i data-lucide="bell"></i> <span>Notifications</span>
                </div>
                 <div class="flex items-center gap-md" style="padding: var(--space-md); color: var(--color-danger); cursor:pointer;" onclick="handleLogout()">
                    <i data-lucide="log-out"></i> <span>Log Out</span>
                </div>
            </div>
        </div>
    `;
}

function renderAdmin() {
    return `
        <div class="container" style="padding-top: var(--space-lg);">
            <h1>Semester-Wise Time Table 📅</h1>
            <p>View your class schedule by semester.</p>

            <div class="card" style="margin-top: var(--space-md); border-left: 4px solid var(--color-primary);">
                <h3>Select Semester</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); margin-top: var(--space-md);">
                    ${Array.from({ length: 8 }, (_, i) => i + 1).map(sem => `
                        <button onclick="window.selectSemester(${sem})" class="btn btn-secondary" style="padding: var(--space-md); border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.3s ease;">
                            Sem ${sem}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div id="timetable-content" style="display: none; margin-top: var(--space-lg);">
                <div class="card">
                    <h3 id="sem-title">Semester Time Table</h3>
                    <div id="timetable-data" style="margin-top: var(--space-md);">
                        <!-- Time table will be populated here -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Action Handlers ---

// Global scope for onclick handlers
window.toggleTheme = function () {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggle();
};

function updateThemeToggle() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
}

window.handleLogin = function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
        AuthService.initiateLogin(formData.get('email'), formData.get('password'));
        window.location.hash = '/otp';
    } catch (err) {
        alert(err.message);
    }
};

window.handleSignup = function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const user = {
        name: formData.get('name'),
        college: formData.get('college'),
        branch: formData.get('branch'),
        year: formData.get('year'),
        rollno: formData.get('rollno'),
        email: formData.get('email'),
        password: formData.get('password') // Note: Not secure for production
    };

    try {
        AuthService.initiateSignup(user);
        window.location.hash = '/otp';
    } catch (err) {
        alert(err.message);
    }
};

window.handleForgotPassword = function (event) {
    event.preventDefault();
    const email = new FormData(event.target).get('email');
    // Mock functionality
    alert(`Password reset link sent to ${email}`);
    window.location.hash = '/login';
};

window.handleLogout = function () {
    AuthService.logout();
};

window.downloadNote = function (subject) {
    if (AuthService.requireAuth('download notes')) {
        alert(`Downloading notes for ${subject}...`);
    }
};

window.registerForEvent = function (eventName) {
    if (AuthService.requireAuth('register for events')) {
        alert(`Successfully registered for ${eventName}!`);
    }
};

// --- OTP Handlers ---

window.handleOtpInput = function (input, nextId) {
    if (input.value.length >= 1) {
        if (nextId) {
            document.getElementById(nextId).focus();
        }
    }
};

window.handleVerifyOTP = function () {
    let otp = '';
    for (let i = 1; i <= 6; i++) {
        otp += document.getElementById('otp' + i).value;
    }

    if (otp.length !== 6) {
        alert('Please enter complete 6-digit code');
        return;
    }

    try {
        AuthService.verifyOTP(otp);
        alert('Verification Successful! Welcome.');
        window.location.hash = '/';
    } catch (err) {
        alert(err.message);
    }
};

window.handleResendOTP = function () {
    try {
        if (AuthService.pendingDetails) {
            AuthService.generateAndSendOTP(AuthService.pendingDetails.email);
            // Reset timer (Quick fix: reload view)
            renderOTP();
            const app = document.getElementById('app-content');
            app.innerHTML = renderOTP();
        }
    } catch (err) {
        alert(err.message);
    }
};

window.handleUpload = function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const newItem = {
        semester: formData.get('semester'),
        subject: formData.get('subject'),
        name: formData.get('name'),
        file: formData.get('file')
    };

    try {
        StorageService.addUpload(newItem);
        alert('Upload Successful! Added to ' + newItem.semester);
        window.location.hash = '/study';
    } catch (err) {
        alert(err.message);
    }
};

// --- Semester Time Table Handler ---

window.selectSemester = function (semesterNumber) {
    const timetableContent = document.getElementById('timetable-content');
    const semTitle = document.getElementById('sem-title');
    const timetableData = document.getElementById('timetable-data');

    // Sample timetable data for each semester
    const timetables = {
        1: { subjects: ['Mathematics-I', 'Physics-I', 'Chemistry', 'Programming Basics'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        2: { subjects: ['Mathematics-II', 'Physics-II', 'Data Structures', 'Digital Logic'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        3: { subjects: ['Discrete Math', 'Database Systems', 'Web Development', 'Algorithms'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        4: { subjects: ['Operating Systems', 'Software Engineering', 'Networks', 'OOP Concepts'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        5: { subjects: ['Compiler Design', 'Cloud Computing', 'Cybersecurity', 'AI Basics'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        6: { subjects: ['Machine Learning', 'Distributed Systems', 'Blockchain', 'Advanced Networking'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        7: { subjects: ['Project Management', 'Advanced ML', 'IoT Systems', 'Advanced Security'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        8: { subjects: ['Capstone Project', 'Advanced AI', 'Research Methods', 'Professional Electives'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }
    };
           
    const timetable = timetables[semesterNumber];
    semTitle.textContent = `Semester ${semesterNumber} - Time Table`;

    // Generate a simple timetable display
    let html = `<table style=\"width: 100%; border-collapse: collapse; margin-top: 10px;\">`; 
    html += `<tr><th style=\"border: 1px solid var(--color-border); padding: 10px; background-color: var(--color-surface); text-align: left;\">Time Slot</th>`;
    timetable.days.forEach(day => {
        html += `<th style=\"border: 1px solid var(--color-border); padding: 10px; background-color: var(--color-surface); text-align: center;\">${day}</th>`;
    });
    html += `</tr>`;

    const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM'];
    
    timeSlots.forEach((time, idx) => {
        html += `<tr>`;
        html += `<td style=\"border: 1px solid var(--color-border); padding: 10px; font-weight: 600;\">${time}</td>`;
        timetable.days.forEach((day, dayIdx) => {
            const subIdx = (idx + dayIdx) % timetable.subjects.length;
            const subject = timetable.subjects[subIdx];
            html += `<td style=\"border: 1px solid var(--color-border); padding: 10px; text-align: center; background-color: rgba(var(--color-primary-rgb), 0.1); border-radius: 4px;\">${subject}</td>`;
        });
        html += `</tr>`;
    });

    html += `</table>`;
    timetableData.innerHTML = html;
    timetableContent.style.display = 'block';
};

// --- Exam Mode Handler ---
window.showExamSubjects = function (semesterNumber) {
    const container = document.getElementById('exam-subjects-container');
    const subjects = EXAM_DATA[semesterNumber]?.subjects || [];

    let html = `
        <div class="exam-subjects-panel">
            <div class="exam-subjects-header">
                <div class="exam-subjects-title-wrapper">
                    <button onclick="window.hideExamSubjects()" class="exam-close-btn" title="Close subjects view">
                        <i data-lucide="x"></i>
                    </button>
                    <div>
                        <h2 class="exam-subjects-title">Semester ${semesterNumber}</h2>
                        <p class="exam-subjects-subtitle">${subjects.length} subjects • Complete exam resources</p>
                    </div>
                </div>
            </div>

            <div class="exam-subjects-list">
    `;

    subjects.forEach((subject, index) => {
        const resourceIcons = {
            questions: 'lightbulb',
            pyp: 'file-text',
            notes: 'bookmark'
        };

        html += `
            <div class="exam-subject-card" style="animation-delay: ${index * 0.05}s;">
                <div class="subject-card-header">
                    <h3 class="subject-name">${subject.name}</h3>
                    <div class="subject-badge">Subject ${index + 1}</div>
                </div>

                <div class="subject-resources">
                    <a href="${subject.questions}" target="_blank" class="resource-button questions-btn" title="Download Important Questions">
                        <div class="resource-icon">
                            <i data-lucide="lightbulb"></i>
                        </div>
                        <div class="resource-text">
                            <div class="resource-title">Questions</div>
                            <div class="resource-desc">Practice & Prepare</div>
                        </div>
                        <i data-lucide="external-link" class="resource-link-icon"></i>
                    </a>

                    <a href="${subject.pyp}" target="_blank" class="resource-button pyp-btn" title="Download Previous Year Papers">
                        <div class="resource-icon">
                            <i data-lucide="file-text"></i>
                        </div>
                        <div class="resource-text">
                            <div class="resource-title">PYP</div>
                            <div class="resource-desc">Previous Years</div>
                        </div>
                        <i data-lucide="external-link" class="resource-link-icon"></i>
                    </a>

                    <a href="${subject.notes}" target="_blank" class="resource-button notes-btn" title="Download Revision Notes">
                        <div class="resource-icon">
                            <i data-lucide="bookmark"></i>
                        </div>
                        <div class="resource-text">
                            <div class="resource-title">Notes</div>
                            <div class="resource-desc">Quick Revision</div>
                        </div>
                        <i data-lucide="external-link" class="resource-link-icon"></i>
                    </a>
                </div>
            </div>
        `; 
    });

    html += `
            </div>

            <div class="exam-subjects-footer">
                <i data-lucide="info"></i>
                <p>Click any resource to download. Open in Google Drive or your preferred app.</p>
            </div>
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
    container.classList.add('modal-enter');
    
    // Scroll to modal with smooth behavior
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
    if (window.lucide) {
        lucide.createIcons();
    }
};

window.hideExamSubjects = function () {
    const container = document.getElementById('exam-subjects-container');
    container.style.display = 'none';
};

// --- Drawer Navigation Handler ---
function initializeDrawer() {
    const menuToggle = document.getElementById('menu-toggle');
    const sideDrawer = document.getElementById('side-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerClose = document.getElementById('drawer-close');
    const drawerItems = document.querySelectorAll('.drawer-item');

    // Open drawer
    menuToggle.addEventListener('click', () => {
        sideDrawer.classList.add('active');
        drawerOverlay.classList.add('active');
    });

    // Close drawer
    function closeDrawer() {
        sideDrawer.classList.remove('active');
        drawerOverlay.classList.remove('active');
    }

    drawerClose.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    // Close drawer when item is clicked
    drawerItems.forEach(item => {
        item.addEventListener('click', closeDrawer);
    });
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    init();
    initializeDrawer();
});
