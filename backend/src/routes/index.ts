import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// 1. Configura o CORS para o seu Frontend conseguir se conectar
app.use(cors({
    origin: '*' //
}));

// 2. Permite que o Express entenda requisições em formato JSON
app.use(express.json());

// --- NOVA CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS ---
// Isso vai fazer o próprio Express servir o seu frontend se você acessar http://localhost:3000
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// 3. ROTA DE LOGIN (Chamada pelo seu login-script.js)
app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body; //

    console.log(`[SISCAM] Tentativa de login recebida para o usuário: ${usuario}`); //

    // --- CONTINGÊNCIA/TESTE LOCAL ---
    if (usuario === 'admin' && senha === '123456') { //
        return res.json({ id: 1, nome: 'Super Admin', cargo: 'SUPERADMIN' }); //
    }
    if (usuario === 'presidente' && senha === '123456') { //
        return res.json({ id: 2, nome: 'Presidente da Câmara', cargo: 'PRESIDENTE' }); //
    }
    if (usuario === 'vereador' && senha === '123456') { //
        return res.json({ id: 3, nome: 'Beto de Washington', cargo: 'VEREADOR' }); //
    }

    // --- LOGICA DE VERIFICAÇÃO NO BANCO PRISMA ---
    try { //
        const user = await prisma.usuario.findFirst({ //
            where: { //
                OR: [ //
                    { username: usuario.toLowerCase() }, //
                    { email: usuario.toLowerCase() } //
                ] //
            } //
        }); //

        const senhaValidada = Array.isArray(senha) ? senha[0] : senha; //

        if (user && user.senha === senhaValidada) { //
            return res.json({ //
                id: user.id, //
                nome: user.nome, //
                cargo: user.cargo //
            }); //
        } //

        return res.status(401).json({ error: 'Credenciais inválidas no banco de dados.' }); //

    } catch (error) { //
        console.error('Erro ao conectar ao Prisma:', error); //
        return res.status(500).json({ error: 'Erro interno no servidor de banco de dados.' }); //
    }
});

// Rota raiz para abrir o formulário caso acesse a porta 3000
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// 5. Inicialização do Servidor na Porta 3000
const PORT = 3000; //
app.listen(PORT, () => { //
    console.log(`=================================================`); //
    console.log(`🚀 SISCAM 1.0 - Servidor rodando em index.ts`); //
    console.log(`🔗 Acesse o Login diretamente em: http://localhost:${PORT}`);
    console.log(`=================================================`); //
});