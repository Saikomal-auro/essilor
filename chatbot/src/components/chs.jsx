import React, { useState, useEffect } from 'react';
import ProductTile from './ProductTile'; // Import the ProductTile component

const ChatMessages = ({ selectedChat, sendMessageToChatbot }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [products, setProducts] = useState([]); // State to hold the products

  useEffect(() => {
    const fetchChatHistory = async () => {
      const { botResponse, products } = await sendMessageToChatbot(userInput, selectedChat);
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { role: 'bot', content: botResponse },
      ]);
      setProducts(products); // Set the products when the response is received
    };

    if (userInput) {
      fetchChatHistory();
    }
  }, [userInput, selectedChat, sendMessageToChatbot]);

  const handleSendMessage = () => {
    setUserInput(userInput); // Trigger the effect when a message is sent
  };

  return (
    <div>
      <div className="chat-history">
        {chatHistory.map((message, index) => (
          <div key={index}>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      {/* Conditionally render ProductTile component if there are products */}
      {products.length > 0 && (
        <div className="product-tiles">
          {products.map((product) => (
            <ProductTile key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type a message"
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatMessages;
