import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import useAutoScroll from "../hooks/useAutoScroll";
import userIcon from "../assets/images/user.svg";
import botIcon from "../assets/images/logo.svg";

function ChatMessages({ messages, isLoading }) {
  const scrollContentRef = useAutoScroll(isLoading);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollContentRef} className="grow flex flex-col items-center space-y-4 px-4 overflow-y-auto w-full">
      {messages.map(({ role, content }, idx) => (
        <MessageBubble key={idx} role={role} content={content} />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className="w-full flex justify-center">
      <div className={`flex items-start gap-3 max-w-2xl w-full ${isUser ? "justify-end" : "justify-start"}`}>
        {!isUser && <img className="h-8 w-8 self-start" src={botIcon} alt="Bot" />}
        <div className={`py-3 px-4 rounded-xl shadow-md ${isUser ? "bg-gray-200" : "bg-gray-300"}`}>
          <Markdown>{content}</Markdown>
        </div>
        {isUser && <img className="h-8 w-8 self-start" src={userIcon} alt="User" />}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex space-x-1">
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-400"></span>
    </div>
  );
}

export default ChatMessages;
