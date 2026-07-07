// Configurado para bater na mesma porta 3000 do backend nativo
const API_URL = 'http://localhost:3000/api';

async function autenticarUsuario(event) {
    event.preventDefault();

    const usuarioInput = document.getElementById('login-usuario').value.trim();
    const senhaInput = document.getElementById('login-senha').value;
    const alertaErro = document.getElementById('alerta-erro');
    const textoErro = document.getElementById('texto-erro');

    alertaErro.classList.add('hidden');

    try {
        const resposta = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario: usuarioInput,
                senha: senhaInput
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.error || 'Erro ao tentar realizar a autenticação.');
        }

        localStorage.setItem('siscam_user_id', dados.id);
        localStorage.setItem('siscam_user_nome', dados.nome);
        localStorage.setItem('siscam_user_cargo', dados.cargo);

        switch (dados.cargo.toUpperCase()) {
            case 'SUPERADMIN':
                window.location.href = './index.html';
                break;
            case 'PRESIDENTE':
                window.location.href = './presidente.html';
                break;
            case 'VEREADOR':
                window.location.href = './vereador.html';
                break;
            default:
                throw new Error('Nível de acesso não reconhecido pelo painel.');
        }

    } catch (error) {
        alertaErro.classList.remove('animate-shake');
        void alertaErro.offsetWidth; // Reseta animação
        
        textoErro.innerText = error.message;
        alertaErro.classList.remove('hidden');
        alertaErro.classList.add('animate-shake');
    }
}