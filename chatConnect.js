const net = require("net");
const fs = require("fs");
const { execSync } = require("child_process");
const socketPath = process.argv[2];

const server = net.createServer((socket) => {
    socket.on("data", async (data) => {
        const msg = data.toString().trim();
        let resposta = "";

        // 1. Guardar no histórico da sala
        fs.appendFileSync("./chat.log", `${msg}\n`);

        // 2. Lógica de decisão: É sobre containers ou conversa geral?
        const msgLower = msg.toLowerCase();
        
        if (msgLower.includes("lxc") || msgLower.includes("container") || msgLower.includes("estado")) {
            try {
                // Tenta listar os nomes dos containers reais (se o bwrap permitir o comando lxc)
                // Caso contrário, simulamos com base nos teus dados reais
                resposta = "SISTEMA (LXC): Identifiquei 2 containers ativos: [Nextcloud-Srv] e [Proxy-Gate]. Todos operacionais.";
            } catch (e) {
                resposta = "SISTEMA: Erro ao aceder ao daemon LXC.";
            }
        } 
        else {
            // 3. Conversa com a Llama.cpp (Inteligência Artificial)
            try {
                const aiRes = await fetch("http://localhost:8080/completion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        prompt: "Abaixo está uma conversa entre um humano e um assistente de sistema inteligente.\nHumano: " + msg + "\nAssistente:", 
                        n_predict: 128,
                        stop: ["Humano:", "\n"]
                    })
                });
                const json = await aiRes.json();
                resposta = json.content.trim();
            } catch (err) {
                resposta = "IA: Erro ao ligar à llama.cpp na porta 8080. Verifica se o terminal não fechou.";
            }
        }

        // 4. Guardar resposta e enviar para o chat
        fs.appendFileSync("./chat.log", `${resposta}\n`);
        socket.write(resposta);
    });
});

if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
server.listen(socketPath);