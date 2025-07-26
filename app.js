import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp, doc, setDoc, getDoc, deleteDoc, writeBatch, updateDoc, getDocs } from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : { apiKey: "AIza...", authDomain: "...", projectId: "..." };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Passwords & Settings ---
const TRAINING_PASSWORD = "kingmonil";
const ADMIN_PASSWORD = "16c21d17";
const YOUR_EMAIL = "monil@jeevananksh.com";
const YOUR_PHONE = "9328552413";

// --- UI Components ---

const SparkleIcon = ({className = "text-yellow-300"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2L9.88 7.33L4 8.17l4.42 4.29L7.24 18L12 15.27L16.76 18l-1.18-5.54L20 8.17l-5.88-.84L12 2zm0 12l-1.45 3.54L7 16.27l3.24 2.19L9.12 22L12 20.27L14.88 22l-1.12-3.54L17 16.27l-3.55-1.27L12 14z"/>
    </svg>
);


const LoadingSpinner = ({text = "Thinking..."}) => (
    <div className="w-full flex justify-start pl-4 py-3">
        <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300">{text}</span>
        </div>
    </div>
);

const SystemMessage = ({ children }) => (
    <div className="w-full flex justify-center px-4 py-2 animate-fade-in">
        <div className="text-center text-sm text-cyan-300 bg-cyan-900/50 rounded-full px-4 py-1.5 shadow-lg">
            {children}
        </div>
    </div>
);

const ChatMessage = ({ msg, role, isTrainer = false }) => {
    const isModel = role === 'model';
    const isYou = role === 'user' && !isTrainer;

    const formatMessage = (text) => {
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/`(.*?)`/g, '<code class="bg-black/20 text-white/80 rounded px-1.5 py-0.5 text-sm font-mono">$1</code>');
        const mailtoRegex = new RegExp(`\\[(.*?)\\]\\(mailto:${YOUR_EMAIL}\\?subject=(.*?)\\)`, 'g');
        text = text.replace(mailtoRegex, `<a href="mailto:${YOUR_EMAIL}?subject=$2" class="text-cyan-400 font-semibold hover:underline">Click here to send an email</a>`);
        return { __html: text };
    };
    
    const alignment = isYou ? 'justify-end' : 'justify-start';
    const bgColor = isTrainer ? 'bg-purple-600 rounded-br-lg' : isModel ? 'bg-white/20 backdrop-blur-md rounded-bl-lg' : 'bg-blue-500 rounded-br-lg';

    return (
        <div className={`w-full flex px-4 animate-fade-in-up ${alignment}`}>
            <div className={`max-w-xl md:max-w-2xl px-4 py-2.5 shadow-lg rounded-2xl ${bgColor}`}>
                 {isTrainer && <p className="text-xs font-bold text-purple-200 mb-1">Trainer (Gemini)</p>}
                <p className="text-white whitespace-pre-wrap" dangerouslySetInnerHTML={formatMessage(msg)} />
            </div>
        </div>
    );
};

const Modal = ({ title, children, onClose, showCloseButton = true }) => (
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center animate-fade-in" onClick={onClose}>
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center"><SparkleIcon /> <span className="ml-2">{title}</span></h2>
            {children}
            {showCloseButton && <button onClick={onClose} className="w-full mt-6 px-4 py-2.5 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition">Close</button>}
        </div>
    </div>
);

