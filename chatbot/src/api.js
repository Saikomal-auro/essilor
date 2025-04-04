const BASE_URL = import.meta.env.VITE_BACKEND_URL;

let cachedConversationId = null;

// Session and Conversation ID management
export const getSessionId = () => {
  let sessionId = localStorage.getItem("session_id");
  if (!sessionId) {
    sessionId = Math.random().toString(36).substr(2, 9);
    localStorage.setItem("session_id", sessionId);
    console.log("✨ Generated New Session ID:", sessionId);
  }
  return sessionId;
};

export const getConversationId = (selectedChat) => {
  if (selectedChat && selectedChat.conversation_id) {
    console.log("🎯 Using Selected Chat Conversation ID:", selectedChat.conversation_id);
    cachedConversationId = selectedChat.conversation_id;
    return selectedChat.conversation_id;
  }

  if (cachedConversationId) {
    console.log("🎯 Using Cached Conversation ID:", cachedConversationId);
    return cachedConversationId;
  }

  let conversationId = localStorage.getItem("conversation_id");
  if (!conversationId) {
    conversationId = Math.random().toString(36).substr(2, 9);
    localStorage.setItem("conversation_id", conversationId);
    console.log("✨ Generated New Conversation ID:", conversationId);
  } else {
    console.log("🎯 Using Stored Conversation ID:", conversationId);
  }

  cachedConversationId = conversationId;
  return conversationId;
};

// Chat history management
export const getLocalChatHistory = () => {
  const history = localStorage.getItem("chat_history") || "[]";
  return history ? JSON.parse(history) : [];
};

export const saveChatHistory = (chatHistory) => {
  localStorage.setItem("chat_history", JSON.stringify(chatHistory));
};

const getLocalConversationHistory = (conversationId) => {
  const history = getLocalChatHistory();
  const chat = history.find((c) => c.conversation_id === conversationId);
  return chat?.messages || [];
};

const saveToLocalStorage = (conversationId, messages) => {
  const history = getLocalChatHistory();
  const chatIndex = history.findIndex((c) => c.conversation_id === conversationId);
  const updatedChat = {
    id: conversationId,
    conversation_id: conversationId,
    title: history[chatIndex]?.title || `Conversation ${new Date().toISOString()}`,
    messages: messages,
    timestamp: Date.now(),
  };

  if (chatIndex >= 0) {
    history[chatIndex] = updatedChat;
  } else {
    history.push(updatedChat);
  }
  saveChatHistory(history);
};

export const fetchChatHistory = async (sessionId, conversationId) => {
  if (!sessionId || !conversationId) {
    console.error("🚨 No session or conversation ID found!");
    return { messages: [], title: "", timestamp: null };
  }

  const localHistory = getLocalChatHistory();
  const cachedChat = localHistory.find(chat => chat.conversation_id === conversationId);
  
  if (cachedChat?.messages.length > 0) return cachedChat; // ✅ Fast return if found

  try {
    console.log("📥 Fetching chat history from Firestore for:", sessionId, conversationId);
    const response = await fetch(`${BASE_URL}/chat/${sessionId}/${conversationId}`);
    
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    
    const data = await response.json();
    console.log("✅ Firestore Chat History Found:", data);

    if (!data || !Array.isArray(data.messages)) {
      console.warn("⚠️ Invalid chat history format received:", data);
      return { messages: [], title: "", timestamp: null };
    }

    // 🔄 Normalizing messages for consistency
    const normalizedMessages = data.messages.map(msg => ({
      role: msg.role || (msg.user ? "user" : "bot"),
      content: msg.content || msg.user || msg.bot,
      timestamp: msg.timestamp,
    }));

    const updatedChat = {
      id: conversationId,
      conversation_id: conversationId,
      title: data.title || `Conversation ${new Date().toISOString()}`,
      messages: normalizedMessages,
      timestamp: data.timestamp || Date.now(),
    };

    // ⚡ Efficiently update local cache
    const updatedHistory = localHistory.filter(chat => chat.conversation_id !== conversationId);
    updatedHistory.push(updatedChat);
    saveChatHistory(updatedHistory);

    return updatedChat;
  } catch (error) {
    console.error("🚨 Error fetching chat history:", error);
    return { messages: [], title: "", timestamp: null };
  }
};


