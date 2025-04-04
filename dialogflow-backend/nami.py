import os
import json
import logging
import uvicorn
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from sentence_transformers import SentenceTransformer
import chromadb
import pandas as pd
import re
from agno.agent import Agent
from agno.models.groq import Groq

# 🔹 Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# 🔹 Load environment variables
load_dotenv()
os.environ["GROQ_API_KEY"] = "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"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"

# 🔹 Firestore Project ID
FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID", "your-gcp-project-id")
if not FIRESTORE_PROJECT_ID:
    raise ValueError("🚨 FIRESTORE_PROJECT_ID environment variable is not set!")

# 🔹 Initialize Firestore client
db = firestore.Client(project=FIRESTORE_PROJECT_ID)

# 🔹 Initialize FastAPI
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# 🔹 Initialize AI model (GPU-enabled)
agent = Agent(model=Groq(id="llama-3.3-70b-versatile"), markdown=True)

# 🔹 Load Sentence Transformer model (GPU support if available)
model = SentenceTransformer("all-MiniLM-L6-v2", device="cuda" if os.environ.get("CUDA_AVAILABLE") else "cpu")

# 🔹 Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
new_collection = chroma_client.get_or_create_collection(name="products_v4")

# 🔹 Load product data
csv_path = "Updated_Essilor_Products.csv"  # Adjust path as needed
df = pd.read_csv(csv_path)

# 🔹 Format product descriptions
def format_description_v2(row):
    return (f"{row['Product Name']}, {row['Product Type']}, {row['Brand Name']}, "
            f"suitable for {row['Activity']}, face shape {row['Face Shape']}, "
            f"price {row['Price']} with a discount of {row['Dicount']}%. Image: {row['Image URL']}, "
            f"frame color {row['Frame Colour']} and lens color {row['Lens Color']}")

# 🔹 Insert product data into ChromaDB
for i, row in df.iterrows():
    description = format_description_v2(row)
    embedding = model.encode(description, convert_to_numpy=True).tolist()
    new_collection.add(
        ids=[str(i)],
        embeddings=[embedding],
        metadatas=[{
            "Product Name": row["Product Name"],
            "Brand Name": row["Brand Name"],
            "Price": row["Price"],
            "Discount": row["Dicount"],
            "Activity": row["Activity"],
            "Face Shape": row["Face Shape"],
            "Product Type": row["Product Type"],
            "Image URL": row["Image URL"],
            "Prescription Type": row["Prescription Type"],
            "Frame Colour": row["Frame Colour"],
            "Lens Color": row["Lens Color"]
        }]
    )
logger.info(f"Total products in collection: {new_collection.count()}")

# 🔹 Updated Search products function
def search_products_v2(query, top_k=5):
    query_embedding = model.encode(query, convert_to_numpy=True).tolist()
    results = new_collection.query(query_embeddings=[query_embedding], n_results=top_k)
    
    if not results["metadatas"][0]:  # No results found
        return []
    
    products = results["metadatas"][0]
    scores = results["distances"][0]
    
    results_df = pd.DataFrame(products)
    results_df["Similarity Score"] = [1 / (1 + score) for score in scores]
    
    # Handle price prioritization if user mentions a price
    words = query.split()
    price_query = next((float(w) for w in words if w.isdigit()), None)
    
    if price_query:
        results_df["Price Difference"] = abs(results_df["Price"] - price_query)
        results_df = results_df.sort_values(by=["Price Difference", "Similarity Score"], ascending=[True, False])
        results_df.drop(columns=["Price Difference"], inplace=True)
    
    return results_df[['Product Name', 'Price', 'Brand Name', 'Discount', 'Activity', 'Face Shape', 'Product Type', 'Image URL', 'Prescription Type', 'Frame Colour', 'Lens Color', 'Similarity Score']].to_dict(orient="records")

# 🔹 Utility Functions
def clean_chatbot_response(response):
    """
    Cleans and extracts JSON from a chatbot response.
     Args:
        response (str): Raw chatbot response containing JSON.
 
    Returns:
        dict: Parsed JSON if valid, otherwise an error message.
    """
    if not isinstance(response, str) or not response.strip():
        return {"error": "Empty or invalid response"}
    
    json_match = re.search(r"```json\s*(.*?)\s*```", response, re.DOTALL)
    if json_match:
        response = json_match.group(1).strip()
    
    json_match = re.search(r"\{.*\}", response, re.DOTALL)
    if json_match:
        json_str = json_match.group(0)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return {"error": "Failed to parse JSON"}
    
    return {"error": "No valid JSON found in response"}

