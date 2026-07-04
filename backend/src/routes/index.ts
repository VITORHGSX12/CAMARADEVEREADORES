import { Router, Request, Response } from 'express';

const routes = Router();

const vereadoresTeste = [
  { id: 1, nome: "Vereador João Silva", partido: "ABC", votos: 1200 },
  { id: 2, nome: "Vereadora Maria Souza", partido: "XYZ", votos: 1500 }
];

routes.get('/vereadores', (req: Request, res: Response) => {
  return res.status(200).json(vereadoresTeste);
});

routes.post('/vereadores', (req: Request, res: Response) => {
  const { nome, partido, votos } = req.body;

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

export { routes };