// --- Main Application ---
export default function App() {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [mode, setMode] = useState('user'); 
    const [activeLiveChatId, setActiveLiveChatId] = useState(null);
    const [liveChatMessages, setLiveChatMessages] = useState([]);

    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [isTrainingActive, setIsTrainingActive] = useState(false);
    const [isWaitingForAdmin, setIsWaitingForAdmin] = useState(false);

    const [trainingData, setTrainingData] = useState([]);
    const [liveHelpRequests, setLiveHelpRequests] = useState([]);
    
    // Admin panel specific state
    const [competitorInput, setCompetitorInput] = useState('');
    const [analysisResult, setAnalysisResult] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [leadGenInput, setLeadGenInput] = useState('');
    const [leadGenResults, setLeadGenResults] = useState('');
    const [isGeneratingLeads, setIsGeneratingLeads] = useState(false);


    const chatContainerRef = useRef(null);
    const isMounted = useRef(true);
    const trainingTimerRef = useRef(null); // Ref to hold the training timer

    // --- Effects ---
     useEffect(() => {
        isMounted.current = true;
        // Cleanup timer on component unmount
        return () => { 
            isMounted.current = false; 
            clearTimeout(trainingTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
             if(isMounted.current) {
                setIsAuthReady(true);
             }
        });
        const performSignIn = async () => {
            if (!auth.currentUser) {
                try {
                    await (typeof __initial_auth_token !== 'undefined' && __initial_auth_token ? signInWithCustomToken(auth, __initial_auth_token) : signInAnonymously(auth));
                } catch (err) {
                    console.error("Auth failed:", err);
                }
            }
        };
        performSignIn();
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        const trainingQuery = query(collection(db, `artifacts/${appId}/public/data/jeevananksh_training`));
        const unsubTraining = onSnapshot(trainingQuery, (snap) => {
             if(isMounted.current) setTrainingData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        
        const helpQuery = query(collection(db, `artifacts/${appId}/public/data/help_requests`));
        const unsubHelp = onSnapshot(helpQuery, (snap) => {
             if (!isMounted.current) return;
             const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             setLiveHelpRequests(requests);

             const myRequest = requests.find(r => r.userId === userId && r.status === 'connected');
             if (myRequest && mode !== 'live_chat') {
                 if (isMounted.current) {
                    setActiveLiveChatId(myRequest.liveChatId);
                    setMode('live_chat');
                    setIsWaitingForAdmin(false); // Unlock chat when admin connects
                 }
             }
        });

        return () => { unsubTraining(); unsubHelp(); };
    }, [isAuthReady, userId, mode]);

     useEffect(() => {
        if (activeLiveChatId && mode === 'live_chat') {
            const liveChatQuery = query(collection(db, `artifacts/${appId}/public/data/live_chats/${activeLiveChatId}/messages`));
            const unsubLiveChat = onSnapshot(liveChatQuery, (snap) => {
                if(isMounted.current) setLiveChatMessages(snap.docs.map(d => d.data()).sort((a,b) => a.createdAt.seconds - b.createdAt.seconds));
            });
            return () => unsubLiveChat();
        }
    }, [activeLiveChatId, mode]);


    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, liveChatMessages, isLoading, suggestedQuestions]);
    
    // --- Centralized API Call Logic ---
    const callGeminiAPI = async (payload) => {
        const apiKey = ""; // Leave as-is
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error Response:", errorBody);
            throw new Error(`Gemini API error: ${response.status}`);
        }
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]) {
            return result.candidates[0].content;
        }
        throw new Error("Invalid API response structure from Gemini.");
    };

    // --- Training Logic ---
    const runTrainingTurn = async () => {
        if (!isMounted.current || !isTrainingActive) return;
        setIsLoading(true);

        const CORE_TOPICS = [
            "Founding Story", "Core Products", "Mission and Vision", "Target Audience", "Key Founders"
        ];

        try {
            const knowledgeBase = trainingData.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n');
            const answeredTopics = new Set();
            trainingData.forEach(item => {
                const lowerQuestion = item.question.toLowerCase();
                CORE_TOPICS.forEach(topic => {
                    if(lowerQuestion.includes(topic.toLowerCase().split(' ')[0])) { // Simple keyword check
                        answeredTopics.add(topic);
                    }
                });
            });

            const missingTopics = CORE_TOPICS.filter(topic => !answeredTopics.has(topic));
            
            let questionerPrompt;
            if (missingTopics.length > 0) {
                 // Still basics to cover
                questionerPrompt = `You are a new AI for Jeev Anksh Eco Products. You need to learn the basics. Ask one foundational question to understand the company, focusing on a topic you haven't learned about yet. Your next question should be about one of these topics: ${missingTopics.join(', ')}.
                --- QUESTIONS ALREADY ASKED ---
                ${trainingData.map(d => d.question).join('\n') || "None"}
                --- END QUESTIONS ---`;
            } else {
                // Learned the basics, now ask strategic questions
                questionerPrompt = `You are the AI for Jeev Anksh Eco Products, but you are roleplaying as its new Chief Strategy Officer. Your goal is to deeply understand the company's market position, operations, and growth potential. Ask one insightful, non-obvious question to uncover strategic information. Do not ask simple factual questions that are easily found online. Instead, ask about strategy, challenges, target audience, or competitive advantages. Do not greet, just ask the strategic question.
                --- CURRENT KNOWLEDGE ---
                ${knowledgeBase}
                --- END KNOWLEDGE ---`;
            }

            const questionPayload = { contents: [{ role: 'user', parts: [{ text: questionerPrompt }] }] };
            const questionContent = await callGeminiAPI(questionPayload);
            const questionText = questionContent.parts[0].text;
            if (!isMounted.current || !isTrainingActive) return;
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: questionText }] }]);

            const trainerPrompt = `You are a world-class business researcher. Answer the following question about "Jeev Anksh Eco Products Private Limited", an eco-friendly products company in Assam, India. Provide a clear, factual, and helpful answer.
            ---
            Question: "${questionText}"`;

            const answerPayload = { contents: [{ role: 'user', parts: [{ text: trainerPrompt }] }] };
            const answerContent = await callGeminiAPI(answerPayload);
            const answerText = answerContent.parts[0].text;
            if (!isMounted.current || !isTrainingActive) return;
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: answerText }], isTrainer: true }]);

            await addDoc(collection(db, `artifacts/${appId}/public/data/jeevananksh_training`), {
                question: questionText,
                answer: answerText,
                createdAt: serverTimestamp()
            });

        } catch (err) {
            console.error("Training turn failed:", err);
            if (isMounted.current) {
                setMessages(prev => [...prev, { role: 'system', parts: [{ text: `Training error: ${err.message}` }] }]);
                setIsTrainingActive(false);
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
                // Schedule next turn only if training is still active
                if (isTrainingActive && mode === 'ai_training') {
                   trainingTimerRef.current = setTimeout(runTrainingTurn, 3000);
                }
            }
        }
    };
    
    useEffect(() => {
        if (isTrainingActive && mode === 'ai_training' && !isLoading) {
            // Start the first turn
            runTrainingTurn();
        }
        // Cleanup function to stop training if mode changes or component unmounts
        return () => {
            clearTimeout(trainingTimerRef.current);
        }
    }, [isTrainingActive, mode]);
    
    // --- Core Interaction Logic ---
    const stopTraining = () => {
        clearTimeout(trainingTimerRef.current);
        setIsTrainingActive(false);
        setIsLoading(false);
        setIsWaitingForAdmin(false);
    };

    const handleSendMessage = async (textOverride) => {
        const text = textOverride || userInput;
        if (!text.trim() || isLoading || isWaitingForAdmin) return;
        
        setUserInput('');
        setSuggestedQuestions([]);
        
        if (text.toLowerCase() === '/login') { setShowLoginModal(true); return; }
        if (text.toLowerCase() === '/stop' && mode === 'ai_training') {
            stopTraining();
            setMode('user');
            setMessages(prev => [...prev, {role: 'system', parts: [{ text: "AI training session stopped."}]}]);
            return;
        }
        if (text.toLowerCase() === '/exit') {
            stopTraining();
            if (mode === 'live_chat' && activeLiveChatId) {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/live_chats`, activeLiveChatId), { status: 'ended' });
                setActiveLiveChatId(null);
            }
            setMode('user'); 
            setMessages([]);
            return;
        }

        if (mode === 'live_chat') {
            await sendLiveChatMessage(text);
        } else {
            const newMessages = [...messages, { role: 'user', parts: [{ text }] }];
            setMessages(newMessages);
            setIsLoading(true);
            setError(null);
            await callUserFacingGemini(newMessages, text);
            setIsLoading(false);
        }
    };

    const callUserFacingGemini = async (chatHistory, userQuery) => {
        const knowledgeBase = trainingData.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n');
        const systemPromptText = `You are an AI assistant for "Jeev Anksh Eco Products Private Limited". Your tone is friendly, concise, and passionate about sustainability. Your knowledge is based *only* on the provided training data about our eco-friendly products from Assam. If the answer isn't in the data, say "That's a great question! I can't find that information yet, but I can connect you with our team." Do not invent information. If asked for contact or meetings, provide the mailto link and phone number.
        --- TRAINING DATA ---
        ${knowledgeBase || "No training data yet."}
        --- END TRAINING DATA ---`;
        
        const payload = { contents: [{ role: "user", parts: [{ text: systemPromptText }] }, ...chatHistory] };
        
        try {
            const content = await callGeminiAPI(payload);
            if (isMounted.current) {
                setMessages(prev => [...prev, content]);
                generateSuggestions(userQuery, content.parts[0].text);
            }
        } catch (err) {
            console.error(err);
            if (isMounted.current) setError("Sorry, I'm having trouble connecting.");
        }
    };
    
    const handleLogin = async () => {
        if (passwordInput === ADMIN_PASSWORD) {
            setMode('admin'); setMessages([]);
        } else if (passwordInput === TRAINING_PASSWORD) {
            setMode('ai_training');
            setMessages([{ role: 'system', parts: [{ text: "Live Training Session Initiated..."}]}]);
            setIsTrainingActive(true);
        } else {
            alert("Incorrect password.");
        }
        setShowLoginModal(false); setPasswordInput('');
    };

    const generateSuggestions = async (userQuery, modelResponse) => {
        const suggestionPrompt = `Based on the user's question and the AI's answer, generate 3 concise and relevant follow-up questions. Output them as a simple JavaScript array of strings. Example: ["What are your products made of?", "Where can I buy them?", "What is your mission?"]
        ---
        User Question: "${userQuery}"
        AI Answer: "${modelResponse}"
        ---
        Generate the array of follow-up questions now.`;

        try {
            const payload = { contents: [{ role: 'user', parts: [{ text: suggestionPrompt }] }] };
            const content = await callGeminiAPI(payload);
            const responseText = content.parts[0].text.replace(/```(json|javascript)?\n?/g, '').replace(/```/g, '');
            const suggestions = JSON.parse(responseText);
            if (isMounted.current && Array.isArray(suggestions)) {
                setSuggestedQuestions(suggestions.slice(0, 3));
            }
        } catch (error) {
            console.error("Could not generate suggestions:", error);
        }
    };
    
    const handleCompetitorAnalysis = async () => {
        if (!competitorInput.trim()) return;
        setIsAnalyzing(true);
        setAnalysisResult('');
        
        const analysisPrompt = `You are a business analyst specializing in the sustainable products market in India. Provide a brief but insightful SWOT analysis (Strengths, Weaknesses, Opportunities, Threats) for the following company: "${competitorInput}". Focus on their position relative to an Assam-based company like Jeev Anksh Eco Products. Format the output clearly with headings for each section.`;

        try {
            const payload = { contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }] };
            const content = await callGeminiAPI(payload);
            if (isMounted.current) {
                setAnalysisResult(content.parts[0].text);
            }
        } catch (error) {
            console.error("Analysis failed:", error);
             if (isMounted.current) {
                setAnalysisResult("Could not perform analysis. Please try again.");
            }
        }
        if (isMounted.current) setIsAnalyzing(false);
    };
    
    const handleLeadGeneration = async () => {
        if (!leadGenInput.trim()) return;
        setIsGeneratingLeads(true);
        setLeadGenResults('');
        
        const leadGenPrompt = `You are a B2B lead generation specialist for Jeev Anksh Eco Products, an Assam-based company creating high-quality, handcrafted, sustainable products (e.g., biodegradable dinnerware, water hyacinth bags, corporate gifts).
        
        Your task is to identify 5 potential B2B clients in India who would be a great fit for our products, based on this client description: "${leadGenInput}".

        For each lead, provide:
        1.  **Company Name:**
        2.  **Website:** (If available)
        3.  **Reason for Fit:** (A brief sentence explaining why they are a good match).`;

        try {
            const payload = { contents: [{ role: 'user', parts: [{ text: leadGenPrompt }] }] };
            const content = await callGeminiAPI(payload);
            if (isMounted.current) {
                setLeadGenResults(content.parts[0].text);
            }
        } catch (error) {
            console.error("Lead generation failed:", error);
            if (isMounted.current) {
                setLeadGenResults("Could not generate leads. Please try again.");
            }
        }
        if (isMounted.current) setIsGeneratingLeads(false);
    };

    const sendLiveChatMessage = async (text) => {
        if (!activeLiveChatId || !userId) return;
        const messageData = {
            text: text,
            senderId: userId,
            role: mode === 'admin' ? 'model' : 'user',
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, `artifacts/${appId}/public/data/live_chats/${activeLiveChatId}/messages`), messageData);
        setUserInput('');
    };

    const handleConnectToClient = async (request) => {
        const liveChatRef = await addDoc(collection(db, `artifacts/${appId}/public/data/live_chats`), {
            adminId: userId,
            clientId: request.userId,
            createdAt: serverTimestamp(),
            status: 'active'
        });

        await updateDoc(doc(db, `artifacts/${appId}/public/data/help_requests`, request.id), {
            status: 'connected',
            liveChatId: liveChatRef.id
        });

        setActiveLiveChatId(liveChatRef.id);
        setMode('live_chat');
    };
    
    // --- FULLY IMPLEMENTED FEATURES ---
    const handleSummarizeChat = async () => {
        if (messages.length === 0 || isLoading) return;
        setIsLoading(true);
        const chatHistoryText = messages.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
        const summaryPrompt = `Summarize the following conversation into a few concise bullet points:\n\n---\n${chatHistoryText}\n---`;
        
        try {
            const payload = { contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }] };
            const content = await callGeminiAPI(payload);
            if (isMounted.current) {
                setSummaryContent(content.parts[0].text);
                setShowSummaryModal(true);
            }
        } catch (err) {
            console.error("Summary failed:", err);
            setError("Could not generate summary.");
        }
        if (isMounted.current) setIsLoading(false);
    };

    const handleRequestHelp = async () => {
        if (!userId || isLoading) return;
        setIsLoading(true);
        setIsWaitingForAdmin(true);
        let summary = "User requested help before starting a conversation.";
        if (messages.length > 0) {
            const chatHistoryText = messages.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
            const summaryPrompt = `A user has requested live help. Summarize their conversation so far to give the admin context:\n\n---\n${chatHistoryText}\n---`;
            try {
                const payload = { contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }] };
                const content = await callGeminiAPI(payload);
                summary = content.parts[0].text;
            } catch (err) {
                console.error("Help request summary failed:", err);
                summary = "Could not generate summary, but user needs help.";
            }
        }

        await addDoc(collection(db, `artifacts/${appId}/public/data/help_requests`), {
            userId,
            summary,
            status: 'pending',
            createdAt: serverTimestamp()
        });

        if(isMounted.current) {
            setMessages(prev => [...prev, {role: 'system', parts: [{text: "Help request sent! An admin will connect with you shortly."}]}]);
            setIsLoading(false); // We keep waiting for admin, so loading is conceptually true
        }
    };


    const handleResetData = async () => {
        setIsLoading(true);
        const trainingCollectionRef = collection(db, `artifacts/${appId}/public/data/jeevananksh_training`);
        const querySnapshot = await getDocs(trainingCollectionRef);
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        if(isMounted.current) {
            setShowConfirmResetModal(false);
            setIsLoading(false);
        }
    };

    // --- Render Logic ---
    const renderContent = () => {
        if (mode === 'admin') {
           return (
                <div className="p-4 sm:p-6 text-white animate-fade-in overflow-y-auto h-full">
                    <h2 className="text-3xl font-bold mb-6">Admin Panel</h2>
                    <div className="space-y-6">
                        {/* Live Help Requests */}
                        <div className="bg-white/10 p-4 sm:p-6 rounded-xl">
                            <h3 className="text-xl font-semibold mb-4">Live Help Requests</h3>
                            <div className="space-y-4 max-h-48 overflow-y-auto">
                                {liveHelpRequests.filter(r => r.status === 'pending').length === 0 && <p className="text-gray-400">No pending requests.</p>}
                                {liveHelpRequests.filter(r => r.status === 'pending').map(req => (
                                    <div key={req.id} className="bg-gray-700/80 p-4 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="truncate text-sm text-gray-400">User: {req.userId}</p>
                                            <button onClick={() => handleConnectToClient(req)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-md transition text-sm">Connect</button>
                                        </div>
                                        <p className="text-sm font-semibold text-yellow-300 mb-1">✨ AI Summary:</p>
                                        <p className="text-gray-200 text-sm italic">{req.summary || "No summary available."}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* Lead Generation Tool */}
                        <div className="bg-white/10 p-4 sm:p-6 rounded-xl">
                            <h3 className="text-xl font-semibold mb-4 flex items-center">
                                <SparkleIcon className="text-green-300"/> <span className="ml-2">Lead Generation Tool</span>
                            </h3>
                             <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                <input 
                                    type="text"
                                    value={leadGenInput}
                                    onChange={(e) => setLeadGenInput(e.target.value)}
                                    placeholder="Describe a target client..."
                                    className="flex-grow p-2 rounded bg-gray-700 text-white border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <button onClick={handleLeadGeneration} disabled={isGeneratingLeads} className="px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition disabled:bg-green-800">
                                    {isGeneratingLeads ? "Searching..." : "Find Leads"}
                                </button>
                            </div>
                            {isGeneratingLeads && <div className="text-center p-4 text-gray-400">Generating potential leads...</div>}
                            {leadGenResults && (
                                <div className="mt-4 p-4 bg-black/20 rounded-lg whitespace-pre-wrap max-h-60 overflow-y-auto">
                                    <p className="text-gray-200" dangerouslySetInnerHTML={{ __html: leadGenResults.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>') }} />
                                </div>
                            )}
                        </div>

                        {/* Competitor Analysis */}
                        <div className="bg-white/10 p-4 sm:p-6 rounded-xl">
                            <h3 className="text-xl font-semibold mb-4 flex items-center">
                                <SparkleIcon className="text-cyan-300"/> <span className="ml-2">Intelligence Tool</span>
                            </h3>
                             <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                <input 
                                    type="text"
                                    value={competitorInput}
                                    onChange={(e) => setCompetitorInput(e.target.value)}
                                    placeholder="Enter competitor name..."
                                    className="flex-grow p-2 rounded bg-gray-700 text-white border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                                <button onClick={handleCompetitorAnalysis} disabled={isAnalyzing} className="px-4 py-2 rounded-lg font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition disabled:bg-cyan-800">
                                    {isAnalyzing ? "Analyzing..." : "Analyze"}
                                </button>
                            </div>
                            {isAnalyzing && <div className="text-center p-4 text-gray-400">Generating analysis...</div>}
                            {analysisResult && (
                                <div className="mt-4 p-4 bg-black/20 rounded-lg whitespace-pre-wrap">
                                    <p className="text-gray-200" dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>') }} />
                                </div>
                            )}
                        </div>

                        {/* Data Management */}
                         <div className="bg-white/10 p-4 sm:p-6 rounded-xl">
                            <h3 className="text-xl font-semibold mb-4">Data Management</h3>
                            <button onClick={() => setShowConfirmResetModal(true)} disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-red-900/50">
                                {isLoading ? "Resetting..." : "Reset All Training Data"}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        if (mode === 'live_chat') {
            return (
                 <>
                    <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        <SystemMessage>Live chat started. You are connected with an admin.</SystemMessage>
                        {liveChatMessages.map((msg, index) => (
                             <ChatMessage key={index} msg={msg.text} role={msg.senderId === userId ? 'user' : 'model'} />
                        ))}
                    </main>
                    <footer className="p-4 bg-transparent">
                        <div className="relative max-w-4xl mx-auto">
                            <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                placeholder="Type your live chat message..."
                                className="w-full pl-5 pr-14 py-3 bg-gray-900/50 backdrop-blur-lg text-white border-2 border-gray-600/80 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows="1"
                            />
                             <button onClick={() => handleSendMessage()} disabled={!userInput.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-500 transition">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </footer>
                </>
            )
        }
        
        // Default User view
        return (
            <>
                <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {messages.map((msg, index) => {
                        if (msg.role === 'system') return <SystemMessage key={index}>{msg.parts[0].text}</SystemMessage>;
                        return <ChatMessage key={index} msg={msg.parts[0].text} role={msg.role} isTrainer={msg.isTrainer} />
                    })}
                    {isLoading && <LoadingSpinner text={mode === 'ai_training' ? "Training in progress..." : "Thinking..."} />}
                     {suggestedQuestions.length > 0 && !isLoading && !isWaitingForAdmin &&(
                        <div className="flex justify-center flex-wrap gap-2 px-4 animate-fade-in">
                            {suggestedQuestions.map((q, i) => (
                                <button key={i} onClick={() => handleSendMessage(q)} className="bg-gray-700/80 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-full transition flex items-center space-x-1.5">
                                    <SparkleIcon className="w-4 h-4 text-cyan-400" />
                                    <span>{q}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {error && <div className="text-center text-red-400 p-3 rounded-md bg-red-500/20">{error}</div>}
                    <div className="h-4" />
                </main>
                <footer className="p-4 bg-transparent">
                     <div className="relative max-w-4xl mx-auto">
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder={
                                isWaitingForAdmin 
                                    ? "Connecting to an admin..." 
                                    : mode === 'ai_training' 
                                        ? "Observe training... Type /stop to end." 
                                        : "Ask me anything, or type /login..."
                            }
                            className="w-full pl-5 pr-14 py-3 bg-gray-900/50 backdrop-blur-lg text-white border-2 border-gray-600/80 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows="1"
                            disabled={mode === 'ai_training' || isLoading || isWaitingForAdmin}
                        />
                         <button onClick={() => handleSendMessage()} disabled={isLoading || !userInput.trim() || mode === 'ai_training' || isWaitingForAdmin} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-500 transition">
                             {(isLoading || isWaitingForAdmin) && mode !== 'ai_training' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>}
                        </button>
                    </div>
                </footer>
            </>
        )
    };
    
    return (
        <div className="font-sans antialiased h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
            <style>{`
                .bg-gradient-animate { background: linear-gradient(-45deg, #1f2937, #111827, #374151, #111827); background-size: 400% 400%; animation: gradient 15s ease infinite; }
                @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
            `}</style>
            
            {showLoginModal && (
                <Modal title="Special Access" onClose={() => setShowLoginModal(false)} showCloseButton={false}>
                    <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleLogin()} className="w-full p-3 rounded bg-gray-700 text-white border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter password..."/>
                    <button onClick={handleLogin} className="w-full mt-4 px-4 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition">Login</button>
                    <button onClick={() => setShowLoginModal(false)} className="w-full mt-2 px-4 py-2.5 rounded-lg font-semibold text-gray-300 bg-transparent hover:bg-gray-700 transition">Cancel</button>
                </Modal>
            )}

            {showSummaryModal && (
                 <Modal title="Conversation Summary" onClose={() => setShowSummaryModal(false)}>
                    <div className="text-gray-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: summaryContent.replace(/\* /g, '<span class="mr-2">•</span>') }}></div>
                </Modal>
            )}

             {showConfirmResetModal && (
                <Modal title="Confirm Reset" onClose={() => setShowConfirmResetModal(false)} showCloseButton={false}>
                    <p className="text-gray-300 mb-6">Are you sure you want to permanently delete all training data? This action cannot be undone.</p>
                    <div className="flex space-x-4">
                         <button onClick={() => setShowConfirmResetModal(false)} className="w-full px-4 py-2.5 rounded-lg font-semibold text-gray-300 bg-gray-600 hover:bg-gray-500 transition">Cancel</button>
                         <button onClick={handleResetData} className="w-full px-4 py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition">Yes, Reset Data</button>
                    </div>
                </Modal>
            )}


            <div className={`absolute inset-0 bg-gradient-animate z-[-1]`}></div>
            <header className="p-4 flex justify-between items-center bg-black/20 backdrop-blur-md border-b border-white/10">
                <h1 className="text-xl font-bold">Jeev Anksh AI Agent</h1>
                <div className="flex items-center space-x-2 sm:space-x-4">
                     {mode === 'user' && (
                         <>
                            <button onClick={handleSummarizeChat} disabled={isLoading || isWaitingForAdmin} className="p-1.5 rounded-full hover:bg-white/20 transition disabled:opacity-50"><SparkleIcon /></button>
                            <button onClick={handleRequestHelp} disabled={isLoading || isWaitingForAdmin} className="bg-green-500 text-white font-semibold text-sm px-3 py-1.5 rounded-full hover:bg-green-600 transition disabled:bg-green-800/50">
                                {isWaitingForAdmin ? "Waiting..." : "Request Live Help"}
                            </button>
                         </>
                     )}
                     {(mode !== 'user' && mode !== 'live_chat') && <button onClick={() => {setMode('user'); setMessages([]); stopTraining();}} className="bg-gray-600 text-white font-semibold text-sm px-3 py-1.5 rounded-full hover:bg-gray-500 transition">Exit Mode</button>}
                     {mode === 'live_chat' && <button onClick={() => handleSendMessage('/exit')} className="bg-red-600 text-white font-semibold text-sm px-3 py-1.5 rounded-full hover:bg-red-500 transition">End Live Chat</button>}
                </div>
            </header>
            
            {renderContent()}
        </div>
    );
}