def clean_and_parse_json(response):
    if not isinstance(response, str) or not response.strip():
        return {"chatbot_response": "", "run_retrieval": False}
    json_match = re.search(r"```json\s*(.*?)\s*```", response, re.DOTALL)
    if json_match:
        response = json_match.group(1).strip()
    json_match = re.search(r"\{.*\}", response, re.DOTALL)
    if json_match:
        json_str = json_match.group(0)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            logger.error("Failed to parse JSON")
            pass
    return {"chatbot_response": response.strip(), "run_retrieval": False}

def format_product_table(products):
    df = pd.DataFrame(products)
    return df.to_string(index=False)

# 🔹 Chatbot Function
def chatbot(user_input, conversation_history):
    prompt = f"""
    You are an Essilor chatbot, a company that provides expert advice on sunglasses and eyewear.
    Maintain a professional yet friendly tone. Personalize responses based on the user's needs. **Do not hallucinate**. Respond to the user in 3-4 lines.
    You should be able to answer basic trivia questions about glasses, about outfit choices that would match your products and other similar functions using your knowledge. Be creative.
    **Do not repeat yourself when the user's query changes.**
    You should be able to answer all kinds of questions about a product, including price, discount, more information, etc.
 
    if the user input can be answered from the conversation history, dont run retrieval
 
    Conversation History:
    {conversation_history}
 
    User: {user_input}
 
    Before responding, determine if the user is asking about glasses.
    Before responding, make sure that the product the user is looking for is actually in the database when run_retrieval= true. **Do not hallucinate**.
    If yes, return a JSON response in the **exact** format below:
 
    {{
      "chatbot_response": "Your response here.",
      "run_retrieval": true or false
    }}
 
    If the user asks a general query about something like a fashion choice related to some particular glasses OR trivia questions, then set "run_retrieval": false
    """
 
    raw_response = agent.run(prompt).content
    
    response_json = clean_and_parse_json(raw_response)
 
    retrieved_products = []
    if response_json.get("run_retrieval", False):
        retrieved_products = search_products_v2(user_input)
 
        if retrieved_products:
            product_info = "\n".join(
                [f"🕶️ {p['Product Name']} ({p['Brand Name']}) - Price: {p['Price']} INR, Discount: {p['Discount']}%, "
                 f"Suitable for: {p['Activity']}, Face Shape: {p['Face Shape']} "
                 f"\n🌄 Image: {p['Image URL']}, lens prescription type: {p['Prescription Type']}, frame color: {p['Frame Colour']}, lens color: {p['Lens Color']}" for p in retrieved_products]
            )
 
            retrieval_prompt = f"""
            You have the following conversation history: {conversation_history}. Using that, once you've retrieved the product {product_info}
            Based on {conversation_history} and {user_input}, give the best and most relevant responses from {product_info}.
             - Always give the complete info about the products, also their price.
            - You should give very human-like responses and need to be conversational.
            - When you recommend a product to a user, you need to logically explain *why* you're recommending the product in 1-2 lines.
            - Given this information, generate a conversational response summarizing the best product options for the user in 3-4 lines. **Do not hallucinate.**
            If a product does not exist in the database, tell the user that and then give a similar product recommendation.
 
            
            - Respond in JSON format with a list of products having the following structure:
 
            {{
            "chatbot_response": "Ok, I have found a few products for you:",
            "products": [
                {{
                "Product Name": "Product 1",
                "Price": 1000,
                "Brand Name": "Brand A",
                "Discount": "10%",
                "Activity": "Outdoor",
                "Face Shape": "Round",
                "Product Type": "Sunglasses",
                "Image URL": "http://example.com/image1.jpg",
                "Prescription Type": "Single Vision",
                "Frame Colour": "Black",
                "Lens Color": "Gray"
                }},
                {{
                "Product Name": "Product 2",
                "Price": 1200,
                "Brand Name": "Brand B",
                "Discount": "15%",
                "Activity": "Sports",
                "Face Shape": "Oval",
                "Product Type": "Eyeglasses",
                "Image URL": "http://example.com/image2.jpg",
                "Prescription Type": "Progressive",
                "Frame Colour": "Blue",
                "Lens Color": "Brown"
                }}
            ]
            }}
            """
 
            response_json["chatbot_response"] = agent.run(retrieval_prompt).content
 
    chatbot_response = response_json.get("chatbot_response", "I'm sorry, I couldn't understand your request. Can you please clarify?")
    if response_json.get("run_retrieval", False):
        cleaned_response = clean_chatbot_response(chatbot_response)
    else:
        cleaned_response=chatbot_response
    if "products" in cleaned_response:
        logger.info(cleaned_response["chatbot_response"])
        logger.info(format_product_table(cleaned_response["products"]))
   
    return cleaned_response

