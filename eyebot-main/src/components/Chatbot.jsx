import { useState, useEffect } from "react";
import { useImmer } from "use-immer";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { sendMessageToChatbot } from "../api";

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

  useEffect(() => {
    setMessages(selectedChat ? selectedChat.messages : []);
  }, [selectedChat]);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % leftImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function submitNewMessage() {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || isLoading) return;

    const userMessage = { role: "user", content: trimmedMessage };

    setMessages((draft) => [...draft, userMessage, { role: "assistant", content: "", loading: true }]);
    setNewMessage("");
    setIsLoading(true);

    try {
      // Updated: Pass conversation ID along with the message
      const reply = await sendMessageToChatbot(selectedChat.id, trimmedMessage);
      const assistantMessage = { role: "assistant", content: reply, loading: false };

      setMessages((draft) => {
        draft[draft.length - 1] = assistantMessage;
      });

      if (!selectedChat) {
        const newChat = {
          id: Date.now().toString(),
          title: "Conversation 1",
          messages: [userMessage, assistantMessage],
        };
        updateChatHistory(newChat.id, newChat.messages);
      } else {
        updateChatHistory(selectedChat.id, [...messages, userMessage, assistantMessage]);
      }
    } catch (error) {
      console.error("Error fetching Dialogflow response:", error);
      setMessages((draft) => {
        draft[draft.length - 1] = { role: "assistant", content: "❌ Error fetching response. Try again!", loading: false };
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    
    <div className="relative flex flex-col h-screen w-full bg-white font-urbanist">
      {/* Left Animated Image */}
      <div className="fixed  left-13 top-1/2 md:bottom-16  transform -translate-y-1/2 opacity-90 transition-transform duration-700 ease-in-out z-0">
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
