const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({ origin: '*' }));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

const BANCO = path.join(__dirname, 'banco_vereadores.json');

// Estrutura padrão com suporte a metadados, configurações globais e livro de atas
function carregarBanco() {
    if (!fs.existsSync(BANCO)) {
        fs.writeFileSync(
            BANCO,
            JSON.stringify({ logoSistemaComum: "", vereadores: [], atasSalvas: [] }, null, 4)
        );
    }
    try {
        const dados = JSON.parse(fs.readFileSync(BANCO, 'utf8'));
        // Garante compatibilidade caso o arquivo venha no formato antigo de array puro
        if (Array.isArray(dados)) {
            return { logoSistemaComum: "", vereadores: dados, atasSalvas: [] };
        }
        if (!dados.vereadores) dados.vereadores = [];
        if (!dados.logoSistemaComum) dados.logoSistemaComum = "";
        if (!dados.atasSalvas) dados.atasSalvas = [];
        return dados;
    } catch {
        return { logoSistemaComum: "", vereadores: [], atasSalvas: [] };
    }
}

function salvarBanco() {
    fs.writeFileSync(
        BANCO,
        JSON.stringify(bancoDadosGlobal, null, 4)
    );
}

// Inicialização unificada do banco e referências auxiliares
let bancoDadosGlobal = carregarBanco();
let bancoVereadores = bancoDadosGlobal.vereadores;
let atasSalvasLivro = bancoDadosGlobal.atasSalvas;

let sessaoAtiva = false;
let materiaAtual = {
    codigo: '',
    ementa: ''
};
let microfoneAutorizadoId = null;
let filaOradores = [];

// Estado Global do Cronômetro em Memória
let cronometroEstado = {
    tempoRestante: 300,
    tipoTempo: "Grande Expediente",
    oradorNome: "Nenhum orador na tribuna",
    intervalId: null
};

function gerarUsuario(nome) {
    return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .replace(/\s+/g, "");
}

function existeUsuario(usuario) {
    return bancoVereadores.find(v => v.username === usuario);
}

function gerarUsuarioUnico(nome) {
    let base = gerarUsuario(nome);
    let usuario = base;
    let contador = 1;
    while (existeUsuario(usuario)) {
        usuario = base + contador;
        contador++;
    }
    return usuario;
}

function emitirAtualizacao() {
    bancoDadosGlobal.vereadores = bancoVereadores; // Garante consistência do nó de parlamentares
    bancoDadosGlobal.atasSalvas = atasSalvasLivro; // Garante consistência do nó de atas
    salvarBanco();
    
    // Calcular totais de votos
    let sim = 0, nao = 0, abst = 0;
    bancoVereadores.forEach(v => {
        if (v.status === 'Presente') {
            if (v.voto === 'SIM') sim++;
            if (v.voto === 'NÃO') nao++;
            if (v.voto === 'ABSTENÇÃO') abst++;
        }
    });

    // Emite o payload de dados completo incluindo a logo ativa vinda do arquivo de banco
    io.emit("atualizarPainel", {
        vereadores: bancoVereadores,
        sessaoAtiva,
        materiaAtiva: materiaAtual,
        materiaAtual,
        filaOradores,
        microfoneAutorizadoId,
        logoSistemaComum: bancoDadosGlobal.logoSistemaComum,
        totaisVotos: { sim, nao, abstencao: abst }
    });
    // Força o gatilho de re-puxada de dados imediata nos fronts
    io.emit("atualizarPainelSemPayload");
}

function buscarPresidente() {
    return bancoVereadores.find(v => v.cargo === "PRESIDENTE");
}

function removerPresidenteAnterior(idAtual) {
    bancoVereadores.forEach(v => {
        if (
            v.cargo === "PRESIDENTE"
            &&
            v.id !== idAtual
        ) {
            v.cargo = "VEREADOR";
        }
    });
}

// ======================================================
// CONFIGURAÇÕES GLOBAIS DO SISTEMA (PERSISTIDO EM BANCO)
// ======================================================

// Rota para o Admin gravar a logo no banco de dados JSON
app.post('/api/configuracoes/logo', (req, res) => {
    const { logoBase64 } = req.body;
    if (!logoBase64) {
        return res.status(400).json({ error: "Nenhum dado de imagem fornecido." });
    }
    
    try {
        bancoDadosGlobal.logoSistemaComum = logoBase64;
        emitirAtualizacao();
        
        return res.json({ success: true, message: "Logo salva e consolidada no banco de dados com sucesso!" });
    } catch (error) {
        return res.status(500).json({ error: "Falha na gravação do banco de dados: " + error.message });
    }
});