export const sendMessageToChatbot = async (userInput, selectedChat) => {
  console.log("📢 sendMessageToChatbot called with userInput:", userInput, "selectedChat:", selectedChat);
  const sessionId = getSessionId();
  let conversationId = getConversationId(selectedChat);

  if (!sessionId) {
    console.error("🚨 No session ID found!");
    return { botResponse: "Error: Unable to establish a session.", products: [] };
  }

  if (!conversationId && (!selectedChat || !selectedChat.conversation_id)) {
    console.log("📢 Calling startNewConversation from sendMessageToChatbot");
    conversationId = await startNewConversation(sessionId, false);
    if (!conversationId) {
      console.error("🚨 Failed to create new conversation!");
      return { botResponse: "Error: Unable to establish a conversation.", products: [] };
    }
    if (selectedChat) selectedChat.conversation_id = conversationId;
  }

  userInput = userInput.trim();
  if (!userInput) return { botResponse: "⚠️ Cannot send an empty message!", products: [] };

  let conversationHistory = getLocalConversationHistory(conversationId);
  conversationHistory.push({ role: "user", content: userInput });
  saveToLocalStorage(conversationId, conversationHistory);

  try {
    console.log("📤 Sending:", { sessionId, conversationId, userInput });

    const response = await fetch(`${BASE_URL}/chat/${sessionId}/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_input: userInput }),
      // 10-second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        console.warn("🚨 Conversation not found, creating a new one...");
        const newConversationId = await startNewConversation(sessionId);
        if (!newConversationId) throw new Error("Failed to create new conversation");
        return sendMessageToChatbot(userInput, { conversation_id: newConversationId });
      }
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ API Response:", data);

    let botResponse = data.response || "No response from chatbot.";
    let products = data.table || [];
    products = products.map((product, index) => ({
      ...product,
      id: index + 1,  // Simple approach: use the index for a unique id (or combine fields for uniqueness)
    }));

    // // Handle image generation request directly
    // if (userInput.toLowerCase().includes("generate image") || userInput.toLowerCase().includes("create image")) {
    //   // Placeholder until backend supports image generation
    //   botResponse = "Image generation is not yet supported. Here’s a placeholder response instead.";
    //   // Future: If backend returns an image URL, update this to display it
    // }

    conversationHistory.push({ role: "bot", content: botResponse, products });
    saveToLocalStorage(conversationId, conversationHistory);

    return { botResponse, products };
  } catch (error) {
    console.error("🚨 Chatbot API Error:", error);
    if (error.name === "AbortError") {
      console.error("Request timed out after 10 seconds.");
      return { botResponse: "Sorry, the request timed out. Please try again.", products: [] };
    }
    const rollbackHistory = getLocalChatHistory();
    const rollbackIndex = rollbackHistory.findIndex((chat) => chat.conversation_id === conversationId);
    if (rollbackIndex >= 0) {
      rollbackHistory[rollbackIndex].messages.pop();
      saveChatHistory(rollbackHistory);
    }
    return { botResponse: "Sorry, I encountered an error. Please try again.", products: [] };
  }
};

let isCreatingConversation = false;

export const startNewConversation = async (sessionId, forceNew = false) => {
  console.log("📢 startNewConversation called with sessionId:", sessionId, "forceNew:", forceNew);
  if (!sessionId) {
    console.error("🚨 Error: Session ID is missing!");
    return null;
  }

  if (isCreatingConversation) {
    console.log("⏳ startNewConversation already in progress, waiting for existing call");
    return cachedConversationId || localStorage.getItem("conversation_id");
  }

  if (!forceNew && cachedConversationId) {
    console.log("🎯 Using cached conversation ID:", cachedConversationId);
    return cachedConversationId;
  }

  const existingConversationId = localStorage.getItem("conversation_id");
  if (!forceNew && existingConversationId) {
    console.log("🎯 Using existing conversation ID:", existingConversationId);
    cachedConversationId = existingConversationId;
    return existingConversationId;
  }

  isCreatingConversation = true;
  const newConversationId = Math.random().toString(36).substr(2, 9);

  try {
    const response = await fetch(`${BASE_URL}/chat/${sessionId}/${newConversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_input: "init" }),
      // cache: "no-store",
      // 10-second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
    }

    const data = await response.json();
    localStorage.setItem("conversation_id", newConversationId);
    cachedConversationId = newConversationId;
    console.log("✅ New conversation created:", newConversationId);

    const initialMessages = [
      {
        role: "bot",
        content: data.response || "Hello, how can I assist you with sunglasses or eyewear today?",
      },
    ];
    saveToLocalStorage(newConversationId, initialMessages);

    return newConversationId;
  } catch (error) {
    console.error("🚨 Error creating new conversation:", error);
    if (error.name === "AbortError") {
      console.error("Request timed out after 10 seconds.");
    }
    return null;
  } finally {
    isCreatingConversation = false;
  }
};

export const deleteChat = async (sessionId, conversationId) => {
  if (!sessionId || !conversationId) {
    console.error("🚨 No session or conversation ID found!");
    throw new Error("Missing session or conversation ID");
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/${sessionId}/${conversationId}`, {
      method: "DELETE",
     // 10-second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
    }

    console.log("✅ Chat deleted successfully:", conversationId);

    const chatHistory = getLocalChatHistory();
    const updatedHistory = chatHistory.filter((chat) => chat.id !== conversationId);
    saveChatHistory(updatedHistory);
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory)); // Sync with App.jsx key
    localStorage.removeItem("conversation_id");

    return true;
  } catch (error) {
    console.error("🚨 Error deleting chat:", error);
    if (error.name === "AbortError") {
      console.error("Request timed out after 10 seconds.");
    }
    throw error;
  }
};