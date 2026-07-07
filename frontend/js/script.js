// Dados simulados imitando o retorno JSON da API do seu backend Prisma
const dadosMockados = {
    metricas: {
        totalVereadores: 13,
        partidosAtivos: 6,
        sessoesRealizadas: 42
    },
    vereadores: [
        { id: 1, nome: "Dr. Amaury Silva", partido: "PL", cargo: "Presidente", status: "Ativo", foto: "AS" },
        { id: 2, nome: "Maria do Carmo", partido: "PT", cargo: "1ª Secretária", status: "Ativo", foto: "MC" },
        { id: 3, nome: "Carlos Henrique (Preto)", partido: "MDB", cargo: "Vereador", status: "Ativo", foto: "CH" },
        { id: 4, nome: "Prof. Renato Costa", partido: "PSD", cargo: "Vice-Presidente", status: "Ativo", foto: "RC" },
        { id: 5, nome: "Valdir do Sindicato", partido: "PP", cargo: "Vereador", status: "Licenciado", foto: "VS" }
    ]
};

// Função para renderizar as métricas do painel superior
function renderizarMetricas() {
    document.getElementById('count-vereadores').innerText = dadosMockados.metricas.totalVereadores;
    document.getElementById('count-partidos').innerText = dadosMockados.metricas.partidosAtivos;
    document.getElementById('count-sessoes').innerText = dadosMockados.metricas.sessoesRealizadas;
}

// Função para preencher a tabela de controle com os dados dos parlamentares
function renderizarTabela() {
    const tbody = document.getElementById('lista-vereadores');
    tbody.innerHTML = ""; // Limpa a tabela

    dadosMockados.vereadores.forEach(ver => {
        // Define a cor da badge de status baseado no estado do parlamentar
        const statusClass = ver.status === "Ativo" 
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
            : "bg-amber-500/10 text-amber-400 border-amber-500/20";

        // Cria a linha da tabela dinamicamente
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 transition-colors";
        
        tr.innerHTML = `
            <td class="py-4 px-6 flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                    ${ver.foto}
                </div>
                <span class="font-medium text-white">${ver.nome}</span>
            </td>
            <td class="py-4 px-6 text-slate-300 font-semibold">${ver.partido}</td>
            <td class="py-4 px-6 text-slate-400">${ver.cargo}</td>
            <td class="py-4 px-6">
                <span class="px-2.5 py-1 text-xs font-medium border rounded-full ${statusClass}">
                    ${ver.status}
                </span>
            </td>
            <td class="py-4 px-6 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button class="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors" title="Editar">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button class="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors" title="Desativar">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Força o Lucide a renderizar os novos ícones que foram injetados na tabela
    lucide.createIcons();
}

// Executa ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    renderizarMetricas();
    renderizarTabela();
});