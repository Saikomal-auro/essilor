@app.post("/chat/{session_id}/{conversation_id}")
async def chat(session_id: str, conversation_id: str, user_input: str = Body(..., embed=True)):
    """Process user input, generate a response, and store the conversation in Firestore."""
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
            conversation_history = []  # Ensure it is always a lis

        # 🔹 Append user message
        user_message = {"user": user_input, "timestamp": datetime.utcnow().isoformat()}
        conversation_history.append(user_message)

        # 🔹 Generate AI response
        full_prompt = system_prompt + "\n\nConversation so far:\n" + "\n".join(
            [f"User: {m['user']}" if 'user' in m else f"Assistant: {m['bot']}" for m in conversation_history]
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

        # 🔹 Append bot response
        bot_message = {"bot": chatbot_response, "timestamp": datetime.utcnow().isoformat()}
        conversation_history.append(bot_message)

        # 🔹 Update Firestore with new messages
        try:
            conversation_ref.update({"messages": firestore.ArrayUnion([bot_message])})
            logger.info(f"✅ Firestore: Updated conversation {conversation_id} with new message.")
        except Exception as firestore_error:
            logger.error(f"❌ Firestore write failed: {firestore_error}")


        response_payload = {"response": chatbot_response}
        if should_trigger_webhook and webhook_info:
            response_payload["webhook_info"] = webhook_info

        return response_payload

    except Exception as e:
        logger.exception("🚨 Error processing chat request.")
        raise HTTPException(status_code=500, detail=str(e))
