import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm"; // ✅ Enables table support
import userIcon from "../assets/images/user.svg";
import botIcon from "../assets/images/logo.svg";

function ChatMessages({ messages, isLoading }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div className="grow flex flex-col items-center space-y-4 px-4 overflow-y-auto w-full">
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

        <div className={`py-3 px-4 rounded-xl shadow-md max-w-[90%] ${isUser ? "bg-gray-200" : "bg-gray-300"}`}>
          <Markdown
            remarkPlugins={[remarkGfm]} // ✅ Enables Markdown table support
            components={{
              table: ({ children }) => (
                <div className="border border-gray-400 rounded-md overflow-hidden mt-2">{children}</div>
              ), // ✅ Adds border & rounded corners
              thead: () => null, // ✅ Remove table head
              tbody: ({ children }) => <div className="divide-y divide-gray-300">{children}</div>, // ✅ Adds line between rows
              tr: ({ children }) => (
                <div className="flex justify-between px-4 py-2 bg-gray-100 border-b border-gray-300">
                  {children}
                </div>
              ),
              th: ({ children }) => (
                <span className="font-semibold text-gray-800">{children}:</span>
              ), // ✅ Bold headings
              td: ({ children }) => <span className="text-gray-700">{children}</span>,
            }}
          >
            {content}
          </Markdown>
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
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
    </div>
  );
}

export default ChatMessages;
