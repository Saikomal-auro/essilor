const BASE_URL = import.meta.env.VITE_BACKEND_URL; // ✅ Vite environment variable

export const sendMessageToChatbot = async (conversationId, userInput) => {
  if (!conversationId) {
    console.error("🚨 No conversation ID provided!");
    return "Error: No conversation ID.";
  }

  try {
    console.log("📤 Sending:", {  userInput });

    const response = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
    
        user_input: userInput.trim()  
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ API Response:", data);

    let botResponse = data.response || "No response from chatbot.";

    if (
      data.webhook_info &&
      data.webhook_info.fulfillment_response?.messages?.[0]?.text?.text?.[0]
    ) {
      try {
        const rawText = data.webhook_info.fulfillment_response.messages[0].text.text[0];
        const parsedArray = JSON.parse(rawText);

        if (
          Array.isArray(parsedArray) &&
          parsedArray.some(row => row["Order ID"] && row["Date of Order"])
        ) {
          const order = parsedArray[0]; 

          let tableData = "\n📜 **Order Details**:\n\n";
          parsedArray.forEach((order, index) => {
            tableData += `\n\n\n\n### Order ${order["Order ID"]} \n\n`;

     
            

          // **Bold Headers**
          const headers = {
            "**Order ID**": order["Order ID"],
            "**Date of Order**": order["Date of Order"],
            "**Order Status**": order["Order Status"],
            "**Date of Delivery**": order["Date of Delivery"],
            "**Total Price**": `${order["Price"]} (Discount: ${order["Discount"] * 100}%)`,
            "**Quantity**": order["Quantity"],
            "**Product ID**": order["Product ID"]
          };

          // **Markdown Table (Double-Column)**
          tableData += `| **Field** | **Value** |\n`;
          tableData += `| --- | --- |\n`;
          Object.entries(headers).forEach(([key, value]) => {
            tableData += `| ${key} | ${value} |\n`;
          });
          tableData += `\n`; // Add spacing between tables
          });

          botResponse = data.response.replace(/Is there anything else I can help you with\?\s*$/, "") + `\n\n${tableData}`;
        }
      } catch (error) {
        console.error("🚨 Error parsing fulfillment response:", error);
      }
    }

    return botResponse;
  } catch (error) {
    console.error("🚨 Chatbot API Error:", error);
    return "Sorry, I encountered an error. Please try again.";
  }
};