// Rota pública consumida pelas telas de Login, Presidente, Vereador e Telão
app.get('/api/configuracoes/logo', (req, res) => {
    res.json({ logo: bancoDadosGlobal.logoSistemaComum || "" });
});

// ======================================================
// LIVRO DE ATAS E DOCUMENTOS DA SESSÃO (SALVOS NO SERVIDOR)
// ======================================================

// Rota para o Presidente salvar a ata redigida no servidor
app.post('/api/atas/salvar', (req, res) => {
    const { textoAta, identificador } = req.body;
    if (!textoAta) {
        return res.status(400).json({ error: "Conteúdo da ata vazio." });
    }

    try {
        const novaAta = {
            id: Date.now().toString(),
            dataRegistro: new Date().toLocaleDateString('pt-BR'),
            horaRegistro: new Date().toLocaleTimeString('pt-BR'),
            identificador: identificador || `SESSÃO_${new Date().toISOString().split('T')[0]}`,
            texto: textoAta
        };

        atasSalvasLivro.unshift(novaAta); // Adiciona no início da fila
        emitirAtualizacao(); // Salva no arquivo físico e atualiza metadados

        return res.json({ success: true, message: "Ata consolidada e arquivada com sucesso no servidor!", ata: novaAta });
    } catch (error) {
        return res.status(500).json({ error: "Falha ao gravar ata no servidor: " + error.message });
    }
});

// Rota para buscar todas as atas salvas no servidor
app.get('/api/atas', (req, res) => {
    res.json(atasSalvasLivro);
});

// ======================================================
// LOGIN
// ======================================================
app.post('/api/auth/login', (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
        return res.status(400).json({
            error: "Informe usuário e senha."
        });
    }

    const user = usuario.trim().toLowerCase();

    // SUPER ADMIN
    if (user === "admin" && senha === "123456") {
        return res.json({
            id: "admin",
            nome: "Super Admin",
            cargo: "SUPERADMIN"
        });
    }

    // PROCURA QUALQUER USUÁRIO CADASTRADO
    const parlamentar = bancoVereadores.find(v =>
        v.username.toLowerCase() === user &&
        v.senha === senha
    );

    if (!parlamentar) {
        return res.status(401).json({
            error: "Usuário ou senha inválidos."
        });
    }

    return res.json({
        id: parlamentar.id,
        cargo: parlamentar.cargo,
        username: parlamentar.username,
        nome: parlamentar.nomeEleitoral || parlamentar.nomeCompleto,
        nomeCompleto: parlamentar.nomeCompleto,
        nomeEleitoral: parlamentar.nomeEleitoral,
        partido: parlamentar.partido,
        sigla: parlamentar.sigla,
        foto: parlamentar.foto
    });
});

// ======================================================
// LISTAR PARLAMENTARES
// ======================================================
app.get('/api/vereadores', (req, res) => {
    res.json(bancoVereadores);
});

