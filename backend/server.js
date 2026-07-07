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

function carregarBanco() {
    if (!fs.existsSync(BANCO)) {
        fs.writeFileSync(
            BANCO,
            JSON.stringify([], null, 4)
        );
    }
    try {
        return JSON.parse(
            fs.readFileSync(BANCO, 'utf8')
        );
    } catch {
        return [];
    }
}

function salvarBanco() {
    fs.writeFileSync(
        BANCO,
        JSON.stringify(bancoVereadores, null, 4)
    );
}

let bancoVereadores = carregarBanco();
let sessaoAtiva = false;
let materiaAtual = {
    codigo: '',
    ementa: ''
};
let microfoneAutorizadoId = null;
let filaOradores = [];

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
    salvarBanco();
    io.emit("atualizarPainel", {
        vereadores: bancoVereadores,
        sessaoAtiva,
        materiaAtual,
        filaOradores,
        microfoneAutorizadoId
    });
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
// CADASTRAR PARLAMENTAR (CORRIGIDO E DINÂMICO)
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
            username, // <-- CAPTURA DO FRONT
            password, // <-- CAPTURA DO FRONT
            fotoBase64 
        } = req.body;

        if (!nomeCompleto || !cpf || !nomeMae || !dataNascimento) {
            return res.status(400).json({ error: "Campos obrigatórios (Nome, CPF, Nome da Mãe, Data Nasc.) não preenchidos." });
        }

        const cpfLimpo = String(cpf).replace(/\D/g, '');

        if (bancoVereadores.find(v => v.cpf.replace(/\D/g, '') === cpfLimpo)) {
            return res.status(400).json({ error: "Este CPF já está cadastrado." });
        }

        // Validação de Usuário Customizado se enviado pelo front-end
        let usernameFinal = "";
        if (username && username.trim() !== "") {
            const userValidado = username.trim().toLowerCase();
            if (existeUsuario(userValidado)) {
                return res.status(400).json({ error: "Este nome de usuário já está em uso." });
            }
            usernameFinal = userValidado;
        } else {
            // Fallback: se não preencher, gera automático
            usernameFinal = gerarUsuarioUnico(nomeEleitoral || nomeCompleto);
        }

        // Definição da Senha Customizada se enviada
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
            senha: senateFinal = senhaFinal,
            foto: fotoBase64 || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250",
            status: "Ausente",
            voto: "Pendente"
        };

        if (cargoFinal === "PRESIDENTE") {
            removerPresidenteAnterior(novo.id);
        }

        bancoVereadores.push(novo);
        salvarBanco();
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

    res.json({
        success: true
    });
});

// ======================================================
// ALTERAR USUÁRIO
// ======================================================
app.put('/api/vereadores/alterar-usuario', (req, res) => {
    const { id, username } = req.body;

    if (!username || username.trim() === "") {
        return res.status(400).json({
            error: "Usuário inválido."
        });
    }

    const novoUsuario = username.trim().toLowerCase();

    const repetido = bancoVereadores.find(v =>
        v.username === novoUsuario &&
        v.id !== String(id)
    );

    if (repetido) {
        return res.status(400).json({
            error: "Usuário já existe."
        });
    }

    const vereador = bancoVereadores.find(v => v.id === String(id));

    if (!vereador) {
        return res.status(404).json({
            error: "Parlamentar não encontrado."
        });
    }

    vereador.username = novoUsuario;
    emitirAtualizacao();

    res.json({
        success: true
    });
});

// ======================================================
// ALTERAR CARGO
// ======================================================
app.put('/api/vereadores/alterar-cargo', (req, res) => {
    const { id, cargo } = req.body;

    if (
        cargo !== "PRESIDENTE" &&
        cargo !== "VEREADOR"
    ) {
        return res.status(400).json({
            error: "Cargo inválido."
        });
    }

    const vereador = bancoVereadores.find(v => v.id === String(id));

    if (!vereador) {
        return res.status(404).json({
            error: "Parlamentar não encontrado."
        });
    }

    if (cargo === "PRESIDENTE") {
        removerPresidenteAnterior(id);
    }

    vereador.cargo = cargo;
    emitirAtualizacao();

    res.json({
        success: true
    });
});

// ======================================================
// REMOVER USUÁRIO
// ======================================================
app.delete('/api/vereadores/:id', (req, res) => {
    const id = String(req.params.id);
    const indice = bancoVereadores.findIndex(v => v.id === id);

    if (indice === -1) {
        return res.status(404).json({
            error: "Parlamentar não encontrado."
        });
    }

    bancoVereadores.splice(indice, 1);
    emitirAtualizacao();

    res.json({
        success: true
    });
});

// ======================================================
// STATUS DA SESSÃO
// ======================================================
app.get('/api/sessao/status', (req, res) => {
    res.json({
        sessaoAtiva,
        materiaAtual,
        microfoneAutorizadoId,
        filaOradores,
        vereadores: bancoVereadores
    });
});

// ======================================================
// CONTROLE DA SESSÃO
// ======================================================
app.post('/api/sessao/controle', (req, res) => {
    const { acao, codigo, ementa } = req.body;

    if (acao === "iniciar") {
        sessaoAtiva = true;
        materiaAtual = {
            codigo: codigo || "",
            ementa: ementa || ""
        };
        bancoVereadores.forEach(v => {
            v.status = "Ausente";
            v.voto = "Pendente";
        });
    } else {
        sessaoAtiva = false;
        microfoneAutorizadoId = null;
        filaOradores = [];
    }

    emitirAtualizacao();
    res.json({
        success: true
    });
});

// ======================================================
// PRESENÇA
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

    vereador.status = "Presente";
    emitirAtualizacao();

    res.json({
        success: true
    });
});

// ======================================================
// VOTAÇÃO
// ======================================================
app.post('/api/vereadores/votar', (req, res) => {
    const { vereadorId, voto } = req.body;
    const vereador = bancoVereadores.find(
        v => v.id === String(vereadorId)
    );

    if (!vereador) {
        return res.status(404).json({
            error: "Parlamentar não encontrado."
        });
    }

    vereador.voto = voto;
    emitirAtualizacao();

    res.json({
        success: true
    });
});

// ======================================================
// PEDIR MICROFONE
// ======================================================
app.post('/api/microfone/pedir', (req, res) => {
    const { vereadorId } = req.body;
    if (!filaOradores.includes(vereadorId)) {
        filaOradores.push(vereadorId);
    }
    emitirAtualizacao();
    res.json({
        success: true
    });
});

// ======================================================
// AUTORIZAR MICROFONE
// ======================================================
app.post('/api/microfone/autorizar', (req, res) => {
    const { vereadorId } = req.body;
    microfoneAutorizadoId = vereadorId;
    filaOradores = filaOradores.filter(
        id => id !== vereadorId
    );
    emitirAtualizacao();
    res.json({
        success: true
    });
});

// ======================================================
// SOCKET.IO
// ======================================================
io.on("connection", socket => {
    console.log("Cliente conectado:", socket.id);

    socket.emit("atualizarPainel", {
        vereadores: bancoVereadores,
        sessaoAtiva,
        materiaAtual,
        filaOradores,
        microfoneAutorizadoId
    });

    socket.on("transmitirAudioStream", dados => {
        socket.broadcast.emit(
            "receberAudioStream",
            dados
        );
    });

    socket.on("disconnect", () => {
        console.log("Cliente desconectado:", socket.id);
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
    console.log(" Credenciais Dinâmicas: ONLINE");
    console.log(" Banco JSON atualizado: OK");
    console.log("==========================================");
});