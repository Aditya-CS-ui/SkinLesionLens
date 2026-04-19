/* ═══════════════════════════════════════════════
   LesionLens — chat.js
   GPT-powered dermatology chatbot
   ═══════════════════════════════════════════════ */

// ════════════════════════════════════════════════
//  ▼▼▼  PASTE YOUR OPENAI API KEY HERE  ▼▼▼
// ════════════════════════════════════════════════
const OPENAI_API_KEY = "";
// ════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are LesionLens AI, a helpful dermatology assistant built into the LesionLens skin lesion classification app. Created by Team Neural for Hackdiwas 3.0.

You help users understand:
- Skin conditions and lesion types (melanoma, nevi, actinic keratosis, basal cell carcinoma, benign keratosis, dermatofibroma, vascular lesions)
- The ABCDE rule for melanoma detection
- When to seek medical attention
- General dermatology questions
- How to interpret AI analysis results

Be helpful, clear, and empathetic. Always remind users you are an AI and they should consult a qualified dermatologist. Keep responses concise — 2–4 sentences. Use simple language.`;

let chatHistory = [], isBotTyping = false;

// Update API badge
document.addEventListener("DOMContentLoaded", () => {
  const badge = document.getElementById("api-status-badge");
  if (badge) {
    if (OPENAI_API_KEY && OPENAI_API_KEY.length > 10) {
      badge.textContent = "AI Ready";
      badge.className = "badge-ok";
    } else {
      badge.textContent = "API key needed";
      badge.className = "badge-warn";
    }
  }

  // Auto-welcome message
  setTimeout(() => {
    addBotMessage("Hi! I'm LesionLens AI 🧬 I can help you understand skin conditions, explain your analysis results, and answer dermatology questions. What would you like to know?");
  }, 800);

  // Enter key support
  const input = document.getElementById("chat-input");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }
});

function addBotMessage(text) {
  const msgs = document.getElementById("chat-messages");
  if (!msgs) return;
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = "msg msg-bot";
  div.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${time}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
  const msgs = document.getElementById("chat-messages");
  if (!msgs) return;
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = "msg msg-user";
  div.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${time}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById("chat-messages");
  if (!msgs) return;
  const div = document.createElement("div");
  div.className = "msg msg-bot"; div.id = "typing-indicator";
  div.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById("typing-indicator");
  if (t) t.remove();
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || isBotTyping) return;
  input.value = "";
  addUserMessage(text);
  document.getElementById("quick-prompts").style.display = "none";
  await getBotReply(text);
}

function sendQuick(el) {
  document.getElementById("chat-input").value = el.textContent;
  sendMessage();
}

async function getBotReply(userMsg) {
  isBotTyping = true;
  document.getElementById("chat-send").disabled = true;
  showTyping();

  // Build context from current scan result
  let contextMsg = userMsg;
  const result = typeof window.lastResult === "function" ? window.lastResult() : null;
  if (result) {
    const p = result.prediction;
    contextMsg = `[Analysis result: ${p.label} (${p.code}), ${p.confidence.toFixed(1)}% confidence, risk: ${p.risk}]\n\nUser: ${userMsg}`;
  }

  chatHistory.push({ role: "user", content: contextMsg });

  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 10) throw new Error("NO_KEY");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...chatHistory.slice(-8)
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "API error");
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    chatHistory.push({ role: "assistant", content: reply });
    hideTyping();
    addBotMessage(reply);

  } catch (e) {
    hideTyping();
    if (e.message === "NO_KEY") {
      addBotMessage("⚠ No API key set. Open js/chat.js and paste your OpenAI key where it says OPENAI_API_KEY.");
    } else if (e.message.includes("API key") || e.message.includes("Incorrect")) {
      addBotMessage("⚠ API key issue — please check your OpenAI key in js/chat.js and try again.");
    } else {
      addBotMessage("Sorry, I couldn't reach the AI service right now. Please check your API key.");
    }
  } finally {
    isBotTyping = false;
    document.getElementById("chat-send").disabled = false;
  }
}

// Expose globally
window.sendMessage = sendMessage;
window.sendQuick   = sendQuick;