// Banco de dados em memória contendo apenas os projetos de autoria do vereador logado
const meusProjetos = [
    { numero: "PL Nº 12/2026", ementa: "Dispõe sobre a modernização tecnológica e digitalização dos processos da Câmara Municipal.", status: "Em Pauta" },
    { numero: "PL Nº 05/2026", ementa: "Cria a semana de conscientização sobre o descarte correto de lixo eletrônico nas escolas.", status: "Aprovado" },
    { numero: "IND Nº 88/2026", ementa: "Indica ao Poder Executivo a necessidade de reforma da Praça Central do município.", status: "Enviado" }
];

// Estado do Pedido da Palavra
let solicitouPalavra = false;

function solicitarPalavra() {
    solicitouPalavra = !solicitouPalavra;
    const btn = document.getElementById('btn-pedir-palavra');
    
    if (solicitouPalavra) {
        btn.innerHTML = `<i data-lucide="mic-off" class="w-4 h-4"></i> Cancelar Palavra`;
        btn.className = "bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 uppercase tracking-wider shadow-md palavra-solicitada";
        alert("Sua solicitação de palavra foi enviada à Mesa Diretora do Presidente!");
    } else {
        btn.innerHTML = `<i data-lucide="mic" class="w-4 h-4"></i> Pedir a Palavra`;
        btn.className = "bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 border border-slate-700 uppercase tracking-wider shadow-md";
    }
    lucide.createIcons();
}

// Lógica de Registro de Voto no Terminal
function registrarVoto(opcao) {
    // Esconde o bloco com os três botões grandes de votação
    document.getElementById('bloco-botoes-voto').classList.add('hidden');
    
    // Atualiza e mostra a mensagem de sucesso
    document.getElementById('voto-escolhido').innerText = opcao;
    document.getElementById('msg-voto-confirmado').classList.remove('hidden');
    
    // Muda a badge superior para indicar conclusão individual
    const badge = document.getElementById('badge-status-sessao');
    badge.innerText = "SEU VOTO FOI ENVIADO";
    badge.className = "bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold";
}

// Navegação entre Votação e Gabinete Pessoal
function mudarAba(aba) {
    document.getElementById('aba-votacao').classList.add('hidden');
    document.getElementById('aba-gabinete').classList.add('hidden');
    
    document.getElementById('btn-votacao').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all text-left";
    document.getElementById('btn-gabinete').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all text-left";

    if (aba === 'votacao') {
        document.getElementById('aba-votacao').classList.remove('hidden');
        document.getElementById('btn-votacao').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all text-left";
        document.getElementById('titulo-pagina').innerText = "Terminal Eletrônico de Bancada";
    } else {
        document.getElementById('aba-gabinete').classList.remove('hidden');
        document.getElementById('btn-gabinete').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all text-left";
        document.getElementById('titulo-pagina').innerText = "Meu Gabinete Digital";
        renderizarGabinete();
    }
}

// Renderiza a lista de projetos do vereador com botão de Iniciar Transmissão/Apresentação
function renderizarGabinete() {
    const tbody = document.getElementById('tabela-meus-projetos');
    tbody.innerHTML = "";

    meusProjetos.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 transition-colors";
        
        // Botão especial de apresentação se o projeto estiver em pauta
        const botaoAcao = p.status === "Em Pauta" 
            ? `<button onclick="iniciarApresentacao('${p.numero}')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 mx-auto transition-all shadow shadow-blue-900/50">
                    <i data-lucide="tv" class="w-3.5 h-3.5"></i> Apresentar no Telão
               </button>`
            : `<span class="text-xs text-slate-500 font-medium italic block text-center">Concluído</span>`;

        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-blue-400">${p.numero}</td>
            <td class="py-4 px-6 text-slate-300 font-medium">${p.ementa}</td>
            <td class="py-4 px-6">${botaoAcao}</td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// Evento disparado quando o vereador quer espelhar o projeto dele no telão principal
function iniciarApresentacao(numeroProjeto) {
    alert(`O ${numeroProjeto} foi enviado para o Telão Principal do Plenário para o início da sua defesa na Tribuna.`);
}