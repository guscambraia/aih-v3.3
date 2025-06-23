// Estado da aplicação
let state = {
    token: localStorage.getItem('token'),
    usuario: null,
    aihAtual: null,
    telaAnterior: null,
    glosasPendentes: []
};

// API Helper
const api = async (endpoint, options = {}) => {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(state.token && { 'Authorization': `Bearer ${state.token}` }),
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`/api${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        
        return data;
    } catch (err) {
        console.error('Erro API:', err);
        throw err;
    }
};

// Navegação
const mostrarTela = (telaId) => {
    document.querySelectorAll('.tela').forEach(tela => {
        tela.classList.remove('ativa');
    });
    document.getElementById(telaId).classList.add('ativa');
};

const voltarTelaPrincipal = () => {
    mostrarTela('telaPrincipal');
    carregarDashboard();
};

const voltarTelaAnterior = () => {
    if (state.telaAnterior) {
        mostrarTela(state.telaAnterior);
    }
};

// Modal
const mostrarModal = (titulo, mensagem) => {
    return new Promise((resolve) => {
        const modalTitulo = document.getElementById('modalTitulo');
        const modalMensagem = document.getElementById('modalMensagem');
        const modal = document.getElementById('modal');
        
        if (!modalTitulo || !modalMensagem || !modal) {
            console.error('Elementos do modal não encontrados');
            resolve(false);
            return;
        }
        
        modalTitulo.textContent = titulo;
        modalMensagem.textContent = mensagem;
        modal.classList.add('ativo');
        
        const btnSim = document.getElementById('modalBtnSim');
        const btnNao = document.getElementById('modalBtnNao');
        
        const fecharModal = (resultado) => {
            modal.classList.remove('ativo');
            btnSim.removeEventListener('click', simHandler);
            btnNao.removeEventListener('click', naoHandler);
            resolve(resultado);
        };
        
        const simHandler = () => fecharModal(true);
        const naoHandler = () => fecharModal(false);
        
        btnSim.addEventListener('click', simHandler);
        btnNao.addEventListener('click', naoHandler);
    });
};

// Login
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const nome = document.getElementById('loginUsuario').value;
        const senha = document.getElementById('loginSenha').value;
        
        const result = await api('/login', {
            method: 'POST',
            body: JSON.stringify({ nome, senha })
        });
        
        state.token = result.token;
        state.usuario = result.usuario;
        localStorage.setItem('token', result.token);
        
        document.getElementById('nomeUsuario').textContent = result.usuario.nome;
        mostrarTela('telaPrincipal');
        carregarDashboard();
    } catch (err) {
        alert('Erro no login: ' + err.message);
    }
});

// Cadastrar usuário
document.getElementById('linkCadastrar').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const nome = prompt('Nome de usuário:');
    if (!nome) return;
    
    const senha = prompt('Senha:');
    if (!senha) return;
    
    try {
        await api('/cadastrar', {
            method: 'POST',
            body: JSON.stringify({ nome, senha })
        });
        alert('Usuário cadastrado com sucesso!');
    } catch (err) {
        alert('Erro ao cadastrar: ' + err.message);
    }
});

// Logout
document.getElementById('btnSair').addEventListener('click', () => {
    state.token = null;
    state.usuario = null;
    localStorage.removeItem('token');
    mostrarTela('telaLogin');
});

// Helpers
const getStatusDescricao = (status) => {
    const descricoes = {
        1: 'Finalizada com aprovação direta',
        2: 'Ativa com aprovação indireta',
        3: 'Ativa em discussão',
        4: 'Finalizada após discussão'
    };
    return descricoes[status] || 'Desconhecido';
};

// Obter competência atual
const getCompetenciaAtual = () => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${mes}/${ano}`;
};

// Animar números
const animarNumero = (elementId, valorFinal) => {
    const elemento = document.getElementById(elementId);
    const valorInicial = parseInt(elemento.textContent) || 0;
    const duracao = 1000; // 1 segundo
    const incremento = (valorFinal - valorInicial) / (duracao / 16);
    let valorAtual = valorInicial;
    
    const timer = setInterval(() => {
        valorAtual += incremento;
        if ((incremento > 0 && valorAtual >= valorFinal) || 
            (incremento < 0 && valorAtual <= valorFinal)) {
            valorAtual = valorFinal;
            clearInterval(timer);
        }
        elemento.textContent = Math.round(valorAtual);
    }, 16);
};

