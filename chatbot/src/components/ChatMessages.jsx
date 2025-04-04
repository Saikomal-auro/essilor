import { useEffect, useRef, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import userIcon from "../assets/images/user.svg";
import botIcon from "../assets/images/logo.svg";
import ProductTile from "./ProductTile";

function ChatMessages({ messages, isLoading }) {
  const messagesEndRef = useRef(null);

  // Smooth scrolling to the latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isLoading]);

  return (
    <div className="grow flex flex-col items-center space-y-4 px-4 overflow-y-auto w-full">
      {messages.map(({ role, content, products }, idx) => (
        <MessageBubble
          key={idx}
          role={role}
          content={content}
          products={products}
        />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ role, content, products }) {
  const isUser = role === "user";

  // Normalize content to string for Markdown
  const messageText =
    typeof content === "object" && content.botResponse
      ? content.botResponse
      : String(content);

  // Memoized Markdown components with image support
  const markdownComponents = useMemo(() => ({
    table: ({ children }) => (
      <div className="border border-gray-400 rounded-md overflow-hidden mt-2">
        {children}
      </div>
    ),
    thead: () => null,
    tbody: ({ children }) => (
      <div className="divide-y divide-gray-300">{children}</div>
    ),
    tr: ({ children }) => (
      <div className="flex justify-between px-4 py-2 bg-gray-100 border-b border-gray-300">
        {children}
      </div>
    ),
    th: ({ children }) => (
      <span className="font-semibold text-gray-800">{children}:</span>
    ),
    td: ({ children }) => <span className="text-gray-700">{children}</span>,
    li: ({ children }) => (
      <div className="flex items-start gap-2">
        <span>•</span>
        {children}
      </div>
    ),
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt || "Embedded image"}
        className="max-w-full h-auto rounded-md mt-2 shadow-sm"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = "/images/fallback-image.jpg"; // Adjust path as needed
        }}
      />
    ),
  }), []);

  return (
    <div className="w-full flex justify-center">
      <div
        className={`flex items-start gap-3 max-w-2xl w-full ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        {!isUser && (
          <img
            className="h-8 w-8 self-start"
            src={botIcon}
            alt="Bot avatar"
            loading="lazy"
          />
        )}

        <div className={`py-3 px-4 rounded-xl shadow-md max-w-[90%] ${isUser ? "bg-gray-200" : "bg-gray-300"}`}>
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
            className="whitespace-pre-wrap break-words"
          >
            {messageText}
          </Markdown>

          {/* Render ProductTile components if products exist */}
          {products?.length > 0 && (
            <div className="mt-4 space-y-4">
              {products.map((product, index) => (
                <ProductTile key={index} product={product} />
              ))}
            </div>
          )}
        </div>

        {isUser && (
          <img
            className="h-8 w-8 self-start"
            src={userIcon}
            alt="User avatar"
            loading="lazy"
          />
        )}
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
