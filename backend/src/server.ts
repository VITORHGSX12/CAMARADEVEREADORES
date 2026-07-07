import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// 1. Libera o CORS para o Frontend conseguir se conectar sem bloqueios
app.use(cors({
    origin: '*' // Permite requisições de qualquer origem local
}));

// 2. Permite que o Express leia requisições no formato JSON
app.use(express.json());

// 3. DEFINIÇÃO DA ROTA DE LOGIN (Que estava faltando!)
app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;

    console.log(`Tentativa de login recebida: Usuário -> ${usuario}`);

    // --- LOGIN DE CONTINGÊNCIA (Para você testar o redirecionamento agora!) ---
    if (usuario === 'admin' && senha === '123456') {
        return res.json({ id: 1, nome: 'Super Admin', cargo: 'SUPERADMIN' });
    }
    if (usuario === 'presidente' && senha === '123456') {
        return res.json({ id: 2, nome: 'Presidente da Câmara', cargo: 'PRESIDENTE' });
    }
    if (usuario === 'vereador' && senha === '123456') {
        return res.json({ id: 3, nome: 'Beto de Washington', cargo: 'VEREADOR' });
    }

    // --- INTEGRAÇÃO REAL COM O BANCO PRISMA ---
    try {
        // Altere 'usuario' para o nome exato do seu Model no schema.prisma se necessário
        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { username: usuario.toLowerCase() },
                    { email: usuario.toLowerCase() }
                ]
            }
        });

        // Se achou no banco, valida a senha
        if (user && user.senha === senha) {
            return res.json({
                id: user.id,
                nome: user.nome,
                cargo: user.cargo // Certifique-se de que no banco retorne 'SUPERADMIN', 'PRESIDENTE' ou 'VEREADOR'
            });
        }

        // Se não bateu com os testes locais e nem com o banco
        return res.status(401).json({ error: 'Credenciais inválidas! Usuário ou senha incorretos.' });

    } catch (error) {
        console.error('Erro ao conectar no banco Prisma:', error);
        return res.status(500).json({ error: 'Erro interno no servidor de banco de dados.' });
    }
});

// 4. Inicialização da Porta do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 SISCAM 1.0 - Backend rodando com sucesso!`);
    console.log(`🔗 Endpoint de Login pronto em: http://localhost:${PORT}/api/auth/login`);
    console.log(`=================================================`);
});