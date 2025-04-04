

 
import json
 
import requests  # Import requests for HTTP calls
 
from agno.agent import Agent
 
from agno.models.google import Gemini
 
from modules.config import WEBHOOK_URL
 
import os
 
os.environ["GOOGLE_API_KEY"] = "AIzaSyDM5nwyCzeHLoV6-d6RWXYL6mDs4GdxtJA"
 
# Initialize Agno AI Agent
 
agent = Agent(
 
    model=Gemini(id="gemini-1.5-pro"),
 
    markdown=True,
 
)
 
summarizer_agent = Agent(
 
    model=Gemini(id="gemini-1.5-pro"),
 
    markdown=False,  # No need for markdown in summarization
 
)
 
def clean_json_response(response_text):
 
    """Extracts and cleans the JSON response from the agent's output."""
 
    try:
 
        response_text = response_text.strip()
 
        if response_text.startswith("```json"):
 
            response_text = response_text[7:]  # Remove ```json
 
        if response_text.endswith("```"):
 
            response_text = response_text[:-3]  # Remove ```
 
        return json.loads(response_text)
 
    except json.JSONDecodeError:
 
        return None
 
 
def summarize_conversation(conversation_history,latest_user_input):
 
    """Uses LLM to generate a concise summary of the conversation."""
 
    summary_prompt = f"""
 
    Summarize the following conversation history, :
 
    **Latest user input:**
 
    {latest_user_input}
 
    **Conversation history:**
 
    {conversation_history}
 
    Assume anything in the user input that has "o"/"O" followed by 3 numbers as **Order ID**.
    Assume anything in the user input that has "p"/"P" followed by 3 numbers as **Product ID**.
    Return the detailed summary of what the user is asking in 10 words, and if the user switches the topic completely, forget about the previous conversation and just summarise the current conversation.
   
    There is no product category as eyewear
    Do not assume any details that are not mentioned by the user.
    Aviator is a "Type"
 
    When the user switches the product they're looking for or the purpose, forget the unnecessary parts.
    if the user doesnt specifically say sunglasses,eyeglasses or goggles, do not assume any of these.
   
    """
 
    response = summarizer_agent.run(summary_prompt)
 
    return response.content.strip() if response else "Summary unavailable."
 
def trigger_webhook(conversation_history,latest_user_input):
 
    """Sends summarized conversation data to the Cloud Function webhook."""
 
    summary = summarize_conversation(conversation_history,latest_user_input)
 
    payload = {
 
        "summary": summary,
 
    }
 
    print("\n📤 Sending summarized payload to webhook:", json.dumps(payload, indent=2))
 
    try:
 
        response = requests.post(WEBHOOK_URL, json=payload)
 
        response.raise_for_status()
 
        print("\n✅ Webhook triggered successfully!")
 
        print(f"Response: {response.text}")
 
        # Try to parse the response as JSON
 
        try:
 
            webhook_data = json.loads(response.text)
 
            return webhook_data
 
        except json.JSONDecodeError:
 
            return response.text
 
    except requests.exceptions.RequestException as e:
 
        print("\n❌ Failed to trigger webhook.")
 
        print(f"Error: {e}")
 
        return None
 
import json
 
import json
 
def generate_post_webhook_prompt(user_input, webhook_info, conversation_history):
 
    """Generates a prompt that incorporates webhook info to respond to the user."""
 
    webhook_context = ""
 
    # Extract system response if available
 
    system_response = []
 
    if webhook_info and isinstance(webhook_info, dict):
 
        messages = webhook_info.get("fulfillment_response", {}).get("messages", [])
 
        if messages:
 
            text_responses = [msg.get("text", {}).get("text", []) for msg in messages]
 
            # Flatten and filter out empty or meaningless responses like "[]"
 
            system_response = [txt for sublist in text_responses for txt in sublist if txt.strip() and txt.strip() != "[]"]
 
    # Check if system_response contains meaningful data
 
    if system_response:
 
        webhook_context = f"""
 
        The system has processed the user's request with the following data:
 
        User input: {user_input}
 
        conversation_history: {conversation_history}
 
        System Response: {json.dumps(system_response, indent=2)}
 
       
 
        Using the above processed information, respond to the user's latest input: "{user_input}"
 
        Make sure to incorporate relevant details from the webhook response if appropriate. If the user acknowledges the agent's response
 
        by using phrases such as "ok fine", "fine", "thank you", etc. respond by asking if the user needs something else from Essilor, not about the product or order they asked about.
 
        If the user says "no" when asked if they have further questions or need further help, say bye and end chat.
 
        Do not hallucinate and make up information that does not exist in the webhook info.
 
        Respond in a conversational manner as an Essilor customer service representative in 2-3 lines.
 
        """
 
    else:
 
        webhook_context = f"""
 
        The system has processed the user's request, but no relevant data was found in the database.
 
        user input: {user_input}
 
        conversation_history: {conversation_history}
 
        Please respond to the user politely, letting them know that their request couldn't be fulfilled due to
 
        a lack of relevant information. Offer to assist them with something else if possible.
 
        Respond in a conversational manner as an Essilor customer service representative in 2-3 lines.
 
        User's latest input: "{user_input}"
 
        """
 
    print(webhook_context)
 
    return webhook_context
 
 
 
 