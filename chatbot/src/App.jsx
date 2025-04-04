import { useState, useEffect } from "react";
import Chatbot from "./components/Chatbot";
import ChatHistory from "./components/ChatHistory";
import {
  fetchChatHistory,
  sendMessageToChatbot,
  startNewConversation,
  deleteChat,
  getConversationId,
  getSessionId,
} from "./api";

function App() {
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(false);
  const sessionId = getSessionId();

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    } else {
      localStorage.setItem("chatHistory", "[]"); // Clear when empty
    }
  }, [chatHistory]);

  async function loadChatHistory() {
    setLoading(true);
    const storedChats = JSON.parse(localStorage.getItem("chatHistory")) || [];
    
    try {
      if (storedChats.length === 0) {
        const newConversationId = await startNewConversation(sessionId); // No forceNew
        if (!newConversationId) {
          throw new Error("Failed to create initial conversation");
        }
        const chatData = await fetchChatHistory(sessionId, newConversationId);
        const firstChat = {
          id: newConversationId,
          conversation_id: newConversationId,
          title: "Conversation 1",
          messages: chatData.messages || [],
          timestamp: Date.now(),
        };
        setChatHistory([firstChat]);
        setSelectedChat(firstChat);
      } else {
        // Attempt to refresh chats, but keep stored data if fetch fails
        const updatedChats = await Promise.all(
          storedChats.map(async (chat) => {
            try {
              const validConversationId = chat.conversation_id || getConversationId(chat);
              const chatData = await fetchChatHistory(sessionId, validConversationId);
              return {
                ...chat,
                conversation_id: validConversationId,
                messages: chatData.messages || chat.messages,
              };
            } catch (error) {
              console.warn(`⚠️ Failed to refresh chat ${chat.conversation_id}:`, error);
              return chat; // Keep stored chat if fetch fails
            }
          })
        );
        setChatHistory(updatedChats);
        setSelectedChat(updatedChats[0]);
      }
    } catch (error) {
      console.error("🚨 Error loading chat history:", error);
      // Always fall back to stored chats if they exist
      if (storedChats.length > 0) {
        setChatHistory(storedChats);
        setSelectedChat(storedChats[0]);
      } else {
        // Only create a new chat if no stored chats exist
        const newConversationId = await startNewConversation(sessionId);
        if (newConversationId) {
          const chatData = await fetchChatHistory(sessionId, newConversationId);
          const fallbackChat = {
            id: newConversationId,
            conversation_id: newConversationId,
            title: "Conversation 1",
            messages: chatData.messages || [],
            timestamp: Date.now(),
          };
          setChatHistory([fallbackChat]);
          setSelectedChat(fallbackChat);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAddChat() {
    setLoading(true);
    try {
      const newConversationId = await startNewConversation(sessionId, true); // Force new chat here
      if (!newConversationId) throw new Error("Failed to create new conversation");
      const chatData = await fetchChatHistory(sessionId, newConversationId);
      const newChat = {
        id: newConversationId,
        conversation_id: newConversationId,
        title: `Conversation ${chatHistory.length + 1}`,
        messages: chatData.messages || [],
        timestamp: Date.now(),
      };
      setChatHistory(prev => [...prev, newChat]);
      setSelectedChat(newChat);
    } catch (error) {
      console.error("🚨 Error adding chat:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteChat(conversationId) {
    setLoading(true);
    const chatToDelete = chatHistory.find(chat => chat.conversation_id === conversationId);
    setChatHistory(prev => prev.filter(chat => chat.conversation_id !== conversationId));
    setSelectedChat(prev => (prev?.conversation_id === conversationId ? null : prev));
    try {
      await deleteChat(sessionId, conversationId);
      // Update local storage with the filtered chat history
      const updatedHistory = chatHistory.filter(chat => chat.conversation_id !== conversationId);
      localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
      if (updatedHistory.length === 0) {
        const newConversationId = await startNewConversation(sessionId);
        if (!newConversationId) throw new Error("Failed to create new conversation after deletion");
        const chatData = await fetchChatHistory(sessionId, newConversationId);
        const newChat = {
          id: newConversationId,
          conversation_id: newConversationId,
          title: "Conversation 1",
          messages: chatData.messages || [],
          timestamp: Date.now(),
        };
        setChatHistory([newChat]);
        setSelectedChat(newChat);
      }
    } catch (error) {
      console.error("🚨 Error deleting chat:", error);
      if (chatToDelete) {
        setChatHistory(prev => [...prev, chatToDelete]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectChat(chat) {
    setLoading(true);
    try {
      if (!chat?.conversation_id) {
        console.warn("⚠️ Chat missing conversation_id, assigning one...");
        chat.conversation_id = getConversationId(chat);
      }
      const chatData = await fetchChatHistory(sessionId, chat.conversation_id);
      const updatedChat = {
        ...chat,
        messages: chatData.messages || chat.messages,
      };
      setSelectedChat(updatedChat);
      updateChatHistory(chat.conversation_id, updatedChat.messages);
    } catch (error) {
      console.error("🚨 Error selecting chat:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(userInput) {
    if (!selectedChat || !selectedChat.conversation_id || !userInput.trim()) {
      console.error("❌ Error: No selected chat, invalid conversation ID, or empty message");
      if (!selectedChat || !selectedChat.conversation_id) {
        await handleAddChat();
        return handleSendMessage(userInput);
      }
      return;
    }
    setLoading(true);
    try {
      const botResponse = await sendMessageToChatbot(userInput, selectedChat);
      if (!botResponse) {
        throw new Error("No response from chatbot");
      }
      const updatedMessages = [
        ...selectedChat.messages,
        { role: "user", content: userInput },
        { role: "bot", content: botResponse.botResponse, products: botResponse.products }, // Adjusted for api.js return
      ];
      setSelectedChat((prev) => ({ ...prev, messages: updatedMessages }));
      updateChatHistory(selectedChat.conversation_id, updatedMessages);
    } catch (error) {
      console.error("🚨 Error sending message:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearData() {
    try {
      localStorage.clear();
      console.log("✅ LocalStorage cleared");
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log("✅ Browser cache cleared");
      } else {
        console.warn("⚠️ Cache API not supported, skipping cache clear");
      }
      setChatHistory([]);
      setSelectedChat(null);
      localStorage.setItem("chatHistory", "[]");
      const newSessionId = Math.random().toString(36).substr(2, 9);
      localStorage.setItem("session_id", newSessionId);
      const newConversationId = await startNewConversation(newSessionId);
      const chatData = await fetchChatHistory(newSessionId, newConversationId);
      const freshChat = {
        id: newConversationId,
        conversation_id: newConversationId,
        title: "Conversation 1",
        messages: chatData.messages || [],
        timestamp: Date.now(),
      };
      setChatHistory([freshChat]);
      setSelectedChat(freshChat);
      console.log("✅ App reset with fresh chat and new session");
    } catch (error) {
      console.error("🚨 Error clearing data:", error);
    }
  }

  function updateChatHistory(chatId, newMessages) {
    if (!newMessages || newMessages.length === 0) {
      console.warn("⚠️ No messages to update");
      return;
    }
    setChatHistory((prevHistory) =>
      prevHistory.map((chat) =>
        chat.conversation_id === chatId
          ? { ...chat, messages: newMessages, timestamp: Date.now() }
          : chat
      )
    );
  }

  return (
    <div className="flex h-screen">
      <ChatHistory
        chatHistory={chatHistory}
        onAddChat={handleAddChat}
        onDeleteChat={handleDeleteChat}
        onSelectChat={handleSelectChat}
        loading={loading}
      />
      <Chatbot
        selectedChat={selectedChat}
        onSendMessage={handleSendMessage}
        updateChatHistory={updateChatHistory}
        loading={loading}
      />
    </div>
  );
}

export default App;