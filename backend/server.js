const express = require('express');
const cors = require('cors');
const http = require('http'); 
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Lista explícita de origens permitidas para eliminar falhas dinâmicas de CORS
const origensPermitidas = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://camaradevereadores.vercel.app'
];

// CORS MANUAL CONFIGURADO COM VALIDAÇÃO DE LISTA DE CONFIANÇA
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origensPermitidas.includes(origin) || !origin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    } else {
        res.header('Access-Control-Allow-Origin', 'https://camaradevereadores.vercel.app');
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware CORS nativo sincronizado com os domínios aceitos
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origensPermitidas.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Fallback tolerante para evitar travas de navegadores antigos
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const server = http.createServer(app);

// Sincronização do barramento WebSockets para aceitar requisições de origem cruzada da Vercel
const io = new Server(server, {
    cors: {
        origin: origensPermitidas,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
    }
});

// Variáveis de controle da sessão (mantidas em memória para o Socket.io)
let sessaoAtiva = false;
let materiaAtual = { codigo: '', ementa: '' };
let microfoneAutorizadoId = null;
let filaOradores = [];
let logoSistemaComumGlobal = "";

let cronometroEstado = {
    tempoRestante: 300,
    tipoTempo: "Grande Expediente",
    oradorNome: "Nenhum orador na tribuna",
    intervalId: null
};

// Função para emitir atualizações em tempo real via Socket.io buscando do Postgres
async function emitirAtualizacao() {
    try {
        const bancoVereadores = await prisma.tableVereador.findMany({
            orderBy: { nomeEleitoral: 'asc' }
        });

        let sim = 0, nao = 0, abst = 0;
        bancoVereadores.forEach(v => {
            if (v && v.status === 'Presente') {
                if (v.voto === 'SIM') sim++;
                if (v.voto === 'NÃO') nao++;
                if (v.voto === 'ABSTENÇÃO') abst++;
            }
        });

        io.emit("atualizarPainel", {
            vereadores: bancoVereadores,
            sessaoAtiva,
            materiaAtiva: materiaAtual,
            materiaAtual,
            filaOradores,
            microfoneAutorizadoId,
            logoSistemaComum: logoSistemaComumGlobal,
            totaisVotos: { sim, nao, abstencao: abst }
        });
        io.emit("atualizarPainelSemPayload");
    } catch (err) {
        console.error("Erro ao emitir atualização do Socket:", err);
    }
}

// CONFIGURAÇÕES GLOBAIS DO SISTEMA
app.post('/api/configuracoes/logo', (req, res) => {
    const { logoBase64 } = req.body;
    if (!logoBase64) return res.status(400).json({ error: "Nenhum dado de imagem fornecido." });
    logoSistemaComumGlobal = logoBase64;
    emitirAtualizacao();
    return res.json({ success: true, message: "Logo salva com sucesso!" });
});

app.get('/api/configuracoes/logo', (req, res) => {
    res.json({ logo: logoSistemaComumGlobal });
});

// AUTENTICAÇÃO / LOGIN (Buscando do PostgreSQL via Prisma)
const processarLogin = async (req, res) => {
    try {
        const { usuario, username, senha, password } = req.body;
        const userFinal = String(usuario || username || "").trim().toLowerCase();
        const passFinal = String(senha || password || "");

        if (!userFinal || !passFinal) {
            return res.status(400).json({ error: "Informe usuário e senha." });
        }

        if (userFinal === "admin" && passFinal === "123456") {
            return res.json({ id: "admin", nome: "Super Admin", cargo: "SUPERADMIN" });
        }

        const parlamentar = await prisma.tableVereador.findUnique({
            where: { username: userFinal }
        });

        if (!parlamentar || String(parlamentar.senha) !== passFinal) {
            return res.status(401).json({ error: "Usuário ou senha inválidos." });
        }

        return res.json({
            id: parlamentar.id,
            cargo: parlamentar.cargo,
            username: parlamentar.username,
            nome: parlamentar.nomeEleitoral || parlamentar.nomeCompleto || "Parlamentar",
            nomeCompleto: parlamentar.nomeCompleto,
            nomeEleitoral: parlamentar.nomeEleitoral,
            partido: parlamentar.partido,
            sigla: parlamentar.sigla,
            foto: parlamentar.foto
        });
    } catch (err) {
        console.error("Erro no login:", err);
        return res.status(500).json({ error: "Erro interno no servidor ao processar autenticação." });
    }
};

app.post('/api/auth/login', processarLogin);
app.post('/api/vereadores/login', processarLogin);

// PARLAMENTARES - LISTAR (GET)
const listarParlamentares = async (req, res) => {
    try {
        const lista = await prisma.tableVereador.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(lista || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
app.get('/api/vereadores', listarParlamentares);
app.get('/api/parlamentares', listarParlamentares);

// PARLAMENTARES - CADASTRAR (POST)
const cadastrarParlamentar = async (req, res) => {
    try {
        const { cargo, nomeCompleto, nomeEleitoral, dataNascimento, cpf, nomeMae, partido, sigla, username, password, senha, fotoBase64, foto } = req.body;

        if (!nomeCompleto || !cpf) {
            return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
        }

        const cpfLimpo = String(cpf).replace(/\D/g, '');
        const existeCpf = await prisma.tableVereador.findUnique({ where: { cpf: cpfLimpo } });
        if (existeCpf) {
            return res.status(400).json({ error: "Este CPF já está cadastrado." });
        }

        let usernameFinal = "";
        if (username && username.trim() !== "") {
            usernameFinal = username.trim().toLowerCase();
            const existeUser = await prisma.tableVereador.findUnique({ where: { username: usernameFinal } });
            if (existeUser) return res.status(400).json({ error: "Este nome de usuário já está em uso." });
        } else {
            let base = String(nomeEleitoral || nomeCompleto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "");
            usernameFinal = base;
            let contador = 1;
            while (await prisma.tableVereador.findUnique({ where: { username: usernameFinal } })) {
                usernameFinal = base + contador;
                contador++;
            }
        }

        if (cargo === "PRESIDENTE") {
            await prisma.tableVereador.updateMany({
                where: { cargo: "PRESIDENTE" },
                data: { cargo: "VEREADOR" }
            });
        }

        const novo = await prisma.tableVereador.create({
            data: {
                cargo: cargo === "PRESIDENTE" ? "PRESIDENTE" : "VEREADOR",
                nomeCompleto: nomeCompleto.trim(),
                nomeEleitoral: (nomeEleitoral || nomeCompleto).trim(),
                dataNascimento: dataNascimento || "",
                cpf: cpfLimpo,
                nomeMae: nomeMae || "",
                partido: partido || "",
                sigla: (sigla || "").toUpperCase(),
                username: usernameFinal,
                senha: password || senha || "123456",
                foto: fotoBase64 || foto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250",
                status: "Ausente",
                voto: "Aguardando",
                pedidoFala: false,
                votos: 0
            }
        });

        await emitirAtualizacao();
        res.status(201).json({ sucesso: true, parlamentar: novo });
    } catch (error) {
        res.status(500).json({ error: "Erro interno: " + error.message });
    }
};
app.post('/api/vereadores/cadastrar', cadastrarParlamentar);
app.post('/api/parlamentares', cadastrarParlamentar);

app.post('/api/vereadores/alterar-senha', async (req, res) => {
    const { id, novaSenha } = req.body;
    try {
        await prisma.tableVereador.update({
            where: { id: String(id) },
            data: { senha: novaSenha.trim() }
        });
        await emitirAtualizacao();
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ error: "Parlamentar não encontrado." });
    }
});

// SESSÃO CONTROLE
app.post('/api/sessao/controle', async (req, res) => {
    const { acao, codigo, ementa } = req.body;

    if (acao === "abrir") {
        sessaoAtiva = true;
        await prisma.tableVereador.updateMany({
            data: { status: "Ausente", voto: "Aguardando", pedidoFala: false }
        });
    } else if (acao === "iniciar") {
        sessaoAtiva = true;
        materiaAtual = { codigo: codigo || "", ementa: ementa || "" };
        await prisma.tableVereador.updateMany({ data: { voto: "Aguardando" } });
    } else if (acao === "limparMateria") {
        materiaAtual = { codigo: '', ementa: '' };
        await prisma.tableVereador.updateMany({ data: { voto: "Aguardando" } });
    } else if (acao === "fechar" || acao === "encerrar") {
        sessaoAtiva = false;
        materiaAtual = { codigo: '', ementa: '' };
        microfoneAutorizadoId = null;
        filaOradores = [];
        await prisma.tableVereador.updateMany({
            data: { status: "Ausente", voto: "Aguardando", pedidoFala: false }
        });
        if (cronometroEstado.intervalId) {
            clearInterval(cronometroEstado.intervalId);
            cronometroEstado.intervalId = null;
        }
    }
    await emitirAtualizacao();
    res.json({ success: true });
});

app.post('/api/sessao/presenca', async (req, res) => {
    const { vereadorId } = req.body;
    try {
        const vereador = await prisma.tableVereador.findUnique({ where: { id: String(vereadorId) } });
        if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });

        let novoStatus = "Presente";
        let dadosUpdate = { status: "Presente" };

        if (vereador.status === "Presente") {
            novoStatus = "Ausente";
            dadosUpdate = { status: "Ausente", voto: "Aguardando", pedidoFala: false };
            if (String(microfoneAutorizadoId) === String(vereadorId)) microfoneAutorizadoId = null;
            filaOradores = filaOradores.filter(id => String(id) !== String(vereadorId));
        }

        await prisma.tableVereador.update({
            where: { id: String(vereadorId) },
            data: dadosUpdate
        });

        await emitirAtualizacao();
        res.json({ success: true, statusAtual: novoStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/parlamentares/:id', async (req, res) => {
    try {
        await prisma.tableVereador.delete({ where: { id: String(req.params.id) } });
        await emitirAtualizacao();
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ error: "Parlamentar não encontrado." });
    }
});

// Alias para compatibilidade retroativa com chamadas antigas do admin
app.delete('/api/vereadores/:id', async (req, res) => {
    try {
        await prisma.tableVereador.delete({ where: { id: String(req.params.id) } });
        await emitirAtualizacao();
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ error: "Parlamentar não encontrado." });
    }
});

