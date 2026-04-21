const SYSTEM_PROMPT = `You are LesionLens AI, a helpful dermatology assistant built into the LesionLens skin lesion classification app. Created by Team Neural for Hackdiwas 3.0.

You help users understand:
- Skin conditions and lesion types (melanoma, nevi, actinic keratosis, basal cell carcinoma, benign keratosis, dermatofibroma, vascular lesions)
- The ABCDE rule for melanoma detection
- When to seek medical attention
- General dermatology questions
- How to interpret AI analysis results

Be helpful, clear, and empathetic. Always remind users you are an AI and they should consult a qualified dermatologist. Keep responses concise — 2–4 sentences. Use simple language.`;

let chatHistory = [], isBotTyping = false;

document.addEventListener("DOMContentLoaded", () => {
  const badge = document.getElementById("api-status-badge");
  if (badge) {
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] })
    })
      .then(r => {
        if (r.status === 500) {
          badge.textContent = "API key missing";
          badge.className = "badge-warn";
        } else {
          badge.textContent = "AI Ready";
          badge.className = "badge-ok";
        }
      })
      .catch(() => {
        badge.textContent = "Server offline";
        badge.className = "badge-warn";
      });
  }

  setTimeout(() => {
    addBotMessage("Hi! I'm LesionLens AI 🧬 I can help you understand skin conditions, explain your analysis results, and answer dermatology questions. What would you like to know?");
  }, 800);

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
  let contextMsg = userMsg;
  const result = typeof window.lastResult === "function" ? window.lastResult() : null;
  if (result) {
    const p = result.prediction;
    contextMsg = `[Analysis result: ${p.label} (${p.code}), ${p.confidence.toFixed(1)}% confidence, risk: ${p.risk}]\n\nUser: ${userMsg}`;
  }

  chatHistory.push({ role: "user", content: contextMsg });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...chatHistory.slice(-8)
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.error || "API error");
    }

    const reply = data.choices[0].message.content;
    chatHistory.push({ role: "assistant", content: reply });
    hideTyping();
    addBotMessage(reply);

  } catch (e) {
    hideTyping();
    if (e.message.includes("key not configured")) {
      addBotMessage("⚠ The server has no OpenAI API key set. Add OPENAI_API_KEY to your .env file and restart Flask.");
    } else if (e.message.includes("API key") || e.message.includes("Incorrect")) {
      addBotMessage("⚠ The OpenAI API key appears invalid. Check OPENAI_API_KEY in your .env file.");
    } else if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
      addBotMessage("⚠ Could not reach the server. Make sure Flask (app.py) is running.");
    } else {
      addBotMessage(`Sorry, something went wrong: ${e.message}`);
    }
  } finally {
    isBotTyping = false;
    document.getElementById("chat-send").disabled = false;
  }
}

window.sendMessage = sendMessage;
window.sendQuick   = sendQuick;