import { useState, useEffect } from "react";
import { useImmer } from "use-immer";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { sendMessageToChatbot, startNewConversation, fetchChatHistory, getSessionId } from "../api";

// Import Images
import left1 from "../assets/images/left1.png";
import left2 from "../assets/images/left2.png";
import left3 from "../assets/images/left3.png";
import left4 from "../assets/images/left4.png";
import left5 from "../assets/images/left5.png";
import left6 from "../assets/images/left6.png";
import right1 from "../assets/images/right1.png";
import right2 from "../assets/images/right2.png";
import right3 from "../assets/images/right3.png";
import right4 from "../assets/images/right4.png";
import right5 from "../assets/images/right5.png";
import right6 from "../assets/images/right6.png";

const leftImages = [left1, left2, left3, left4, left5, left6];
const rightImages = [right1, right2, right3, right4, right5, right6];

function Chatbot({ selectedChat, updateChatHistory, chatHistory = [] }) {
  const [messages, setMessages] = useImmer(selectedChat ? selectedChat.messages : []);
  const [newMessage, setNewMessage] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(
    selectedChat?.conversation_id || localStorage.getItem("conversation_id")
  );
  const [sessionId] = useState(getSessionId());

  useEffect(() => {
    const loadChat = async () => {
      if (selectedChat?.conversation_id) {
        const chatData = await fetchChatHistory(sessionId, selectedChat.conversation_id);
        setMessages(chatData.messages || []);
        setConversationId(selectedChat.conversation_id);
      } else {
        setMessages([]);
        setConversationId(null);
      }
    };
    loadChat();
  }, [selectedChat, sessionId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % leftImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function submitNewMessage() {
    const trimmedMessage = newMessage.trim();
    
    if (!trimmedMessage) {
      console.error("❌ Error: Empty message not sent!");
      return; // Prevent sending empty messages
    }
    
    if (isLoading) return; // Prevent multiple requests while loading

    const userMessage = { role: "user", content: trimmedMessage, timestamp: Date.now() };

    // Show user's message in UI immediately
    setMessages((draft) => [...draft, userMessage, { role: "assistant", content: "", loading: true }]);
    setNewMessage("");
    setIsLoading(true);

    try {
      let currentConversationId = conversationId;

      if (!currentConversationId) {
        currentConversationId = await startNewConversation(sessionId);
        if (!currentConversationId) {
          throw new Error("❌ Error: Failed to create a new conversation.");
        }
        setConversationId(currentConversationId);
        localStorage.setItem("conversation_id", currentConversationId);
      }

      // Send message to backend with the conversationId
      const reply = await sendMessageToChatbot(trimmedMessage, { conversation_id: currentConversationId });
      const assistantMessage = { 
        role: "assistant", 
        content: reply.botResponse, 
        products: (reply.products || []).filter(product => product && typeof product === 'object'), // Filter out invalid products
        loading: false,
        timestamp: Date.now()
      };

      setMessages((draft) => {
        draft[draft.length - 1] = assistantMessage;
      });

      if (!selectedChat) {
        // If it's a new chat, create a new conversation in history
        const newChat = {
          conversation_id: currentConversationId,
          title: "New Conversation",
          messages: [userMessage, assistantMessage],
        };
        updateChatHistory(currentConversationId, newChat.messages);
      } else {
        updateChatHistory(currentConversationId, [...messages, userMessage, assistantMessage]);
      }
    } catch (error) {
      console.error("🚨 Error fetching chatbot response:", error);
      setMessages((draft) => {
        draft[draft.length - 1] = { 
          role: "assistant", 
          content: "❌ Error fetching response. Try again!", 
          loading: false,
          timestamp: Date.now()
        };
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex flex-col h-screen w-full bg-white font-urbanist">
      {/* Left Animated Image */}
      <div className="fixed left-13 top-1/2 md:bottom-16 transform -translate-y-1/2 opacity-90 transition-transform duration-700 ease-in-out z-0">
        <img src={leftImages[imageIndex]} alt="Left Avatar" className="w-40 md:w-56 lg:w-72 h-auto object-contain drop-shadow-lg" />
      </div>

      {/* Right Animated Image */}
      <div className="absolute fixed right-5 top-[53%] md:bottom-16 transform -translate-y-1/2 opacity-90 transition-transform duration-700 ease-in-out z-0">
        <img src={rightImages[imageIndex]} alt="Right Avatar" className="w-32 md:w-48 lg:w-64 h-auto object-contain drop-shadow-lg" />
      </div>

      {/* Welcome Message */}
      {messages.length === 0 && (
        <div className="mt-6 text-center text-gray-800 text-xl font-light w-full px-4 min-h-[50vh] flex flex-col items-center justify-center">
          <p>👋 Welcome!</p>
          <p>Start a new chat or select an existing one!</p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-grow overflow-y-auto px-4 relative z-10">
        <ChatMessages messages={messages} isLoading={isLoading} />
      </div>

      {/* Chat Input */}
      <div className="sticky bottom-0 w-full bg-white shadow-md p-4">
        <ChatInput newMessage={newMessage} isLoading={isLoading} setNewMessage={setNewMessage} submitNewMessage={submitNewMessage} />
      </div>
    </div>
  );
}

export default Chatbot;