// Dashboard aprimorado
const carregarDashboard = async () => {
    try {
        const dados = await api('/dashboard');
        
        // Atualizar números principais com animação
        animarNumero('totalCadastradas', dados.total_cadastradas);
        animarNumero('emProcessamento', dados.em_processamento);
        
        // Taxa de finalização
        const finalizadas = (dados.por_status[1] || 0) + (dados.por_status[4] || 0);
        const taxaFinalizacao = dados.total_cadastradas > 0 
            ? Math.round((finalizadas / dados.total_cadastradas) * 100) 
            : 0;
        
        // Mini gráfico melhorado
        const chartDiv = document.getElementById('statusChart');
        chartDiv.innerHTML = '';
        
        const statusLabels = ['Fin.Dir.', 'At.Ind.', 'At.Disc.', 'Fin.Disc.'];
        const statusColors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        
        const maxValue = Math.max(...Object.values(dados.por_status));
        
        for (let status = 1; status <= 4; status++) {
            const valor = dados.por_status[status] || 0;
            const altura = maxValue > 0 ? (valor / maxValue) * 100 : 0;
            
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = altura + 'px';
            bar.style.background = statusColors[status - 1];
            bar.setAttribute('data-value', valor);
            bar.setAttribute('data-label', statusLabels[status - 1]);
            chartDiv.appendChild(bar);
        }
        
        // Dashboard extra com resumo
        const dashboardExtra = document.getElementById('dashboardExtra');
        if (dashboardExtra) {
            const diferencaValor = dados.valores.inicial - dados.valores.atual;
            
            dashboardExtra.innerHTML = `
                <div class="info-summary">
                    <div class="summary-item">
                        <h4>Taxa de Finalização</h4>
                        <p>${taxaFinalizacao}%</p>
                    </div>
                    <div class="summary-item">
                        <h4>Total de Glosas</h4>
                        <p>${dados.total_glosas}</p>
                    </div>
                    <div class="summary-item">
                        <h4>Valor Total Inicial</h4>
                        <p>R$ ${dados.valores.inicial.toFixed(2)}</p>
                    </div>
                    <div class="summary-item">
                        <h4>Diferença Total</h4>
                        <p style="color: ${diferencaValor > 0 ? '#ef4444' : '#10b981'}">
                            R$ ${Math.abs(diferencaValor).toFixed(2)}
                        </p>
                    </div>
                </div>
                
                ${dados.ultimas_aihs.length > 0 ? `
                    <div style="margin-top: 2rem; background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <h3 style="margin-bottom: 1rem; color: #1e293b;">📋 Últimas AIHs Cadastradas</h3>
                        <div class="lista-items">
                            ${dados.ultimas_aihs.map(aih => `
                                <div class="lista-item">
                                    <span><strong>AIH ${aih.numero_aih}</strong></span>
                                    <span class="status-badge status-${aih.status}">${getStatusDescricao(aih.status)}</span>
                                    <span style="color: #64748b; font-size: 0.875rem;">
                                        ${new Date(aih.criado_em).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        }
        
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
};

// Mostrar informações da AIH
const mostrarInfoAIH = (aih) => {
    const content = document.getElementById('infoAIHContent');
    
    // Calcular diferença de valor
    const diferencaValor = aih.valor_inicial - aih.valor_atual;
    const percentualDiferenca = ((diferencaValor / aih.valor_inicial) * 100).toFixed(1);
    
    content.innerHTML = `
        <div class="info-card">
            <h3>📋 AIH ${aih.numero_aih}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <p><strong>Status:</strong> <span class="status-badge status-${aih.status}">${getStatusDescricao(aih.status)}</span></p>
                <p><strong>Competência:</strong> ${aih.competencia}</p>
                <p><strong>Valor Inicial:</strong> R$ ${aih.valor_inicial.toFixed(2)}</p>
                <p><strong>Valor Atual:</strong> R$ ${aih.valor_atual.toFixed(2)}</p>
                <p><strong>Diferença:</strong> <span style="color: ${diferencaValor > 0 ? '#ef4444' : '#10b981'}">
                    R$ ${Math.abs(diferencaValor).toFixed(2)} (${percentualDiferenca}%)
                </span></p>
                <p><strong>Atendimentos:</strong> ${aih.atendimentos.length}</p>
            </div>
            <div style="margin-top: 1rem;">
                <strong>Números de Atendimento:</strong>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                    ${aih.atendimentos.map(at => `
                        <span style="background: #e0e7ff; color: #4f46e5; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem;">
                            ${at}
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div style="margin-top: 2rem;">
            <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                📊 Histórico de Movimentações
                <span style="background: #6366f1; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem;">
                    ${aih.movimentacoes.length}
                </span>
            </h4>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Valor</th>
                        <th>Profissionais</th>
                    </tr>
                </thead>
                <tbody>
                    ${aih.movimentacoes.map(mov => {
                        const profissionais = [];
                        if (mov.prof_medicina) profissionais.push(`Med: ${mov.prof_medicina}`);
                        if (mov.prof_enfermagem) profissionais.push(`Enf: ${mov.prof_enfermagem}`);
                        if (mov.prof_fisioterapia) profissionais.push(`Fis: ${mov.prof_fisioterapia}`);
                        if (mov.prof_bucomaxilo) profissionais.push(`Buco: ${mov.prof_bucomaxilo}`);
                        
                        return `
                            <tr>
                                <td>${new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}</td>
                                <td>
                                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${mov.tipo === 'entrada_sus' ? '📥' : '📤'}
                                        ${mov.tipo === 'entrada_sus' ? 'Entrada SUS' : 'Saída Hospital'}
                                    </span>
                                </td>
                                <td><span class="status-badge status-${mov.status_aih}">${getStatusDescricao(mov.status_aih)}</span></td>
                                <td>R$ ${(mov.valor_conta || 0).toFixed(2)}</td>
                                <td style="font-size: 0.875rem;">${profissionais.join(' | ') || '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        ${aih.glosas.length > 0 ? `
            <div style="margin-top: 2rem; background: #fef3c7; padding: 1.5rem; border-radius: 12px; border-left: 4px solid #f59e0b;">
                <h4 style="color: #92400e; margin-bottom: 1rem;">
                    ⚠️ Glosas Ativas (${aih.glosas.length})
                </h4>
                <div style="display: grid; gap: 0.75rem;">
                    ${aih.glosas.map(g => `
                        <div style="background: white; padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${g.linha}</strong> - ${g.tipo}
                                <span style="color: #64748b; font-size: 0.875rem; margin-left: 1rem;">
                                    Por: ${g.profissional}
                                </span>
                            </div>
                            <span style="font-size: 0.75rem; color: #92400e;">
                                ${new Date(g.criado_em).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
    
    mostrarTela('telaInfoAIH');
};

// Menu Principal
document.getElementById('btnInformarAIH').addEventListener('click', () => {
    mostrarTela('telaInformarAIH');
});

document.getElementById('btnBuscarAIH').addEventListener('click', () => {
    mostrarTela('telaPesquisa');
});

document.getElementById('btnBackup').addEventListener('click', async () => {
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.innerHTML = `
        <h3>🗄️ Backup e Exportação</h3>
        <p>Escolha uma opção:</p>
        <div style="display: grid; gap: 1rem; margin-top: 2rem;">
            <button onclick="fazerBackup()" 
                    style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                           padding: 1.5rem; font-size: 1.1rem; display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 2rem;">💾</span>
                <div style="text-align: left;">
                    <strong>Backup Completo</strong>
                    <br>
                    <span style="font-size: 0.875rem; opacity: 0.9;">Baixar banco de dados SQLite</span>
                </div>
            </button>
            <button onclick="exportarDados('csv')" 
                    style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                           padding: 1.5rem; font-size: 1.1rem; display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 2rem;">📄</span>
                <div style="text-align: left;">
                    <strong>Exportar CSV</strong>
                    <br>
                    <span style="font-size: 0.875rem; opacity: 0.9;">Dados em formato planilha</span>
                </div>
            </button>
            <button onclick="exportarDados('json')" 
                    style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
                           padding: 1.5rem; font-size: 1.1rem; display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 2rem;">📊</span>
                <div style="text-align: left;">
                    <strong>Exportar JSON</strong>
                    <br>
                    <span style="font-size: 0.875rem; opacity: 0.9;">Dados estruturados</span>
                </div>
            </button>
            <button onclick="document.getElementById('modal').classList.remove('ativo')" 
                    style="background: linear-gradient(135deg, #64748b 0%, #475569 100%);">
                Cancelar
            </button>
        </div>
    `;
    
    modal.classList.add('ativo');
});

document.getElementById('btnConfiguracoes').addEventListener('click', () => {
    mostrarTela('telaConfiguracoes');
    carregarProfissionais();
    carregarTiposGlosaConfig();
});

// Buscar AIH
document.getElementById('formBuscarAIH').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const numero = document.getElementById('numeroBuscarAIH').value;
    
    try {
        const aih = await api(`/aih/${numero}`);
        state.aihAtual = aih;
        
        if (aih.status === 1 || aih.status === 4) {
            const continuar = await mostrarModal(
                'AIH Finalizada',
                'Esta AIH está finalizada. É uma reassinatura/reapresentação?'
            );
            
            if (!continuar) {
                document.getElementById('numeroBuscarAIH').value = '';
                return;
            }
        }
        
        mostrarInfoAIH(aih);
    } catch (err) {
        if (err.message.includes('não encontrada')) {
            // Nova AIH
            document.getElementById('cadastroNumeroAIH').value = numero;
            state.telaAnterior = 'telaInformarAIH';
            mostrarTela('telaCadastroAIH');
        } else {
            alert('Erro: ' + err.message);
        }
    }
});

// Cadastrar AIH
document.getElementById('btnAddAtendimento').addEventListener('click', () => {
    const container = document.getElementById('atendimentosContainer');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'atendimento-input';
    input.placeholder = 'Número do atendimento';
    container.appendChild(input);
});

document.getElementById('formCadastroAIH').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const atendimentos = Array.from(document.querySelectorAll('.atendimento-input'))
        .map(input => input.value)
        .filter(val => val);
    
    if (atendimentos.length === 0) {
        alert('Informe pelo menos um número de atendimento');
        return;
    }
    
    try {
        const dados = {
            numero_aih: document.getElementById('cadastroNumeroAIH').value,
            valor_inicial: parseFloat(document.getElementById('cadastroValor').value),
            competencia: document.getElementById('cadastroCompetencia').value,
            atendimentos
        };
        
        const result = await api('/aih', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        
        alert('AIH cadastrada com sucesso!');
        
        // Buscar a AIH recém-cadastrada
        const aih = await api(`/aih/${dados.numero_aih}`);
        state.aihAtual = aih;
        mostrarInfoAIH(aih);
    } catch (err) {
        alert('Erro ao cadastrar: ' + err.message);
    }
});

// Preencher competência com o mês atual
document.getElementById('cadastroCompetencia').value = getCompetenciaAtual();

// Nova movimentação
document.getElementById('btnNovaMovimentacao').addEventListener('click', () => {
    state.telaAnterior = 'telaInfoAIH';
    mostrarTela('telaMovimentacao');
    carregarDadosMovimentacao();
});

const carregarDadosMovimentacao = async () => {
    if (!state.aihAtual) return;
    
    // Preencher campos com dados atuais
    document.getElementById('movStatus').value = state.aihAtual.status;
    document.getElementById('movCompetencia').value = state.aihAtual.competencia || getCompetenciaAtual();
    document.getElementById('movValor').value = state.aihAtual.valor_atual;
    
    // Carregar profissionais nos selects
    await carregarProfissionaisSelects();
    
    // Carregar glosas
    const listaGlosas = document.getElementById('listaGlosas');
    listaGlosas.innerHTML = state.aihAtual.glosas.map(g => `
        <div class="glosa-item">
            <span>${g.linha} - ${g.tipo} (${g.profissional}) - Qtd: ${g.quantidade || 1}</span>
        </div>
    `).join('') || '<p>Nenhuma glosa registrada</p>';
};

// Carregar profissionais nos selects
const carregarProfissionaisSelects = async () => {
    try {
        const response = await api('/profissionais');
        const profissionais = response.profissionais;
        
        // Agrupar por especialidade
        const porEspecialidade = {};
        profissionais.forEach(p => {
            if (!porEspecialidade[p.especialidade]) {
                porEspecialidade[p.especialidade] = [];
            }
            porEspecialidade[p.especialidade].push(p);
        });
        
        // Preencher selects de movimentação
        const selects = {
            'movProfMedicina': 'Medicina',
            'movProfEnfermagem': 'Enfermagem',
            'movProfFisioterapia': 'Fisioterapia',
            'movProfBucomaxilo': 'Bucomaxilo'
        };
        
        Object.entries(selects).forEach(([selectId, especialidade]) => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Selecione - ' + especialidade + '</option>';
                (porEspecialidade[especialidade] || []).forEach(prof => {
                    select.innerHTML += `<option value="${prof.nome}">${prof.nome}</option>`;
                });
            }
        });
        
        // Preencher select de pesquisa
        const pesquisaProf = document.getElementById('pesquisaProfissional');
        if (pesquisaProf) {
            pesquisaProf.innerHTML = '<option value="">Todos os profissionais</option>';
            profissionais.forEach(prof => {
                pesquisaProf.innerHTML += `<option value="${prof.nome}">${prof.nome} - ${prof.especialidade}</option>`;
            });
        }
        
        // Preencher select de glosas
        const glosaProf = document.getElementById('glosaProfissional');
        if (glosaProf) {
            glosaProf.innerHTML = '<option value="">Selecione o profissional</option>';
            profissionais.forEach(prof => {
                glosaProf.innerHTML += `<option value="${prof.nome}">${prof.nome} - ${prof.especialidade}</option>`;
            });
        }
    } catch (err) {
        console.error('Erro ao carregar profissionais:', err);
    }
};

// Gerenciar glosas
document.getElementById('btnGerenciarGlosas').addEventListener('click', () => {
    state.telaAnterior = 'telaMovimentacao';
    mostrarTela('telaPendencias');
    carregarGlosas();
});

const carregarGlosas = async () => {
    const container = document.getElementById('glosasAtuais');
    
    try {
        const response = await api(`/aih/${state.aihAtual.id}/glosas`);
        state.glosasPendentes = response.glosas;
        
        // Carregar tipos de glosa e profissionais para os selects
        await carregarTiposGlosa();
        await carregarProfissionaisSelects();
        
        container.innerHTML = response.glosas.map(g => `
            <div class="glosa-item">
                <div>
                    <strong>${g.linha}</strong> - ${g.tipo}
                    <br>
                    <span style="color: #64748b; font-size: 0.875rem;">
                        Por: ${g.profissional} | Quantidade: ${g.quantidade || 1}
                    </span>
                </div>
                <button onclick="removerGlosa(${g.id})" class="btn-danger" style="padding: 0.5rem 1rem;">
                    Remover
                </button>
            </div>
        `).join('') || '<p>Nenhuma glosa ativa</p>';
    } catch (err) {
        console.error('Erro ao carregar glosas:', err);
    }
};

// Carregar tipos de glosa
const carregarTiposGlosa = async () => {
    try {
        const response = await api('/tipos-glosa');
        const select = document.getElementById('glosaTipo');
        if (select) {
            select.innerHTML = '<option value="">Selecione o tipo de glosa</option>';
            response.tipos.forEach(tipo => {
                select.innerHTML += `<option value="${tipo.descricao}">${tipo.descricao}</option>`;
            });
        }
    } catch (err) {
        console.error('Erro ao carregar tipos de glosa:', err);
    }
};

window.removerGlosa = async (id) => {
    try {
        await api(`/glosas/${id}`, { method: 'DELETE' });
        carregarGlosas();
    } catch (err) {
        alert('Erro ao remover glosa: ' + err.message);
    }
};

// Nova glosa
document.getElementById('formNovaGlosa').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const dados = {
            linha: document.getElementById('glosaLinha').value,
            tipo: document.getElementById('glosaTipo').value,
            profissional: document.getElementById('glosaProfissional').value,
            quantidade: parseInt(document.getElementById('glosaQuantidade').value) || 1
        };
        
        await api(`/aih/${state.aihAtual.id}/glosas`, {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        
        document.getElementById('formNovaGlosa').reset();
        document.getElementById('glosaQuantidade').value = 1;
        carregarGlosas();
    } catch (err) {
        alert('Erro ao adicionar glosa: ' + err.message);
    }
});

document.getElementById('btnSalvarGlosas').addEventListener('click', () => {
    voltarTelaAnterior();
});

// Salvar movimentação
document.getElementById('formMovimentacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (state.glosasPendentes && state.glosasPendentes.length > 0) {
        const continuar = await mostrarModal(
            'Aviso',
            'Existem glosas/pendências nesta AIH. Deseja continuar sem revisar?'
        );
        
        if (!continuar) return;
    }
    
    try {
        const dados = {
            tipo: document.getElementById('movTipo').value,
            status_aih: parseInt(document.getElementById('movStatus').value),
            valor_conta: parseFloat(document.getElementById('movValor').value),
            competencia: document.getElementById('movCompetencia').value,
            prof_medicina: document.getElementById('movProfMedicina').value,
            prof_enfermagem: document.getElementById('movProfEnfermagem').value,
            prof_fisioterapia: document.getElementById('movProfFisioterapia').value,
            prof_bucomaxilo: document.getElementById('movProfBucomaxilo').value
        };
        
        await api(`/aih/${state.aihAtual.id}/movimentacao`, {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        
        alert('Movimentação registrada com sucesso!');
        
        // Recarregar AIH
        const aih = await api(`/aih/${state.aihAtual.numero_aih}`);
        state.aihAtual = aih;
        mostrarInfoAIH(aih);
    } catch (err) {
        alert('Erro ao salvar movimentação: ' + err.message);
    }
});

// Pesquisa avançada
document.getElementById('formPesquisa').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const status = Array.from(document.querySelectorAll('#formPesquisa input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));
    
    const filtros = {
        numero_aih: document.getElementById('pesquisaNumeroAIH').value,
        status,
        competencia: document.getElementById('pesquisaCompetencia').value,
        data_inicio: document.getElementById('pesquisaDataInicio').value,
        data_fim: document.getElementById('pesquisaDataFim').value,
        valor_min: document.getElementById('pesquisaValorMin').value,
        valor_max: document.getElementById('pesquisaValorMax').value,
        profissional: document.getElementById('pesquisaProfissional').value
    };
    
    // Remover filtros vazios
    Object.keys(filtros).forEach(key => {
        if (!filtros[key] || (Array.isArray(filtros[key]) && filtros[key].length === 0)) {
            delete filtros[key];
        }
    });
    
    try {
        const response = await api('/pesquisar', {
            method: 'POST',
            body: JSON.stringify({ filtros })
        });
        
        const container = document.getElementById('resultadosPesquisa');
        
        if (response.resultados.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; margin-top: 2rem;">Nenhum resultado encontrado</p>';
            return;
        }
        
        container.innerHTML = `
            <h3 style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                <span>📊 Resultados Encontrados</span>
                <span style="background: #6366f1; color: white; padding: 0.5rem 1rem; border-radius: 9999px;">
                    ${response.resultados.length} AIHs
                </span>
            </h3>
            
            <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
                ${response.resultados.map(r => `
                    <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
                                display: flex; justify-content: space-between; align-items: center; 
                                transition: all 0.3s; cursor: pointer; border: 2px solid transparent;"
                         onmouseover="this.style.borderColor='#6366f1'; this.style.transform='translateY(-2px)'"
                         onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'"
                         onclick="abrirAIH('${r.numero_aih}')">
                        <div>
                            <h4 style="color: #1e293b; margin-bottom: 0.5rem;">AIH ${r.numero_aih}</h4>
                            <div style="display: flex; gap: 2rem; color: #64748b; font-size: 0.875rem;">
                                <span>📅 ${r.competencia}</span>
                                <span>💰 R$ ${r.valor_atual.toFixed(2)}</span>
                                <span>📆 ${new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                ${r.total_glosas > 0 ? `<span>⚠️ ${r.total_glosas} glosa(s)</span>` : ''}
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <span class="status-badge status-${r.status}">${getStatusDescricao(r.status)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button onclick="exportarResultados('csv')" class="btn-success">
                    📄 Exportar CSV
                </button>
                <button onclick="exportarResultados('excel')" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                    📊 Exportar Excel
                </button>
                <button onclick="exportarResultados('json')" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
                    🔧 Exportar JSON
                </button>
                <button onclick="window.print()" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%);">
                    🖨️ Imprimir
                </button>
            </div>
        `;
    } catch (err) {
        alert('Erro na pesquisa: ' + err.message);
    }
});

window.abrirAIH = async (numero) => {
    try {
        const aih = await api(`/aih/${numero}`);
        state.aihAtual = aih;
        mostrarInfoAIH(aih);
    } catch (err) {
        alert('Erro ao abrir AIH: ' + err.message);
    }
};

window.exportarResultados = (formato) => {
    exportarDados(formato);
};

// Função para fazer backup com autenticação
window.fazerBackup = async () => {
    try {
        const response = await fetch('/api/backup', {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao fazer backup');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-aih-${new Date().toISOString().split('T')[0]}.db`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        document.getElementById('modal').classList.remove('ativo');
    } catch (err) {
        alert('Erro ao fazer backup: ' + err.message);
    }
};

// Função para exportar dados com autenticação
window.exportarDados = async (formato) => {
    try {
        const response = await fetch(`/api/export/${formato}`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar dados');
        }
        
        let filename = `export-aih-${new Date().toISOString().split('T')[0]}`;
        let blob;
        
        if (formato === 'json') {
            const data = await response.json();
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            filename += '.json';
        } else if (formato === 'excel') {
            blob = await response.blob();
            filename += '.xls';
        } else {
            blob = await response.blob();
            filename += '.csv';
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Fechar modal se estiver aberto
        const modal = document.getElementById('modal');
        if (modal.classList.contains('ativo')) {
            modal.classList.remove('ativo');
        }
    } catch (err) {
        alert('Erro ao exportar: ' + err.message);
    }
};

// Configurações - Profissionais
const carregarProfissionais = async () => {
    try {
        const response = await api('/profissionais');
        const container = document.getElementById('listaProfissionais');
        
        container.innerHTML = response.profissionais.map(p => `
            <div class="glosa-item">
                <span>${p.nome} - ${p.especialidade}</span>
                <button onclick="removerProfissional(${p.id})" class="btn-danger" style="padding: 0.25rem 0.75rem;">Remover</button>
            </div>
        `).join('') || '<p>Nenhum profissional cadastrado</p>';
    } catch (err) {
        console.error('Erro ao carregar profissionais:', err);
    }
};

window.removerProfissional = async (id) => {
    if (!confirm('Deseja remover este profissional?')) return;
    
    try {
        await api(`/profissionais/${id}`, { method: 'DELETE' });
        carregarProfissionais();
    } catch (err) {
        alert('Erro ao remover profissional: ' + err.message);
    }
};

document.getElementById('formNovoProfissional').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const dados = {
            nome: document.getElementById('profNome').value,
            especialidade: document.getElementById('profEspecialidade').value
        };
        
        await api('/profissionais', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        
        document.getElementById('formNovoProfissional').reset();
        carregarProfissionais();
    } catch (err) {
        alert('Erro ao adicionar profissional: ' + err.message);
    }
});

// Configurações - Tipos de Glosa
const carregarTiposGlosaConfig = async () => {
    try {
        const response = await api('/tipos-glosa');
        const container = document.getElementById('listaTiposGlosa');
        
        container.innerHTML = response.tipos.map(t => `
            <div class="glosa-item">
                <span>${t.descricao}</span>
                <button onclick="removerTipoGlosa(${t.id})" class="btn-danger" style="padding: 0.25rem 0.75rem;">Remover</button>
            </div>
        `).join('') || '<p>Nenhum tipo de glosa cadastrado</p>';
    } catch (err) {
        console.error('Erro ao carregar tipos de glosa:', err);
    }
};

window.removerTipoGlosa = async (id) => {
    if (!confirm('Deseja remover este tipo de glosa?')) return;
    
    try {
        await api(`/tipos-glosa/${id}`, { method: 'DELETE' });
        carregarTiposGlosaConfig();
    } catch (err) {
        alert('Erro ao remover tipo de glosa: ' + err.message);
    }
};

document.getElementById('formNovoTipoGlosa').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const dados = {
            descricao: document.getElementById('tipoGlosaDescricao').value
        };
        
        await api('/tipos-glosa', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        
        document.getElementById('formNovoTipoGlosa').reset();
        carregarTiposGlosaConfig();
    } catch (err) {
        alert('Erro ao adicionar tipo de glosa: ' + err.message);
    }
});

// Relatórios
document.getElementById('btnRelatorios').addEventListener('click', () => {
    mostrarTela('telaRelatorios');
    document.getElementById('resultadoRelatorio').innerHTML = '';
});

window.gerarRelatorio = async (tipo) => {
    try {
        const response = await api(`/relatorios/${tipo}`);
        const container = document.getElementById('resultadoRelatorio');
        
        let conteudo = '';
        
        switch(tipo) {
            case 'acessos':
                conteudo = `
                    <div class="relatorio-content">
                        <h3>
                            👥 Relatório de Acessos ao Sistema
                            <button onclick="exportarRelatorio('${tipo}')" class="btn-success" style="font-size: 0.875rem;">
                                Exportar Excel
                            </button>
                        </h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Usuário</th>
                                    <th>Total de Acessos</th>
                                    <th>Último Acesso</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${response.resultado.map(r => `
                                    <tr>
                                        <td>${r.nome}</td>
                                        <td>${r.total_acessos}</td>
                                        <td>${new Date(r.ultimo_acesso).toLocaleString('pt-BR')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                break;
                
            case 'glosas-profissional':
                conteudo = `
                    <div class="relatorio-content">
                        <h3>
                            📋 Glosas por Profissional
                            <button onclick="exportarRelatorio('${tipo}')" class="btn-success" style="font-size: 0.875rem;">
                                Exportar Excel
                            </button>
                        </h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Profissional</th>
                                    <th>Total de Glosas</th>
                                    <th>Quantidade de Itens</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${response.resultado.map(r => `
                                    <tr>
                                        <td>${r.profissional}</td>
                                        <td>${r.total_glosas}</td>
                                        <td>${r.total_itens}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                break;
                
            case 'aihs-profissional':
                conteudo = `
                    <div class="relatorio-content">
                        <h3>
                            🏥 AIHs Auditadas por Profissional
                            <button onclick="exportarRelatorio('${tipo}')" class="btn-success" style="font-size: 0.875rem;">
                                Exportar Excel
                            </button>
                        </h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Profissional</th>
                                    <th>Total de AIHs</th>
                                    <th>Total de Movimentações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${response.resultado.map(r => `
                                    <tr>
                                        <td>${r.profissional}</td>
                                        <td>${r.total_aihs}</td>
                                        <td>${r.total_movimentacoes}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                break;
                
            case 'aprovacoes':
                const dados = response.resultado[0];
                const total = dados.total || 1;
                conteudo = `
                    <div class="relatorio-content">
                        <h3>
                            ✅ Estatísticas de Aprovações
                            <button onclick="exportarRelatorio('${tipo}')" class="btn-success" style="font-size: 0.875rem;">
                                Exportar Excel
                            </button>
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
                            <div class="stat-card">
                                <h4>Aprovação Direta</h4>
                                <p class="stat-number">${dados.aprovacao_direta}</p>
                                <p class="stat-subtitle">${((dados.aprovacao_direta/total)*100).toFixed(1)}%</p>
                            </div>
                            <div class="stat-card">
                                <h4>Aprovação Indireta</h4>
                                <p class="stat-number">${dados.aprovacao_indireta}</p>
                                <p class="stat-subtitle">${((dados.aprovacao_indireta/total)*100).toFixed(1)}%</p>
                            </div>
                            <div class="stat-card">
                                <h4>Em Discussão</h4>
                                <p class="stat-number">${dados.em_discussao}</p>
                                <p class="stat-subtitle">${((dados.em_discussao/total)*100).toFixed(1)}%</p>
                            </div>
                            <div class="stat-card">
                                <h4>Finalizada Pós-Discussão</h4>
                                <p class="stat-number">${dados.finalizada_pos_discussao}</p>
                                <p class="stat-subtitle">${((dados.finalizada_pos_discussao/total)*100).toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'tipos-glosa':
                conteudo = `
                    <div class="relatorio-content">
                        <h3>
                            📊 Tipos de Glosa Mais Frequentes
                            <button onclick="exportarRelatorio('${tipo}')" class="btn-success" style="font-size: 0.875rem;">
                                Exportar Excel
                            </button>
                        </h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Tipo de Glosa</th>
                                    <th>Total de Ocorrências</th>
                                    <th>Quantidade Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${response.resultado.map(r => `
                                    <tr>
                                        <td>${r.tipo}</td>
                                        <td>${r.total}</td>
                                        <td>${r.quantidade_total}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                break;
                
            case 'analise-preditiva':
                const pred = response.resultado;
                conteudo = `
                    <div class="relatorio-content">
                        <h3>🔮 Análise Preditiva</h3>
                        <div style="display: grid; gap: 1.5rem; margin-top: 1.5rem;">
                            <div class="info-card">
                                <h4>Tempo Médio de Processamento</h4>
                                <p style="font-size: 2rem; font-weight: bold; color: var(--primary);">
                                    ${pred.tempo_medio_processamento} dias
                                </p>
                                <p style="color: #64748b;">Média de dias para finalizar AIHs</p>
                            </div>
                            
                            <div class="info-card">
                                <h4>Valor Médio de Glosas</h4>
                                <p style="font-size: 2rem; font-weight: bold; color: var(--danger);">
                                    R$ ${pred.valor_medio_glosa.toFixed(2)}
                                </p>
                                <p style="color: #64748b;">Valor médio perdido por AIH com glosa</p>
                            </div>
                            
                            <div class="info-card">
                                <h4>Tendência de Glosas (Últimos 6 meses)</h4>
                                <div style="display: flex; gap: 1rem; align-items: flex-end; height: 100px; margin-top: 1rem;">
                                    ${pred.tendencia_glosas.map(t => `
                                        <div style="flex: 1; background: var(--primary); height: ${(t.total/Math.max(...pred.tendencia_glosas.map(x => x.total)))*100}px;
                                                    border-radius: 4px 4px 0 0; position: relative;">
                                            <span style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%);
                                                         font-size: 0.75rem; color: #64748b; white-space: nowrap;">
                                                ${t.mes}
                                            </span>
                                            <span style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%);
                                                         font-size: 0.875rem; font-weight: 600; color: var(--primary);">
                                                ${t.total}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="info-card">
                                <h4>Previsão</h4>
                                <p>${pred.previsao}</p>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        container.innerHTML = conteudo;
        container.scrollIntoView({ behavior: 'smooth' });
        
    } catch (err) {
        alert('Erro ao gerar relatório: ' + err.message);
    }
};

window.exportarRelatorio = async (tipo) => {
    try {
        const response = await fetch(`/api/relatorios/${tipo}/export`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar relatório');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        alert('Erro ao exportar relatório: ' + err.message);
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se tem token
    if (state.token) {
        // Pequeno delay para garantir que o DOM está pronto
        setTimeout(() => {
            mostrarTela('telaPrincipal');
            carregarDashboard();
            carregarProfissionaisSelects();
        }, 100);
    } else {
        mostrarTela('telaLogin');
    }
    
    // Preencher competência padrão nos formulários
    const camposCompetencia = ['cadastroCompetencia', 'movCompetencia', 'pesquisaCompetencia'];
    camposCompetencia.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && !campo.value) {
            campo.value = getCompetenciaAtual();
        }
    });
});