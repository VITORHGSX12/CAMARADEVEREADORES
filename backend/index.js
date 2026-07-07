const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// 1. Configura o CORS para o Frontend se conectar na porta 3000
app.use(cors({
    origin: '*'
}));

app.use(express.json());

// 2. ROTA DE LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;

    console.log(`[SISCAM] Tentativa de login recebida para: ${usuario}`);

    // --- LOGIN DE TESTE LOCAL ---
    if (usuario === 'admin' && senha === '123456') {
        return res.json({ id: 1, nome: 'Super Admin', cargo: 'SUPERADMIN' });
    }
    if (usuario === 'presidente' && senha === '123456') {
        return res.json({ id: 2, nome: 'Presidente da Câmara', cargo: 'PRESIDENTE' });
    }
    if (usuario === 'vereador' && senha === '123456') {
        return res.json({ id: 3, nome: 'Beto de Washington', cargo: 'VEREADOR' });
    }

    // --- VERIFICAÇÃO NO BANCO PRISMA ---
    try {
        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { username: usuario.toLowerCase() },
                    { email: usuario.toLowerCase() }
                ]
            }
        });

        const senhaValidada = Array.isArray(senha) ? senha[0] : senha;

        if (user && user.senha === senhaValidada) {
            return res.json({
                id: user.id,
                nome: user.nome,
                cargo: user.cargo
            });
        }

        return res.status(401).json({ error: 'Credenciais inválidas no banco de dados.' });

    } catch (error) {
        console.error('Erro no Prisma:', error);
        return res.status(500).json({ error: 'Erro interno no servidor de banco de dados.' });
    }
});

app.get('/', (req, res) => {
    res.send('SISCAM Backend Ativo na Porta 3000!');
});

// 3. INICIALIZAÇÃO NA PORTA 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 SISCAM 1.0 - Backend ativo com sucesso!`);
    console.log(`🔗 Endpoint de Login: http://localhost:${PORT}/api/auth/login`);
    console.log(`=================================================`);
});