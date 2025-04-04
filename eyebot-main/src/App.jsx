import { useState, useEffect } from "react";
import Chatbot from "./components/Chatbot";
import ChatHistory from "./components/ChatHistory";

function App() {
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);

  // Load chat history from localStorage
  useEffect(() => {
    const storedChats = JSON.parse(localStorage.getItem("chatHistory"));
    if (storedChats && storedChats.length > 0) {
      setChatHistory(storedChats);
      setSelectedChat(storedChats[0]); // Select first chat
    } else {
      createFirstChat(); // Ensure Conversation 1 exists
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  }, [chatHistory]);

  function createFirstChat() {
    const firstChat = {
      id: "conversation-1",
      title: "Conversation 1",
      messages: [], // ✅ Ensure first chat starts empty
      timestamp: Date.now(),
    };
    setChatHistory([firstChat]);
    setSelectedChat(firstChat);
  }

  function handleAddChat() {
    if (chatHistory.length === 0) {
      createFirstChat(); // Ensure Conversation 1 is created first
      return;
    }

    const newChat = {
      id: `conversation-${chatHistory.length + 1}`,
      title: `Conversation ${chatHistory.length + 1}`,
      messages: [], // ✅ Ensure new conversation starts empty
      timestamp: Date.now(),
    };

    setChatHistory((prev) => [...prev, newChat]);
    setSelectedChat(newChat); // ✅ Select the newly created chat
  }

  function handleDeleteChat(id) {
    setChatHistory((prev) => prev.filter((chat) => chat.id !== id));

    // If deleting the selected chat, set another as selected
    if (selectedChat?.id === id) {
      const remainingChats = chatHistory.filter((chat) => chat.id !== id);
      setSelectedChat(remainingChats.length > 0 ? remainingChats[0] : null);
    }
  }

  function handleSelectChat(chat) {
    setSelectedChat(chat);
  }

  function updateChatHistory(chatId, newMessages) {
    setChatHistory((prevHistory) =>
      prevHistory.map((chat) =>
        chat.id === chatId
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
      />
      <Chatbot selectedChat={selectedChat} updateChatHistory={updateChatHistory} />
    </div>
  );
}

export default App;