// ======================================================
// CADASTRAR PARLAMENTAR (CORRIGIDO SEM CONFLITO DE ESCRITA)
// ======================================================
app.post('/api/vereadores/cadastrar', (req, res) => {
    try {
        console.log("Recebendo dados de cadastro:", req.body);
        
        const { 
            cargo, 
            nomeCompleto, 
            nomeEleitoral, 
            dataNascimento, 
            cpf, 
            nomeMae, 
            partido, 
            sigla, 
            username, 
            password, 
            fotoBase64 
        } = req.body;

        if (!nomeCompleto || !cpf || !nomeMae || !dataNascimento) {
            return res.status(400).json({ error: "Campos obrigatórios (Nome, CPF, Nome da Mãe, Data Nasc.) não preenchidos." });
        }

        const cpfLimpo = String(cpf).replace(/\D/g, '');

        if (bancoVereadores.find(v => v.cpf.replace(/\D/g, '') === cpfLimpo)) {
            return res.status(400).json({ error: "Este CPF já está cadastrado." });
        }

        let usernameFinal = "";
        if (username && username.trim() !== "") {
            const userValidado = username.trim().toLowerCase();
            if (existeUsuario(userValidado)) {
                return res.status(400).json({ error: "Este nome de usuário já está em uso." });
            }
            usernameFinal = userValidado;
        } else {
            usernameFinal = gerarUsuarioUnico(nomeEleitoral || nomeCompleto);
        }

        let senhaFinal = "123456";
        if (password && password.trim() !== "") {
            senhaFinal = password.trim();
        }

        const cargoFinal = cargo === "PRESIDENTE" ? "PRESIDENTE" : "VEREADOR";

        const novo = {
            id: Date.now().toString(),
            cargo: cargoFinal,
            nomeCompleto: nomeCompleto.trim(),
            nomeEleitoral: (nomeEleitoral || nomeCompleto).trim(),
            dataNascimento,
            cpf: cpfLimpo,
            nomeMae,
            partido,
            sigla: (sigla || "").toUpperCase(),
            username: usernameFinal,
            senha: senhaFinal,
            foto: fotoBase64 || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250",
            status: "Ausente",
            voto: "Pendente"
        };

        if (cargoFinal === "PRESIDENTE") {
            removerPresidenteAnterior(novo.id);
        }

        bancoVereadores.push(novo);
        
        // CORREÇÃO: Usando a função unificada emitirAtualizacao(), garantimos que o array local 
        // seja jogado para dentro do objeto estruturado global antes de descarregar os dados no arquivo .json
        emitirAtualizacao();
        
        res.status(201).json({ sucesso: true, parlamentar: novo });

    } catch (error) {
        console.error("Erro crítico no servidor ao cadastrar:", error);
        res.status(500).json({ error: "Erro interno ao salvar arquivo: " + error.message });
    }
});

// ======================================================
// ALTERAR SENHA
// ======================================================
app.post('/api/vereadores/alterar-senha', (req, res) => {
    const { id, novaSenha } = req.body;

    if (!novaSenha || novaSenha.trim() === "") {
        return res.status(400).json({
            error: "Senha inválida."
        });
    }

    const vereador = bancoVereadores.find(v => v.id === String(id));

    if (!vereador) {
        return res.status(404).json({
            error: "Parlamentar não encontrado."
        });
    }

    vereador.senha = novaSenha.trim();
    emitirAtualizacao();

    res.json({ success: true });
});

// ======================================================
// CONTROLE DA SESSÃO E ORDEM DO DIA
// ======================================================
app.post('/api/sessao/controle', (req, res) => {
    const { acao, codigo, ementa } = req.body;

    if (acao === "abrir") {
        sessaoAtiva = true;
        bancoVereadores.forEach(v => {
            v.status = "Ausente";
            v.voto = "Pendente";
            v.pedidoFala = false;
        });
        io.emit("notificacaoSessaoIniciada", { tipo: "abrir" });
    } else if (acao === "iniciar") {
        sessaoAtiva = true;
        materiaAtual = {
            codigo: codigo || "",
            ementa: ementa || ""
        };
        bancoVereadores.forEach(v => {
            v.voto = "Pendente";
        });
        io.emit("notificacaoSessaoIniciada", { tipo: "iniciar", codigo: materiaAtual.codigo, ementa: materiaAtual.ementa });
    } else if (acao === "limparMateria") {
        materiaAtual = { codigo: '', ementa: '' };
        bancoVereadores.forEach(v => { v.voto = "Pendente"; });
    } else if (acao === "fechar") {
        sessaoAtiva = false;
        materiaAtual = { codigo: '', ementa: '' };
        microfoneAutorizadoId = null;
        filaOradores = [];
        bancoVereadores.forEach(v => {
            v.status = "Ausente";
            v.voto = "Pendente";
            v.pedidoFala = false;
        });
        
        if (cronometroEstado.intervalId) {
            clearInterval(cronometroEstado.intervalId);
            cronometroEstado.intervalId = null;
        }
        cronometroEstado.oradorNome = "Nenhum orador na tribuna";
        cronometroEstado.tempoRestante = 300;
        io.emit("notificacaoSessaoIniciada", { tipo: "fechar" });
    }

    emitirAtualizacao();
    res.json({ success: true });
});

