let ME = null;
let ROOMS = [];
let activeRoomId = null;
// --- ADICIONADO: Vari  vel para controlar o estado e evitar o piscar ---
let lastCount = 0;

// --- SISTEMA DE TEMAS (Cinzento e Fonte Inter) ---
const THEMES = ["theme-day", "theme-night", "theme-floribela"];
let themeIdx = parseInt(localStorage.getItem("selected-theme")) || 1;

function setTheme(i) {
  themeIdx = (i + THEMES.length) % THEMES.length;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(THEMES[themeIdx]);
  localStorage.setItem("selected-theme", themeIdx);
}

// --- UTILIT ^aRIOS ---
const elLog = () => document.getElementById("chatLog");
const elRoomName = () => document.getElementById("roomName");

async function api(url, opts) {
  const r = await fetch(url, opts);

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro na liga    o");
  return j;
}

// --- RENDERIZA ^g ^cO ---
function renderRooms() {
  const containerIA = document.getElementById("roomsList");
  const containerUsers = document.getElementById("usersList");
  
  if (!containerIA || !containerUsers) return;
  
  // Limpa ambos os lados antes de desenhar
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

    // LÓGICA DE SEPARAÇÃO:
    // Se o protocolo for 'p2p' ou 'direct', vai para o lado dos Utilizadores
    if (room.protocol === "p2p" || room.protocol === "direct") {
      containerUsers.appendChild(tile);
    } else {
      // Caso contrário (como os teus chats de LXC/IA), vai para o lado do Sistema
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
        lastCount = 0; // Reset ao contador
    }
    renderRooms();
  } catch (err) { alert(err.message); }
}
 
async function selectRoom(id) {
  if (activeRoomId !== id) {
    lastCount = 0; // Força o refresh do log para a nova sala
  }
  activeRoomId = id;
  const room = ROOMS.find(r => r.id === id);
  
  if (elRoomName()) {
    elRoomName().textContent = room ? room.name : "Chat";
  }
  
  // Re-renderiza para atualizar qual o ícone que aparece com a "aura" ativa
  renderRooms();
  refreshLog();
}
 
// --- FUN ^g ^cO CORRIGIDA PARA N ^cO PISCAR ---
async function refreshLog() {
  if (!activeRoomId) return;
  try {
    const j = await api(`/api/log?roomId=${activeRoomId}`);
    const log = elLog();
    if (!log || !j.lines) return;

    if (j.lines.length !== lastCount) {
      log.innerHTML = j.lines
        .filter(line => {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("SISTEMA:")) {
            console.log("%c" + cleanLine, "color: #10b981; font-weight: bold;");
            return false;
          }
          return true;
        })
        .map((line, index) => { // ADICIONADO 'index' AQUI para corrigir o erro
          const cleanLine = line.trim();

          // L ^sGICA DE EMERG ^jNCIA:
          // Se n  o h   prefixos, assume que as mensagens   mpares (0, 2, 4...) s  o tuas
          // Se os prefixos voltarem, a l  gica antiga startsWith("EU:") continua a funcionar
          const isMe = cleanLine.toUpperCase().startsWith("EU:") || (index % 2 === 0);

          const cleantext = cleanLine.replace(/^(EU:|IA:)\s*/i, "");
          return `<div class="msg ${isMe ? 'me' : ''}">${cleantext}</div>`;
        })
        .join("");

      lastCount = j.lines.length;
      log.scrollTop = log.scrollHeight;
    }
  } catch (err) { console.error("Erro log:", err); }
}
// --- INICIALIZA ^g ^cO (Boot Seguro) ---
async function boot() {
  setTheme(themeIdx);

  try {
    const data = await api("/api/me"); // Vai buscar os dados do utilizador
    ME = data.user; 

    if (ME && ME.email) {
      // 1. Coloca a primeira letra do email no círculo
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
  }

  // --- LÓGICA DO MENU CIRCULAR ---
const userCircle = document.getElementById("userCircle");
const userDropdown = document.getElementById("userDropdown");

userCircle?.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("hidden");
});

// Se clicar no chat ou no menu, o dropdown fecha
document.addEventListener("click", () => {
    userDropdown?.classList.add("hidden");
});

  // --- ATIVAÇÃO DOS BOTÕES DENTRO E FORA DO MENU ---
  document.getElementById("btnNewRoom")?.addEventListener("click", () => document.getElementById("dlgNewRoom")?.showModal());
  document.getElementById("btnTheme")?.addEventListener("click", () => setTheme(themeIdx + 1));
  
  // O ID btnSettings agora está dentro do dropdown
  document.getElementById("btnSettings")?.addEventListener("click", () => {
    document.getElementById("dlgSettings")?.showModal();
  });
 
  // BOTÃO SAIR (Dentro do dropdown)
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try {
        await fetch("/api/logout", { method: "POST" }); // Mata a sessão no servidor
        localStorage.clear(); 
        window.location.replace("/web/login.html"); // Redireciona sem deixar voltar atrás
    } catch (e) {
        window.location.replace("/web/login.html");
    }
  });

  // --- RESTANTE LÓGICA (CRIAR SALAS E MENSAGENS) ---
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
      ROOMS.push(j.room);
      document.getElementById("dlgNewRoom")?.close();
      renderRooms();
      selectRoom(j.room.id);
    } catch (e) { alert(e.message); }
  });

  document.getElementById("send")?.addEventListener("click", sendMsg);
  document.getElementById("msg")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendMsg(); }
  });

  setInterval(() => { if (activeRoomId) refreshLog(); }, 4000);
}

