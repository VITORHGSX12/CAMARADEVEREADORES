import express, { Request, Response } from 'express';

const app = express();

// Middleware para permitir que o Express entenda JSON no corpo das requisições
app.use(express.json());

// Banco de dados temporário (mock) em memória para testar o GET e POST imediatamente
const vereadoresTeste = [
  { id: 1, nome: "Vereador João Silva", partido: "ABC", votos: 1200 },
  { id: 2, nome: "Vereadora Maria Souza", partido: "XYZ", votos: 1500 }
];

// ROTA GET: Listar vereadores
app.get('/vereadores', (req: Request, res: Response) => {
  return res.status(200).json(vereadoresTeste);
});

// ROTA POST: Cadastrar um novo vereador
app.post('/vereadores', (req: Request, res: Response) => {
  const { nome, partido, votos } = req.body;

  // Validação simples
  if (!nome || !partido) {
    return res.status(400).json({ error: "Nome e partido são obrigatórios!" });
  }

  const novoVereador = {
    id: vereadoresTeste.length + 1,
    nome,
    partido,
    votos: votos || 0
  };

  vereadoresTeste.push(novoVereador);

  return res.status(201).json(novoVereador);
});

const PORT = 3333;

app.listen(PORT, () => {
  console.log(`🚀 SERVIDOR DA CÂMARA RODANDO NA PORTA ${PORT}!`);
});