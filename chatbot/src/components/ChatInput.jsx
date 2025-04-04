import { useCallback } from "react";
import useAutosize from "../hooks/useAutosize";
import sendIcon from "../assets/images/send.svg";

function ChatInput({ newMessage, isLoading, setNewMessage, submitNewMessage }) {
  const textareaRef = useAutosize(newMessage);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      submitNewMessage();
    }
  }, [isLoading, submitNewMessage]);

  return (
    <div className="sticky bottom-0 bg-transparent py-4 flex justify-center">
      <div className="p-1.5 bg-primary-blue/35 rounded-3xl z-50 font-mono origin-bottom animate-chat duration-400 w-96 md:w-[700px]">
        <div className="pr-0.5 bg-white relative shrink-0 rounded-3xl overflow-hidden ring-primary-blue ring-1 
                        focus-within:ring-2 transition-all">
          <textarea
            className="block w-full max-h-[140px] py-2 px-4 pr-11 bg-white rounded-3xl resize-none placeholder:text-primary-blue 
                       placeholder:leading-4 placeholder:-translate-y-1 sm:placeholder:leading-normal sm:placeholder:translate-y-0 
                       focus:outline-none focus:ring-2 focus:ring-primary-blue/60"
            ref={textareaRef}
            rows="1"
            placeholder="👓 Ask me anything!"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Chat input field"
          />
          <button
            className="absolute top-1/2 -translate-y-1/2 right-3 p-1 rounded-md hover:bg-primary-blue/20 transition-all duration-150"
            onClick={submitNewMessage}
            disabled={isLoading}
            aria-disabled={isLoading}
            title="Send message"
          >
            <img src={sendIcon} alt="Send message" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