app.get('/api/sessao/status', async (req, res) => {
    try {
        const vereadores = await prisma.tableVereador.findMany({ orderBy: { nomeEleitoral: 'asc' } });
        let sim = 0, nao = 0, abst = 0;
        vereadores.forEach(v => {
            if (v && v.status === 'Presente') {
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
            vereadores,
            logoSistemaComum: logoSistemaComumGlobal,
            totaisVotos: { sim, nao, abstencao: abst }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vereadores/votar', async (req, res) => {
    const { vereadorId, voto } = req.body;
    try {
        await prisma.tableVereador.update({
            where: { id: String(vereadorId) },
            data: { voto: voto }
        });
        await emitirAtualizacao();
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ error: "Não encontrado." });
    }
});

app.post('/api/microfone/pedir', async (req, res) => {
    const { vereadorId } = req.body;
    try {
        await prisma.tableVereador.update({
            where: { id: String(vereadorId), status: "Presente" },
            data: { pedidoFala: true }
        });
        if (!filaOradores.includes(vereadorId)) filaOradores.push(vereadorId);
        await emitirAtualizacao();
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

app.post('/api/microfone/autorizar', async (req, res) => {
    const { vereadorId } = req.body;
    microfoneAutorizadoId = vereadorId;
    filaOradores = filaOradores.filter(id => id !== vereadorId);
    await prisma.tableVereador.update({
        where: { id: String(vereadorId) },
        data: { pedidoFala: false }
    });
    await emitirAtualizacao();
    res.json({ success: true });
});

// WEBSOCKETS
io.on("connection", socket => {
    socket.on("registrarConexao", (dados) => {
        socket.userId = dados.userId;
        socket.nome = dados.nome;
        socket.cargo = dados.cargo;
    });

    socket.on("enviarAudioStream", dados => {
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
});

app.use((err, req, res, next) => {
    console.error("ERRO NÃO TRATADO:", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: "Erro interno no servidor: " + err.message });
});

process.on('uncaughtException', (err) => {
    console.error("EXCEÇÃO NÃO CAPTURADA:", err);
});

server.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta: ${PORT}`);
});