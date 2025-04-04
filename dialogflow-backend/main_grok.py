import os
import json
import logging
import uvicorn
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from agno.agent import Agent
from agno.models.google import Gemini
from modules.agents import (
    clean_json_response,
    summarize_conversation,
    trigger_webhook,
    generate_post_webhook_prompt,
)
from modules.config import system_prompt

# 🔹 Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# 🔹 Load environment variables
load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"

# 🔹 Firestore Project ID
FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID", "your-gcp-project-id")
if not FIRESTORE_PROJECT_ID:
    raise ValueError("🚨 FIRESTORE_PROJECT_ID environment variable is not set!")

# 🔹 Initialize Firestore client
db = firestore.Client(project=FIRESTORE_PROJECT_ID)

# 🔹 Initialize FastAPI
app = FastAPI()

# 🔹 Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 Initialize AI model
gemini_model = Gemini(id="gemini-1.5-pro")
main_agent = Agent(model=gemini_model, markdown=True)

@app.get("/")
def home():
    """Health check endpoint"""
    return {"message": "Chatbot API is running on GCP App Engine!"}

@app.post("/chat/{session_id}/{conversation_id}")
async def chat(session_id: str, conversation_id: str, user_input: str = Body(..., embed=True)):
    """Process user input, generate a response, and store the conversation in Firestore."""
    if not session_id or not conversation_id:
        raise HTTPException(status_code=400, detail="Session ID and Conversation ID are required")
    
    if not user_input.strip():
        raise HTTPException(status_code=400, detail="User input cannot be empty")
        
    try:
        logger.info(f"📥 Received input: {user_input} (Session: {session_id}, Conversation: {conversation_id})")

 # 🔹 Firestore References
        session_ref = db.collection("chat_sessions").document(session_id)
        conversation_ref = session_ref.collection("conversations").document(conversation_id)

        # 🔹 Ensure session exists
        session_ref.set({"created_at": datetime.utcnow()}, merge=True)

        # 🔹 Retrieve conversation history
        doc = conversation_ref.get()
        data = doc.to_dict() if doc.exists else {}
        conversation_history = data.get("messages", [])

        if not isinstance(conversation_history, list):
            conversation_history = []

        # 🔹 Store user message
        conversation_history.append({
            "role": "user",
            "content": user_input,
            "timestamp": datetime.utcnow().isoformat()
        })

        # 🔹 Generate AI response
        full_prompt = system_prompt + "\n\nConversation so far:\n" + "\n".join(
            [f"{m['role'].capitalize()}: {m['content']}" for m in conversation_history]
        ) + f"\n\nUser Input: {user_input}"

        response = main_agent.run(full_prompt)
        response_data = clean_json_response(response.content) if response.content else {}
        chatbot_response = response_data.get("chatbot_response", "I'm sorry, I couldn't understand that.")
        should_trigger_webhook = response_data.get("should_trigger_webhook", False)

        webhook_info = None
        if should_trigger_webhook:
            webhook_info = trigger_webhook(conversation_history, user_input)
            if webhook_info:
                webhook_prompt = generate_post_webhook_prompt(user_input, webhook_info, conversation_history)
                webhook_response = main_agent.run(webhook_prompt)
                chatbot_response = webhook_response.content.strip()

        # 🔹 Store bot response
        conversation_history.append({
            "role": "bot",
            "content": chatbot_response,
            "timestamp": datetime.utcnow().isoformat()
        })

        # 🔹 Update Firestore
        conversation_ref.set({
            "messages": conversation_history,
            "title": data.get("title", f"Conversation {conversation_id}"),
            "timestamp": datetime.utcnow()
        }, merge=True)
        
        logger.info(f"✅ Firestore: Updated conversation {conversation_id} with new messages.")
 
        # 🔹 Return the response
        response_payload = {
            "response": chatbot_response,
            "conversation_id": conversation_id,
            "session_id": session_id
        }
        if should_trigger_webhook and webhook_info:
            response_payload["webhook_info"] = webhook_info

        return response_payload

    except Exception as e:
        logger.exception("🚨 Error processing chat request.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/{session_id}/{conversation_id}")
async def get_chat(session_id: str, conversation_id: str):
    """Retrieve chat history for a given session and conversation."""
    try:
        conversation_ref = db.collection("chat_sessions").document(session_id).collection("conversations").document(conversation_id)
        doc = conversation_ref.get()
        if not doc.exists:
            return {"messages": [], "title": "", "timestamp": None}
        data = doc.to_dict() if doc.exists else None
        return {
            "messages": data.get("messages", []),
            "title": data.get("title", ""),
            "timestamp": data.get("timestamp", None)
        }
    except Exception as e:
        logger.exception("🚨 Error fetching chat history.")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chat/{session_id}/{conversation_id}")
async def delete_chat(session_id: str, conversation_id: str):
    """Delete a specific conversation from Firestore."""
    try:
        conversation_ref = db.collection("chat_sessions").document(session_id).collection("conversations").document(conversation_id)
        
        if conversation_ref.get().exists:
            conversation_ref.delete()
            return {"message": "Chat deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Chat not found")

    except Exception as e:
        logger.exception("🚨 Error deleting chat.")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logger.info("🚀 Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)