// ======================================================
// ALTERNAR PRESENÇA
// ======================================================
app.post('/api/sessao/presenca', (req, res) => {
    const { vereadorId } = req.body;
    const vereador = bancoVereadores.find(
        v => v.id === String(vereadorId)
    );

    if (!vereador) {
        return res.status(404).json({
            error: "Parlamentar não encontrado."
        });
    }

    if (vereador.status === "Presente") {
        vereador.status = "Ausente";
        vereador.voto = "Pendente";
        vereador.pedidoFala = false;
        if (String(microfoneAutorizadoId) === String(vereadorId)) {
            microfoneAutorizadoId = null;
        }
        filaOradores = filaOradores.filter(id => String(id) !== String(vereadorId));
        io.emit("notificacaoVereadorEntrou", {
            nome: vereador.nomeEleitoral || vereador.nomeCompleto,
            status: "Ausente"
        });
    } else {
        vereador.status = "Presente";
        io.emit("notificacaoVereadorEntrou", {
            nome: vereador.nomeEleitoral || vereador.nomeCompleto,
            status: "Presente"
        });
    }

    emitirAtualizacao();
    res.json({ success: true, statusAtual: vereador.status });
});

// ======================================================
// OUTRAS ROTAS MANUTENÇÃO DE USUÁRIOS
// ======================================================
app.put('/api/vereadores/alterar-usuario', (req, res) => {
    const { id, username } = req.body;
    if (!username || username.trim() === "") return res.status(400).json({ error: "Usuário inválido." });
    const novoUsuario = username.trim().toLowerCase();
    if (bancoVereadores.find(v => v.username === novoUsuario && v.id !== String(id))) {
        return res.status(400).json({ error: "Usuário já existe." });
    }
    const vereador = bancoVereadores.find(v => v.id === String(id));
    if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });
    vereador.username = novoUsuario;
    emitirAtualizacao();
    res.json({ success: true });
});

app.put('/api/vereadores/alterar-cargo', (req, res) => {
    const { id, cargo } = req.body;
    if (cargo !== "PRESIDENTE" && cargo !== "VEREADOR") return res.status(400).json({ error: "Cargo inválido." });
    const vereador = bancoVereadores.find(v => v.id === String(id));
    if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });
    if (cargo === "PRESIDENTE") removerPresidenteAnterior(id);
    vereador.cargo = cargo;
    emitirAtualizacao();
    res.json({ success: true });
});

app.delete('/api/vereadores/:id', (req, res) => {
    const id = String(req.params.id);
    const indice = bancoVereadores.findIndex(v => v.id === id);
    if (indice === -1) return res.status(404).json({ error: "Parlamentar não encontrado." });
    bancoVereadores.splice(indice, 1);
    emitirAtualizacao();
    res.json({ success: true });
});

app.get('/api/sessao/status', (req, res) => {
    let sim = 0, nao = 0, abst = 0;
    bancoVereadores.forEach(v => {
        if (v.status === 'Presente') {
            if (v.voto === 'SIM') sim++;
            if (v.voto === 'NÃO') nao++;
            if (v.voto === 'ABSTENÇÃO') abst++;
        }
    });
    res.json({
        sessaoAtiva,
        materiaAtiva: materiaAtual,
        materiaAtual,
        microfoneAutorizadoId,
        filaOradores,
        vereadores: bancoVereadores,
        logoSistemaComum: bancoDadosGlobal.logoSistemaComum,
        totaisVotos: { sim, nao, abstencao: abst }
    });
});

app.post('/api/vereadores/votar', (req, res) => {
    const { vereadorId, voto } = req.body;
    const vereador = bancoVereadores.find(v => v.id === String(vereadorId));
    if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });
    if (vereador.status !== "Presente") return res.status(400).json({ error: "Vereador precisa de estar com presença confirmada para votar." });
    
    vereador.voto = voto;
    emitirAtualizacao();
    res.json({ success: true });
});

app.post('/api/microfone/pedir', (req, res) => {
    const { vereadorId } = req.body;
    const vereador = bancoVereadores.find(v => v.id === String(vereadorId));
    if (vereador && vereador.status === "Presente") {
        vereador.pedidoFala = true;
        if (!filaOradores.includes(vereadorId)) {
            filaOradores.push(vereadorId);
        }
        emitirAtualizacao();
    }
    res.json({ success: true });
});

app.post('/api/microfone/autorizar', (req, res) => {
    const { vereadorId } = req.body;
    microfoneAutorizadoId = vereadorId;
    filaOradores = filaOradores.filter(id => id !== vereadorId);
    
    bancoVereadores.forEach(v => {
        if (String(v.id) === String(vereadorId)) {
            v.pedidoFala = false;
        }
    });

    emitirAtualizacao();
    res.json({ success: true });
});

