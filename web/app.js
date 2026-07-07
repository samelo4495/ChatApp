let ME = null;
let ROOMS = [];
let activeRoomId = null;
// Controla o estado do log para evitar o piscar
let lastCount = 0;

// --- SISTEMA DE TEMAS ---
const THEMES = ["theme-day", "theme-night", "theme-floribela"];
let themeIdx = parseInt(localStorage.getItem("selected-theme"), 10);
if (isNaN(themeIdx)) themeIdx = 1;

function setTheme(i) {
  themeIdx = (i + THEMES.length) % THEMES.length;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(THEMES[themeIdx]);
  localStorage.setItem("selected-theme", themeIdx);
}

// --- UTILITÁRIOS ---
const elLog = () => document.getElementById("chatLog");
const elRoomName = () => document.getElementById("roomName");

async function api(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    // Sessão expirada ou inexistente: volta ao login
    window.location.replace("/web/login.html");
    throw new Error("Não autorizado");
  }
  if (!r.ok) throw new Error(j.error || "Erro na ligação");
  return j;
}

// --- RENDERIZAÇÃO ---
function renderRooms() {
  const containerIA = document.getElementById("roomsList");
  const containerUsers = document.getElementById("usersList");

  if (!containerIA || !containerUsers) return;

  containerIA.innerHTML = "";
  containerUsers.innerHTML = "";

  ROOMS.forEach(room => {
    const isActive = activeRoomId === room.id;
    const tile = document.createElement("div");
    tile.className = `room-tile ${isActive ? 'active' : ''}`;

    tile.innerHTML = `
      <button class="btn-delete-room" onclick="handleDeleteRoom(event, '${room.id}')">&times;</button>
      <div class="icon ${isActive ? 'active' : ''}" onclick="selectRoom('${room.id}')">
        ${room.name[0].toUpperCase()}
      </div>
      <div class="label">${room.name}</div>
    `;

    // Conversas p2p/direct vão para a coluna Utilizadores; o resto (IA) para Chats
    if (room.protocol === "p2p" || room.protocol === "direct") {
      containerUsers.appendChild(tile);
    } else {
      containerIA.appendChild(tile);
    }
  });
}

async function handleDeleteRoom(event, roomId) {
  event.stopPropagation();
  if (!confirm("Tens a certeza que queres eliminar esta sala?")) return;
  try {
    await api(`/api/rooms/${roomId}`, { method: 'DELETE' });
    ROOMS = ROOMS.filter(r => r.id !== roomId);
    if (activeRoomId === roomId) {
        activeRoomId = null;
        lastCount = 0;
        const log = elLog();
        if (log) log.innerHTML = "";
    }
    renderRooms();
  } catch (err) { alert(err.message); }
}

async function selectRoom(id) {
  if (activeRoomId !== id) {
    lastCount = 0; // Força o refresh do log para a nova sala
    const log = elLog();
    if (log) log.innerHTML = "";
  }

  activeRoomId = id;
  const room = ROOMS.find(r => r.id === id);

  if (elRoomName()) {
    elRoomName().textContent = room ? room.name : "Chat";
  }

  renderRooms();
  refreshLog();
}

async function refreshLog() {
  if (!activeRoomId) return;
  try {
    const j = await api(`/api/log?roomId=${activeRoomId}`);
    const log = elLog();

    if (j.lines && j.lines.length !== lastCount) {
      log.innerHTML = "";

      j.lines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine.startsWith("SISTEMA:")) return;

        // Procura a posição do primeiro ":"
        const separatorIdx = cleanLine.indexOf(":");
        if (separatorIdx === -1) return; // Linha inválida, ignora

        const senderPart = cleanLine.substring(0, separatorIdx).trim();
        const messagePart = cleanLine.substring(separatorIdx + 1).trim();

        // É minha se o prefixo for o meu email OU "EU"
        const isMe = (ME && senderPart === ME.email) || (senderPart === "EU");

        const div = document.createElement("div");
        div.className = `msg ${isMe ? 'me' : 'ai'}`;
        div.innerText = messagePart;
        log.appendChild(div);
      });

      lastCount = j.lines.length;
      log.scrollTop = log.scrollHeight;
    }
  } catch (err) { console.error("Erro ao carregar log:", err); }
}

function renderSingleMessage(text, isMe) {
    const log = elLog();
    if (!log) return;

    const div = document.createElement("div");
    div.className = `msg ${isMe ? 'me' : 'ai'}`;
    div.innerText = text;

    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

async function sendMsg() {
    const input = document.getElementById("msg");
    const text = input.value.trim();

    if (!text || !activeRoomId) return;

    input.value = "";

    // Desenha logo no ecrã (instantâneo)
    renderSingleMessage(text, true);

    try {
        const response = await api('/api/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: activeRoomId, text: text })
        });

        if (response.reply) {
            renderSingleMessage(response.reply, false);
        }

        // Força o próximo refreshLog a redesenhar tudo sincronizado
        lastCount = 0;
        await refreshLog();

    } catch (error) {
        console.error("Erro ao enviar:", error);
        renderSingleMessage("ERRO: Mensagem não enviada.", false);
    }
}

