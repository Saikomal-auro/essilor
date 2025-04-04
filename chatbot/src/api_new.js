export const fetchChatHistory = async (sessionId, conversationId) => {
  if (!sessionId || !conversationId) {
    console.error("🚨 No session or conversation ID found!");
    return { messages: [], title: "", timestamp: null };
  }

  const localHistory = getLocalChatHistory();
  const localChat = localHistory.find((chat) => chat.conversation_id === conversationId);
  if (localChat?.messages.length > 0) {
    return localChat;
  }

  try {
    console.log("📥 Fetching chat history from Firestore for:", sessionId, conversationId);
    const response = await fetch(`${BASE_URL}/chat/${sessionId}/${conversationId}`, {
    // 10-second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Firestore Chat History Found:", data);

    if (!data || !Array.isArray(data.messages)) {
      console.warn("⚠️ Invalid chat history format received:", data);
      return { messages: [], title: "", timestamp: null };
    }

    const normalizedMessages = data.messages.map((msg) => ({
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

    const chatHistory = getLocalChatHistory();
    const existingChatIndex = chatHistory.findIndex((chat) => chat.conversation_id === conversationId);
    if (existingChatIndex >= 0) {
      chatHistory[existingChatIndex] = updatedChat;
    } else {
      chatHistory.push(updatedChat);
    }
    saveChatHistory(chatHistory);

    return updatedChat;
  } catch (error) {
    console.error("🚨 Error fetching chat history:", error);
    return { messages: [], title: "", timestamp: null };
  }
};