// ======================================================
// SOCKET.IO (GERENCIAMENTO REAL-TIME DO PLENÁRIO)
// ======================================================
io.on("connection", socket => {
    console.log("Cliente conectado:", socket.id);

    let sim = 0, nao = 0, abst = 0;
    bancoVereadores.forEach(v => {
        if (v.status === 'Presente') {
            if (v.voto === 'SIM') sim++;
            if (v.voto === 'NÃO') nao++;
            if (v.voto === 'ABSTENÇÃO') abst++;
        }
    });

    socket.emit("atualizarPainel", {
        vereadores: bancoVereadores,
        sessaoAtiva,
        materiaAtiva: materiaAtual,
        materiaAtual,
        filaOradores,
        microfoneAutorizadoId,
        logoSistemaComum: bancoDadosGlobal.logoSistemaComum,
        totaisVotos: { sim, nao, abstencao: abst }
    });

    socket.on("registrarConexao", (dados) => {
        socket.userId = dados.userId;
        socket.nome = dados.nome;
        socket.cargo = dados.cargo;
        console.log(`Cliente registrado: ${dados.nome} (${dados.cargo})`);
        
        if (dados.cargo === "VEREADOR") {
            io.emit("notificacaoVereadorConectado", {
                nome: dados.nome,
                status: "online"
            });
        }
    });

    socket.on("enviarAudioStream", dados => {
        socket.broadcast.emit("receberAudioStream", dados);
    });
    socket.on("transmitirAudioStream", dados => {
        socket.broadcast.emit("receberAudioStream", dados);
    });

    socket.on("atualizarPainel", () => {
        emitirAtualizacao();
    });

    socket.on("comandoCronometro", (data) => {
        if (data.acao === "definir") {
            cronometroEstado.tempoRestante = data.segundos;
            if (data.tipo) cronometroEstado.tipoTempo = data.tipo;
        } else if (data.acao === "vincularOrador") {
            cronometroEstado.oradorNome = data.oradorNome;
        } else if (data.acao === "iniciar") {
            if (!cronometroEstado.intervalId) {
                cronometroEstado.intervalId = setInterval(() => {
                    if (cronometroEstado.tempoRestante > 0) {
                        cronometroEstado.tempoRestante--;
                        io.emit("cronometroTick", {
                            tempoRestante: cronometroEstado.tempoRestante,
                            tipoTempo: cronometroEstado.tipoTempo,
                            oradorNome: cronometroEstado.oradorNome
                        });
                    } else {
                        clearInterval(cronometroEstado.intervalId);
                        cronometroEstado.intervalId = null;
                    }
                }, 1000);
            }
        } else if (data.acao === "pausar") {
            if (cronometroEstado.intervalId) {
                clearInterval(cronometroEstado.intervalId);
                cronometroEstado.intervalId = null;
            }
        } else if (data.acao === "resetar") {
            if (cronometroEstado.intervalId) {
                clearInterval(cronometroEstado.intervalId);
                cronometroEstado.intervalId = null;
            }
            cronometroEstado.tempoRestante = 300;
        }

        io.emit("cronometroTick", {
            tempoRestante: cronometroEstado.tempoRestante,
            tipoTempo: cronometroEstado.tipoTempo,
            oradorNome: cronometroEstado.oradorNome
        });
    });

    socket.on("disconnect", () => {
        console.log("Cliente desconectado:", socket.id);
        if (socket.cargo === "VEREADOR" && socket.nome) {
            io.emit("notificacaoVereadorConectado", {
                nome: socket.nome,
                status: "offline"
            });
        }
    });
});

// ======================================================
// INICIAR SERVIDOR
// ======================================================
server.listen(PORT, () => {
    console.clear();
    console.log("==========================================");
    console.log(" SISCAM 1.0");
    console.log(" Servidor iniciado com sucesso");
    console.log("");
    console.log(" Porta:", PORT);
    console.log("");
    console.log(" Gravação de Atas Legislativas: ATIVA");
    console.log(" Gravação de Logo em Banco JSON: ATIVA");
    console.log(" Credenciais Dinâmicas: ONLINE");
    console.log(" Sincronizador de Presença e Sessão: OK");
    console.log("==========================================");
});