// --- PESQUISA DE UTILIZADORES (modal Nova Conversa) ---
function setupUserSearch() {
  const usSearch = document.getElementById("usSearch");
  const usResults = document.getElementById("usResults");
  if (!usSearch || !usResults) return;

  usSearch.addEventListener("input", async () => {
    const q = usSearch.value.trim();
    delete usSearch.dataset.selectedId; // O texto mudou, a seleção anterior deixa de valer

    if (q.length < 1) {
      usResults.style.display = "none";
      return;
    }

    try {
      const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
      usResults.innerHTML = "";

      if (data.users && data.users.length > 0) {
        usResults.style.display = "block";
        data.users.forEach(u => {
          const item = document.createElement("div");
          item.className = "search-item";
          item.textContent = u.email;
          item.onclick = () => {
            usSearch.value = u.email;
            usSearch.dataset.selectedId = u.id; // Guarda o ID para o envio
            usResults.style.display = "none";
          };
          usResults.appendChild(item);
        });
      } else {
        usResults.style.display = "none";
      }
    } catch (err) {
      console.error("Erro ao procurar:", err);
    }
  });
}

// --- INICIALIZAÇÃO ---
async function boot() {
  setTheme(themeIdx);

  try {
    const data = await api("/api/me");
    ME = data.user;

    if (ME && ME.email) {
      const userCircle = document.getElementById("userCircle");
      if (userCircle) userCircle.textContent = ME.email[0].toUpperCase();
    }

    const res = await api("/api/rooms");
    ROOMS = res.rooms;
    renderRooms();

    if (ROOMS.length > 0 && !activeRoomId) {
      selectRoom(ROOMS[0].id);
    }
  } catch (err) {
    console.error("Erro ao iniciar:", err);
    return; // api() já redirecionou para o login se for 401
  }

  // --- MENU CIRCULAR (avatar) ---
  const userCircle = document.getElementById("userCircle");
  const userDropdown = document.getElementById("userDropdown");

  userCircle?.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
      userDropdown?.classList.add("hidden");
  });

  // --- BOTÕES ---
  document.getElementById("btnNewRoom")?.addEventListener("click", () => document.getElementById("dlgNewRoom")?.showModal());

  document.getElementById("btnSettings")?.addEventListener("click", () => {
    document.getElementById("dlgSettings")?.showModal();
  });

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try {
        await fetch("/api/logout", { method: "POST" });
        localStorage.clear();
        window.location.replace("/web/login.html");
    } catch (e) {
        window.location.replace("/web/login.html");
    }
  });

  // Alterar password (modal Configurações)
  document.getElementById("btnChangePass")?.addEventListener("click", async () => {
    const oldPass = document.getElementById("oldPass")?.value;
    const newPass = document.getElementById("newPass")?.value;
    const msg = document.getElementById("passMsg");
    if (msg) msg.textContent = "";

    if (!oldPass || !newPass) {
      if (msg) msg.textContent = "Preenche os dois campos.";
      return;
    }

    try {
      await api("/api/password", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ oldPass, newPass })
      });
      document.getElementById("oldPass").value = "";
      document.getElementById("newPass").value = "";
      document.getElementById("dlgSettings")?.close();
      alert("Password alterada com sucesso!");
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });

  // Criar sala de IA (lado esquerdo do modal)
  document.getElementById("nrCreate")?.addEventListener("click", async () => {
    const name = document.getElementById("nrName")?.value.trim();
    const protocol = document.getElementById("nrProto")?.value.trim();
    if (!name || !protocol) return alert("Preenche os campos!");
    try {
      const j = await api("/api/rooms", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name, protocol })
      });

      ROOMS.push(j);
      document.getElementById("dlgNewRoom")?.close();
      renderRooms();
      selectRoom(j.id);
    } catch (e) { alert(e.message); }
  });

  // Enviar e abrir conversa p2p (lado direito do modal)
  document.getElementById("usSend")?.addEventListener("click", async () => {
    const inputSearch = document.getElementById("usSearch");
    const inputMsg = document.getElementById("usMsg");

    const email = inputSearch.value.trim();
    const msg = inputMsg.value.trim();
    const userId = inputSearch.dataset.selectedId;

    if (!userId || !msg) {
        return alert("Erro: Precisas de selecionar um utilizador da lista e escrever uma mensagem!");
    }

    try {
        const roomName = email.split('@')[0];
        const j = await api("/api/rooms", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                name: roomName,
                protocol: "p2p",
                targetId: userId
            })
        });

        if (!j || !j.id) throw new Error("Erro ao criar a sala no servidor.");

        await api("/api/message", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ roomId: j.id, text: msg })
        });

        if (!ROOMS.find(r => r.id === j.id)) {
            ROOMS.push(j);
        }

        renderRooms();
        selectRoom(j.id);

        document.getElementById("dlgNewRoom").close();
        inputSearch.value = "";
        inputMsg.value = "";
        delete inputSearch.dataset.selectedId;

    } catch (e) {
        console.error(e);
        alert("Erro ao enviar: " + e.message);
    }
  });

  setupUserSearch();

  document.getElementById("send")?.addEventListener("click", sendMsg);
  document.getElementById("msg")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendMsg(); }
  });

  setInterval(() => { if (activeRoomId) refreshLog(); }, 1500);
}

boot();