# 🔹 FastAPI Endpoints
@app.get("/")
def home():
    return {"message": "Chatbot API is running with GPU support!"}

@app.post("/chat/{session_id}/{conversation_id}")
async def chat(session_id: str, conversation_id: str, user_input: str = Body(..., embed=True)):
    if not session_id or not conversation_id or not user_input.strip():
        raise HTTPException(status_code=400, detail="Session ID, Conversation ID, and user input are required")

    try:
        logger.info(f"📥 Received input: {user_input} (Session: {session_id}, Conversation: {conversation_id})")
        
        # 🔹 Firestore References
        session_ref = db.collection("chat_sessions").document(session_id)
        conversation_ref = session_ref.collection("conversations").document(conversation_id)
        session_ref.set({"created_at": datetime.utcnow()}, merge=True)
        
        # 🔹 Retrieve conversation history
        doc = conversation_ref.get()
        data = doc.to_dict() if doc.exists else {}
        conversation_history = data.get("messages", [])
        if not isinstance(conversation_history, list):
            conversation_history = []

        # 🔹 Format conversation history for the chatbot
        formatted_history = ''.join([f"{m['role'].capitalize()}: {m['content']}\n" for m in conversation_history])

        # 🔹 Store user message
        conversation_history.append({
            "role": "user",
            "content": user_input,
            "timestamp": datetime.utcnow().isoformat()
        })

        # 🔹 Generate AI response using chatbot function
        response = chatbot(user_input, formatted_history)
        print(response)

        # 🔹 Handle response
        if "error" in response:
            chatbot_response = "I'm sorry, I couldn't process your request properly. Please try again."
            products = []
        else:
            if isinstance(response, str):
                chatbot_response=response
                products=[]
            else:
                chatbot_response = response.get("chatbot_response", "I'm sorry, I couldn't understand your request.")
                products = response.get("products", [])

        # 🔹 Format response with product table if applicable
        # 🔹 Store bot response
        conversation_history.append({
            "role": "bot",
            "content": chatbot_response,
            "table": products,
            "timestamp": datetime.utcnow().isoformat()
        })
        conversation_ref.set({
            "messages": conversation_history,
            "title": data.get("title", f"Conversation {conversation_id}"),
            "timestamp": datetime.utcnow()
        }, merge=True)
        logger.info(f"✅ Firestore: Updated conversation {conversation_id}")

        return {
            "response": chatbot_response,
            "table": products,
            "conversation_id": conversation_id,
            "session_id": session_id
        }

    except Exception as e:
        logger.exception("🚨 Error processing chat request.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/{session_id}/{conversation_id}")
async def get_chat(session_id: str, conversation_id: str):
    try:
        conversation_ref = db.collection("chat_sessions").document(session_id).collection("conversations").document(conversation_id)
        doc = conversation_ref.get()
        data = doc.to_dict() if doc.exists else {}
        
        # Get the table data from the conversation if available
        table = data.get("table", [])
        
        return {
            "messages": data.get("messages", []),
            "title": data.get("title", ""),
            "timestamp": data.get("timestamp", None),
            "table": table  # Include the table data in the response
        }
    except Exception as e:
        logger.exception("🚨 Error fetching chat history.")
        raise HTTPException(status_code=500, detail=str(e))
    


@app.get("/chat/{session_id}/get_conversation")
async def get_conversation(session_id: str):
    doc_ref = db.collection("users").document(session_id)
    doc = doc_ref.get()
    if doc.exists and "conversation_id" in doc.to_dict():
        return {"conversation_id": doc.to_dict()["conversation_id"]}
    return {"conversation_id": None}


@app.delete("/chat/{session_id}/{conversation_id}")
async def delete_chat(session_id: str, conversation_id: str):
    try:
        conversation_ref = db.collection("chat_sessions").document(session_id).collection("conversations").document(conversation_id)
        if conversation_ref.get().exists:
            conversation_ref.delete()
            return {"message": "Chat deleted successfully"}
        raise HTTPException(status_code=404, detail="Chat not found")
    except Exception as e:
        logger.exception("🚨 Error deleting chat.")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logger.info("🚀 Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8080)