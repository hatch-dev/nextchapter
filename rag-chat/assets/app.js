(() => {
  "use strict";

  const messagesEl = document.getElementById("messages");
  const emptyState = document.getElementById("emptyState");
  const form = document.getElementById("composer");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");

  // --- Session id: lets Flowise keep per-conversation memory across turns ---
  const SESSION_KEY = "rag_chat_session_id";
  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
           ("s-" + Date.now() + "-" + Math.random().toString(16).slice(2));
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  let busy = false;

  // --- UI helpers -----------------------------------------------------------
  function addMessage(role) {
    if (emptyState) emptyState.remove();

    const msg = document.createElement("div");
    msg.className = "msg msg--" + role;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "You" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    msg.append(avatar, bubble);
    messagesEl.appendChild(msg);
    scrollToBottom();
    return bubble;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderSources(bubble, docs) {
    if (!Array.isArray(docs) || docs.length === 0) return;
    const details = document.createElement("details");
    details.className = "sources";
    const summary = document.createElement("summary");
    summary.textContent = `Sources (${docs.length})`;
    const ol = document.createElement("ol");

    docs.forEach((d) => {
      const li = document.createElement("li");
      const meta = (d && d.metadata) || {};
      const label = meta.source || meta.fileName || meta.title || meta.pdf_numpages || "document";
      const content = (d && d.pageContent ? String(d.pageContent) : "").trim().slice(0, 180);
      li.innerHTML =
        `<strong>${escapeHtml(String(label))}</strong>` +
        (content ? ` — <span class="src-snippet">${escapeHtml(content)}…</span>` : "");
      ol.appendChild(li);
    });

    details.append(summary, ol);
    bubble.appendChild(details);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // --- SSE parsing ----------------------------------------------------------
  // Handles both Flowise formats:
  //   A)  event: token \n data: "text"
  //   B)  data: {"event":"token","data":"text"}
  function handleEventBlock(block, ctx) {
    let sseEvent = null;
    const dataLines = [];

    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        sseEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (dataLines.length === 0 && sseEvent === null) return;

    const dataStr = dataLines.join("\n");
    let parsed;
    try { parsed = JSON.parse(dataStr); } catch { parsed = undefined; }

    let type = sseEvent;
    let payload = parsed !== undefined ? parsed : dataStr;

    // Format B: the JSON object carries its own event name.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "event" in parsed) {
      type = parsed.event;
      payload = parsed.data;
    }

    switch (type) {
      case "token":
        if (payload != null) appendToken(ctx, String(payload));
        break;
      case "sourceDocuments":
        ctx.sources = payload;
        break;
      case "error":
        ctx.errored = true;
        showError(ctx, typeof payload === "string" ? payload : JSON.stringify(payload));
        break;
      case "end":
      case "abort":
        ctx.ended = true;
        break;
      // start / metadata / usedTools / agentReasoning etc. are ignored for display
    }
  }

  function appendToken(ctx, text) {
    ctx.answer += text;
    ctx.bubble.textContent = ctx.answer;
    ctx.bubble.classList.add("cursor");
    scrollToBottom();
  }

  function showError(ctx, text) {
    ctx.bubble.classList.remove("cursor");
    ctx.bubble.classList.add("is-error");
    ctx.bubble.textContent = "⚠ " + (text || "Something went wrong.");
  }

  // --- Send flow ------------------------------------------------------------
  async function send(question) {
    busy = true;
    sendBtn.disabled = true;

    addMessage("user").textContent = question;
    const bubble = addMessage("bot");
    bubble.classList.add("cursor");

    const ctx = { bubble, answer: "", sources: null, ended: false, errored: false };

    try {
      const res = await fetch("api/chat.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId: getSessionId() }),
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || ("HTTP " + res.status));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line.
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (block.trim()) handleEventBlock(block, ctx);
        }
      }
      if (buffer.trim()) handleEventBlock(buffer, ctx);

      // Fallback: chatflow wasn't streaming -> a single JSON object came back.
      if (!ctx.errored && ctx.answer === "") {
        tryNonStreamingFallback(ctx);
      }
    } catch (err) {
      showError(ctx, err && err.message);
    } finally {
      bubble.classList.remove("cursor");
      if (!ctx.errored && ctx.sources) renderSources(bubble, ctx.sources);
      if (!ctx.errored && ctx.answer === "" && !bubble.classList.contains("is-error")) {
        bubble.textContent = "(No answer returned.)";
      }
      busy = false;
      sendBtn.disabled = false;
      input.focus();
      scrollToBottom();
    }
  }

  function tryNonStreamingFallback(ctx) {
    // If Flowise returned plain JSON (streaming off), it was echoed raw into
    // the SSE channel. Recover the answer text from it.
    const raw = ctx.bubble.textContent || "";
    try {
      const obj = JSON.parse(raw);
      const text = obj.text || obj.answer || obj.output || "";
      if (text) {
        ctx.answer = String(text);
        ctx.bubble.textContent = ctx.answer;
      }
      if (obj.sourceDocuments) ctx.sources = obj.sourceDocuments;
    } catch {
      /* leave whatever was shown */
    }
  }

  // --- Events ---------------------------------------------------------------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    autoGrow();
    send(q);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", autoGrow);
  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 180) + "px";
  }

  clearBtn.addEventListener("click", () => {
    if (busy) return;
    localStorage.removeItem(SESSION_KEY);
    messagesEl.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.id = "emptyState";
    empty.innerHTML =
      "<h1>Ask your documents anything</h1>" +
      "<p>Answers are retrieved from your knowledge base and generated by Claude.</p>";
    messagesEl.appendChild(empty);
    input.focus();
  });

  input.focus();
})();
