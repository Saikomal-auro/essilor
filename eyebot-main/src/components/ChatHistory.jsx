import newMessageIcon from '../assets/images/new-message.png';

function ChatHistory({ chatHistory, onAddChat, onDeleteChat, onSelectChat }) {
  return (
    <div className="w-64 bg- shadow-xl p-4 h-full flex flex-col border border-gray-300 rounded-lg backdrop-blur-md">
      {/* Title */}
      <h3 className="text-primary-black font-semibold mb-4 text-lg font-urbanist">💬 Past Conversations</h3>

      {/* New Chat Button with Image */}
      <button 
        className="mb-4 bg-gradient-to-r from-black to-gray-800 text-white py-2 px-4 rounded-lg w-full flex items-center justify-center gap-2 
                   hover:from-gray-900 hover:to-black transition-all duration-200 shadow-md"
        onClick={onAddChat}
      >
        <img src={newMessageIcon} alt="New Chat" className="w-5 h-5" />
        New Chat
      </button>

      {/* Scrollable Chat List */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
        {chatHistory.length === 0 ? (
          <p className="text-gray-500 italic text-center">No chats yet</p>
        ) : (
          chatHistory.map((chat, index) => {
            const lastMessage = chat.messages?.length > 0 
              ? chat.messages[chat.messages.length - 1].text 
              : "No messages yet";

            // ✅ Ensure timestamp conversion
            let formattedDate = "Unknown Date";
            if (chat.timestamp) {
              let dateObj;
              
              // Firestore Timestamp conversion
              if (chat.timestamp.toMillis) {
                dateObj = new Date(chat.timestamp.toMillis());
              } else {
                dateObj = new Date(chat.timestamp);
              }

              // ✅ Ensure valid date
              if (!isNaN(dateObj.getTime())) {
                formattedDate = dateObj.toLocaleString('en-GB', { 
                  day: 'numeric', month: 'short', year: 'numeric', 
                  hour: '2-digit', minute: '2-digit' 
                });
              }
            }

            return (
              <div 
                key={chat.id} 
                className="bg-white/70 p-3 rounded-lg shadow-sm cursor-pointer hover:bg-gray-200 flex flex-col 
                           transition-all duration-200 border border-gray-300 backdrop-blur-lg"
                onClick={() => onSelectChat(chat)}
              >
                {/* Chat Title and Date */}
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="truncate text-gray-800 font-medium font-poppins">
                      {chat.title ? chat.title : `Conversation ${index + 1}`}
                    </span>
                    <p className="text-xs text-gray-500">{formattedDate}</p> {/* ✅ Correct Date Format */}
                  </div>
                  <button 
                    className="text-red-500 text-sm ml-2 hover:text-red-700 transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent chat selection when deleting
                      onDeleteChat(chat.id);
                    }}
                  >
                    ✖
                  </button>
                </div>
                
                {/* Last Message */}
                <p className="text-sm text-gray-600 italic truncate">{lastMessage}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ChatHistory;
