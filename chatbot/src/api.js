const API_BASE_URL = import.meta.env.VITE_BACKEND_URL; // Ensure .env is correctly set
console.log("Backend URL:", import.meta.env.VITE_BACKEND_URL);

export async function sendMessageToDialogflow(message, sessionId = "123456") {
  try {
    console.log("🔵 Sending message to backend:", { message, sessionId });

    const response = await fetch(`${API_BASE_URL}/api/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, sessionId }),
    });

    if (!response.ok) {
      throw new Error(`🔴 API Error: ${response.status} - ${response.statusText}`);
    }

    // Attempt to parse JSON response
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error("❌ JSON Parse Error: Invalid JSON response from backend");
    }

    console.log("🟢 Response received from backend:", data);

    // Ensure we have a valid reply
    if (!data.reply) {
      throw new Error("⚠️ No reply received from backend");
    }

    return data.reply;
  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    return "❌ Error: Unable to fetch response. Try again!";
  }


}
