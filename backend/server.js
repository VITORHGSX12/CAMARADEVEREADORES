const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
// PORTA DINÂMICA: Ajustada corretamente para escutar a porta do Railway
const PORT = process.env.PORT || 3000;

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
    bancoDadosGlobal.vereadores = bancoVereadores;
    bancoDadosGlobal.atasSalvas = atasSalvasLivro;
    salvarBanco();
    
    let sim = 0, nao = 0, abst = 0;
    bancoVereadores.forEach(v => {
        if (v.status === 'Presente') {
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
        logoSistemaComum: bancoDadosGlobal.logoSistemaComum,
        totaisVotos: { sim, nao, abstencao: abst }
    });
    io.emit("atualizarPainelSemPayload");
}

function buscarPresidente() {
    return bancoVereadores.find(v => v.cargo === "PRESIDENTE");
}

function removerPresidenteAnterior(idAtual) {
    bancoVereadores.forEach(v => {
        if (v.cargo === "PRESIDENTE" && v.id !== idAtual) {
            v.cargo = "VEREADOR";
        }
    });
}

// ======================================================
// CONFIGURAÇÕES GLOBAIS DO SISTEMA
// ======================================================
app.post('/api/configuracoes/logo', (req, res) => {
    const { logoBase64 } = req.body;
    if (!logoBase64) {
        return res.status(400).json({ error: "Nenhum dado de imagem fornecido." });
    }
    try {
        bancoDadosGlobal.logoSistemaComum = logoBase64;
        emitirAtualizacao();
        return res.json({ success: true, message: "Logo salva com sucesso!" });
    } catch (error) {
        return res.status(500).json({ error: "Falha na gravação do banco: " + error.message });
    }
});

app.get('/api/configuracoes/logo', (req, res) => {
    res.json({ logo: bancoDadosGlobal.logoSistemaComum || "" });
});

// ======================================================
// LIVRO DE ATAS
// ======================================================
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
        atasSalvasLivro.unshift(novaAta);
        emitirAtualizacao();
        return res.json({ success: true, message: "Ata arquivada com sucesso!", ata: novaAta });
    } catch (error) {
        return res.status(500).json({ error: "Falha ao gravar ata: " + error.message });
    }
});

app.get('/api/atas', (req, res) => {
    res.json(atasSalvasLivro);
});

// ======================================================
// AUTENTICAÇÃO / LOGIN
// ======================================================
const processarLogin = (req, res) => {
    const { usuario, username, senha, password } = req.body;
    const userFinal = (usuario || username || "").trim().toLowerCase();
    const passFinal = (senha || password || "");

    if (!userFinal || !passFinal) {
        return res.status(400).json({ error: "Informe usuário e senha." });
    }

    if (userFinal === "admin" && passFinal === "123456") {
        return res.json({ id: "admin", nome: "Super Admin", cargo: "SUPERADMIN" });
    }

    const parlamentar = bancoVereadores.find(v =>
        v.username.toLowerCase() === userFinal &&
        v.senha === passFinal
    );

    if (!parlamentar) {
        return res.status(401).json({ error: "Usuário ou senha inválidos." });
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
};

app.post('/api/auth/login', processarLogin);
app.post('/api/vereadores/login', processarLogin);

// ======================================================
// GERENCIAMENTO DE PARLAMENTARES
// ======================================================
app.get('/api/vereadores', (req, res) => {
    res.json(bancoVereadores);
});

app.post('/api/vereadores/cadastrar', (req, res) => {
    try {
        const { cargo, nomeCompleto, nomeEleitoral, dataNascimento, cpf, nomeMae, partido, sigla, username, password, fotoBase64 } = req.body;

        if (!nomeCompleto || !cpf || !nomeMae || !dataNascimento) {
            return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
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

        const novo = {
            id: Date.now().toString(),
            cargo: cargo === "PRESIDENTE" ? "PRESIDENTE" : "VEREADOR",
            nomeCompleto: nomeCompleto.trim(),
            nomeEleitoral: (nomeEleitoral || nomeCompleto).trim(),
            dataNascimento,
            cpf: cpfLimpo,
            nomeMae,
            partido,
            sigla: (sigla || "").toUpperCase(),
            username: usernameFinal,
            senha: password || "123456",
            foto: fotoBase64 || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250",
            status: "Ausente",
            voto: "Pendente"
        };

        if (novo.cargo === "PRESIDENTE") removerPresidenteAnterior(novo.id);
        bancoVereadores.push(novo);
        emitirAtualizacao();
        res.status(201).json({ sucesso: true, parlamentar: novo });
    } catch (error) {
        res.status(500).json({ error: "Erro interno: " + error.message });
    }
});

app.post('/api/vereadores/alterar-senha', (req, res) => {
    const { id, novaSenha } = req.body;
    const vereador = bancoVereadores.find(v => v.id === String(id));
    if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });
    vereador.senha = novaSenha.trim();
    emitirAtualizacao();
    res.json({ success: true });
});