async function sendMsg() {
  const input = document.getElementById("msg");
  const text = input.value.trim();
 
  if (!text || !activeRoomId) return;

  try {
    input.value = ""; // Limpa logo para dar sensa    o de velocidade
   
    await api("/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: activeRoomId,
        text: text
      })
    });
   
    refreshLog(); // Tenta atualizar logo a seguir ao envio
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
  }
}

let selectedUserId = null;

// Lógica de Pesquisa Dinâmica
document.getElementById("usSearch")?.addEventListener("input", async (e) => {
    const q = e.target.value.trim();
    const resDiv = document.getElementById("usResults");
    
    // we only need to bail out when the query is empty – one character is fine now
    if (q.length < 1) {
        resDiv.classList.add("hidden");
        return;
    }

    const data = await api(`/api/users/search?q=${q}`);
    resDiv.innerHTML = "";
    
    // show results even if there is only a single match
    if (data.users.length > 0) {
        resDiv.classList.remove("hidden");
        data.users.forEach(u => {
            const item = document.createElement("div");
            item.className = "search-item";
            item.textContent = u.email;
            item.onclick = () => {
            inputSearch.value = u.email;
            inputSearch.dataset.selectedId = u.id; // ESTA LINHA É VITAL
            resResults.style.display = "none";
            };
            resDiv.appendChild(item);
        });
    }
});

// --- ROTA DE MENSAGEM COM CORREÇÃO DE LOOP ---
const usSearch = document.getElementById("usSearch");
const usResults = document.getElementById("usResults");

usSearch?.addEventListener("input", async () => {
    const q = usSearch.value.trim();
    
    // allow single‑character lookups; hide only when empty
    if (q.length < 1) {
        usResults.classList.add("hidden");
        return;
    }

    try {
        const data = await api(`/api/users/search?q=${q}`); // Chama a rota que criámos acima
        usResults.innerHTML = "";

        if (data.users && data.users.length > 0) {
            usResults.classList.remove("hidden");
            data.users.forEach(u => {
                const item = document.createElement("div");
                item.className = "search-item";
                item.textContent = u.email;
                item.onclick = () => {
                    usSearch.value = u.email;
                    usSearch.dataset.selectedId = u.id; // Guarda o ID para o envio
                    usResults.classList.add("hidden");
                };
                usResults.appendChild(item);
            });
        } else {
            usResults.classList.add("hidden");
        }
    } catch (err) {
        console.error("Erro ao procurar:", err);
    }
});

// Gestão da pesquisa de utilizadores
document.addEventListener('input', async (e) => {
    if (e.target.id === "usSearch") {
        const q = e.target.value.trim();
        const resDiv = document.getElementById("usResults");
        
        // show results even for a one‑letter query; only suppress when there is no input
        if (q.length < 1) {
            resDiv.style.display = "none";
            return;
        }

        try {
            const data = await api(`/api/users/search?q=${q}`);
            resDiv.innerHTML = "";
            
            if (data.users && data.users.length > 0) {
                resDiv.style.display = "block";
                data.users.forEach(u => {
                    const item = document.createElement("div");
                    item.className = "search-item";
                    item.textContent = u.email;
                    item.onclick = () => {
                        document.getElementById("usSearch").value = u.email;
                        // Guardamos o ID num atributo do input para usar ao enviar
                        selectedUserId = u.id;
                        document.getElementById("usSearch").dataset.selectedId = u.id;
                        resDiv.style.display = "none";
                    };
                    resDiv.appendChild(item);
                });
            } else {
                resDiv.style.display = "none";
            }
        } catch (err) {
            console.error("Erro na pesquisa:", err);
        }
    }
});

// Botão "Enviar e Abrir Chat" (Lado Direito)
document.getElementById("usSend")?.addEventListener("click", async () => {
    const inputSearch = document.getElementById("usSearch");
    const inputMsg = document.getElementById("usMsg");
    
    const email = inputSearch.value.trim();
    const msg = inputMsg.value.trim();
    
    // Vamos buscar o ID que guardámos no elemento quando clicaste na lista
    const userId = inputSearch.dataset.selectedId;

    // Validação mais rigorosa
    if (!userId || !msg) {
        return alert("Erro: Precisas de selecionar um utilizador da lista e escrever uma mensagem!");
    }

    try {
        // 1. Criar a sala P2P (usando o nome do utilizador)
        const roomName = email.split('@')[0];
        const j = await api("/api/rooms", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ name: roomName, protocol: "p2p" })
        });

        if (!j || !j.room) throw new Error("Erro ao criar a sala no servidor.");

        // 2. Enviar a primeira mensagem para essa sala
        await api("/api/message", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ roomId: j.room.id, text: msg })
        });

        // 3. Atualizar a lista global de salas e a UI
        // Verificamos se a sala já não existe na lista para não duplicar ícones
        if (!ROOMS.find(r => r.id === j.room.id)) {
            ROOMS.push(j.room);
        }
        
        renderRooms();
        selectRoom(j.room.id);
        
        // Fechar a modal e limpar tudo
        document.getElementById("dlgNewRoom").close();
        inputSearch.value = "";
        inputMsg.value = "";
        delete inputSearch.dataset.selectedId; // Limpa o ID guardado
        
    } catch (e) { 
        console.error(e);
        alert("Erro ao enviar: " + e.message); 
    }
});

boot();
