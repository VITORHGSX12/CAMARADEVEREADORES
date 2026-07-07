// Memória temporária simulando banco de dados para os Projetos de Lei
let bancoProjetos = [
    { numero: "PL Nº 12/2026", ementa: "Dispõe sobre a modernização tecnológica e digitalização dos processos da Câmara Municipal.", status: "Em Votação" },
    { numero: "PL Nº 11/2026", ementa: "Institui o programa municipal de incentivo à leitura nas escolas públicas da zona rural.", status: "Aprovado" },
    { numero: "PL Nº 10/2026", ementa: "Autoriza a abertura de crédito suplementar para pavimentação asfáltica e saneamento.", status: "Aprovado" },
    { numero: "PL Nº 09/2026", ementa: "Denomina 'Rua da Paz' a atual Rua Projetada 04 no bairro central.", status: "Rejeitado" }
];

// Variáveis do Cronômetro Legislativo
let tempoRestante = 225; // 3 minutos e 45 segundos em segundos
let cronometroIntervalo = null;
let cronometroRodando = true;

// Inicializador do Cronômetro Automatizado ao Carregar
function iniciarCronometro() {
    cronometroIntervalo = setInterval(() => {
        if (cronometroRodando && tempoRestante > 0) {
            tempoRestante--;
            atualizarDisplayCronometro();
        }
    }, 1000);
}

function atualizarDisplayCronometro() {
    const minutos = Math.floor(tempoRestante / 60).toString().padStart(2, '0');
    const segundos = (tempoRestante % 60).toString().padStart(2, '0');
    document.getElementById('display-tempo').innerText = `${minutos}:${segundos}`;
}

// Botão de Pausar / Play no Cronômetro
function alternarCronometro() {
    cronometroRodando = !cronometroRodando;
    const btn = document.getElementById('btn-cronometro');
    const text = document.getElementById('text-cronometro');
    const icon = document.getElementById('icon-cronometro');

    if (cronometroRodando) {
        text.innerText = "Pausar Cronômetro";
        icon.setAttribute('data-lucide', 'pause');
        btn.className = "bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-slate-700";
    } else {
        text.innerText = "Retomar Tempo";
        icon.setAttribute('data-lucide', 'play');
        btn.className = "bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2";
    }
    lucide.createIcons();
}

// Lógica de Estados da Votação (Idêntico ao fluxo de Plenário)
function alternarVotacao() {
    document.getElementById('status-discussao').innerText = "VOTAÇÃO EM ANDAMENTO";
    document.getElementById('status-discussao').className = "bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold animate-pulse";
    
    // Altera estados dos botões
    const btnVotar = document.getElementById('btn-votar');
    btnVotar.className = "bg-slate-850 text-slate-600 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed";
    btnVotar.disabled = true;

    const btnEncerrar = document.getElementById('btn-encerrar');
    btnEncerrar.className = "bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20";
    btnEncerrar.disabled = false;
}

function encerraVotacao() {
    document.getElementById('status-discussao').innerText = "VOTAÇÃO CONCLUÍDA";
    document.getElementById('status-discussao').className = "bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold";
    
    const btnEncerrar = document.getElementById('btn-encerrar');
    btnEncerrar.className = "bg-slate-850 text-slate-600 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed";
    btnEncerrar.disabled = true;
}

// Navegação entre Telas do Presidente (Comandar vs Projetos)
function mudarAba(aba) {
    document.getElementById('aba-sessao').classList.add('hidden');
    document.getElementById('aba-projetos').classList.add('hidden');
    
    document.getElementById('btn-sessao').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all text-left";
    document.getElementById('btn-projetos').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all text-left";

    if(aba === 'sessao') {
        document.getElementById('aba-sessao').classList.remove('hidden');
        document.getElementById('btn-sessao').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-600 text-white font-medium transition-all text-left";
        document.getElementById('titulo-pagina').innerText = "Módulo do Presidente - Controle da Sessão";
    } else {
        document.getElementById('aba-projetos').classList.remove('hidden');
        document.getElementById('btn-projetos').className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-600 text-white font-medium transition-all text-left";
        document.getElementById('titulo-pagina').innerText = "Gestão de Projetos de Lei";
        renderizarTabelaProjetos();
    }
}

// Renderização e Cadastro do Livro de Projetos
function renderizarTabelaProjetos() {
    const tbody = document.getElementById('tabela-projetos-corpo');
    tbody.innerHTML = "";

    bancoProjetos.forEach(p => {
        let labelClass = "bg-slate-800 text-slate-400 border-slate-700";
        if(p.status === "Aprovado") labelClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if(p.status === "Rejeitado") labelClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
        if(p.status === "Em Votação") labelClass = "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse";

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 transition-colors";
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-amber-400">${p.numero}</td>
            <td class="py-4 px-6 text-slate-300 font-medium">${p.ementa}</td>
            <td class="py-4 px-6">
                <span class="px-2.5 py-1 text-xs font-semibold border rounded-full ${labelClass}">${p.status}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function cadastrarProjeto(e) {
    e.preventDefault();
    const numero = document.getElementById('proj-numero').value;
    const ementa = document.getElementById('proj-ementa').value;

    bancoProjetos.unshift({ numero, ementa, status: "Em Votação" }); // Adiciona no início da lista
    
    document.getElementById('form-projeto').reset();
    renderizarTabelaProjetos();
}

// Inicializa a contagem regressiva ao abrir a tela
document.addEventListener("DOMContentLoaded", iniciarCronometro);