// ======================================================
// CONTROLE DA SESSÃO
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
    } else if (acao === "iniciar") {
        sessaoAtiva = true;
        materiaAtual = { codigo: codigo || "", ementa: ementa || "" };
        bancoVereadores.forEach(v => { v.voto = "Pendente"; });
    } else if (acao === "limparMateria") {
        materiaAtual = { codigo: '', ementa: '' };
        bancoVereadores.forEach(v => { v.voto = "Pendente"; });
    } else if (acao === "fechar" || acao === "encerrar") {
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
    }
    emitirAtualizacao();
    res.json({ success: true });
});

// ======================================================
// PRESENÇA E VOTAÇÃO
// ======================================================
app.post('/api/sessao/presenca', (req, res) => {
    const { vereadorId } = req.body;
    const vereador = bancoVereadores.find(v => v.id === String(vereadorId));

    if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });

    if (vereador.status === "Presente") {
        vereador.status = "Ausente";
        vereador.voto = "Pendente";
        vereador.pedidoFala = false;
        if (String(microfoneAutorizadoId) === String(vereadorId)) microfoneAutorizadoId = null;
        filaOradores = filaOradores.filter(id => String(id) !== String(vereadorId));
    } else {
        vereador.status = "Presente";
    }

    // CORREÇÃO: Removido o erro de sintaxe do operador spread (...) que causava o travamento.
    emitirAtualizacao();
    res.json({ success: true, statusAtual: vereador.status });
});

app.put('/api/vereadores/alterar-usuario', (req, res) => {
    const { id, username } = req.body;
    const novoUsuario = username.trim().toLowerCase();
    const vereador = bancoVereadores.find(v => v.id === String(id));
    if (!vereador) return res.status(404).json({ error: "Parlamentar não encontrado." });
    vereador.username = novoUsuario;
    emitirAtualizacao();
    res.json({ success: true });
});

app.delete('/api/vereadores/:id', (req, res) => {
    const indice = bancoVereadores.findIndex(v => v.id === String(req.params.id));
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
    if (!vereador) return res.status(404).json({ error: "Não encontrado." });
    vereador.voto = voto;
    emitirAtualizacao();
    res.json({ success: true });
});

app.post('/api/microfone/pedir', (req, res) => {
    const { vereadorId } = req.body;
    const vereador = bancoVereadores.find(v => v.id === String(vereadorId));
    if (vereador && vereador.status === "Presente") {
        vereador.pedidoFala = true;
        if (!filaOradores.includes(vereadorId)) filaOradores.push(vereadorId);
        emitirAtualizacao();
    }
    res.json({ success: true });
});

app.post('/api/microfone/autorizar', (req, res) => {
    const { vereadorId } = req.body;
    microfoneAutorizadoId = vereadorId;
    filaOradores = filaOradores.filter(id => id !== vereadorId);
    bancoVereadores.forEach(v => {
        if (String(v.id) === String(vereadorId)) v.pedidoFala = false;
    });
    emitirAtualizacao();
    res.json({ success: true });
});

// ======================================================
// WEBSOCKETS (SOCKET.IO REAL-TIME)
// ======================================================
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

server.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta: ${PORT}`);
});