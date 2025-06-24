
// Sistema de Metas e KPIs
class MetasManager {
    constructor() {
        this.metas = this.carregarMetas();
    }

    carregarMetas() {
        const metasDefault = {
            tempo_processamento_max: 15, // dias
            taxa_aprovacao_min: 85, // %
            valor_glosa_max: 500, // R$
            aihs_mes_min: 50 // quantidade
        };

        return JSON.parse(localStorage.getItem('metas_aih')) || metasDefault;
    }

    salvarMetas(novasMetas) {
        this.metas = { ...this.metas, ...novasMetas };
        localStorage.setItem('metas_aih', JSON.stringify(this.metas));
    }

    calcularKPIs(dados) {
        const kpis = {
            tempo_processamento: {
                valor: dados.tempo_medio_processamento || 0,
                meta: this.metas.tempo_processamento_max,
                status: (dados.tempo_medio_processamento || 0) <= this.metas.tempo_processamento_max ? 'ok' : 'alerta',
                unidade: 'dias'
            },
            taxa_aprovacao: {
                valor: dados.total_finalizadas_geral > 0 ? 
                    ((dados.total_finalizadas_geral / dados.total_aihs_geral) * 100) : 0,
                meta: this.metas.taxa_aprovacao_min,
                status: null,
                unidade: '%'
            },
            valor_glosa_medio: {
                valor: dados.valores_competencia?.media_glosa || 0,
                meta: this.metas.valor_glosa_max,
                status: (dados.valores_competencia?.media_glosa || 0) <= this.metas.valor_glosa_max ? 'ok' : 'alerta',
                unidade: 'R$'
            }
        };

        // Calcular status da taxa de aprovação
        kpis.taxa_aprovacao.status = kpis.taxa_aprovacao.valor >= kpis.taxa_aprovacao.meta ? 'ok' : 'alerta';

        return kpis;
    }

    criarWidgetMetas(kpis) {
        return `
            <div class="widget-metas">
                <h3>🎯 KPIs e Metas</h3>
                <div class="kpis-grid">
                    ${Object.entries(kpis).map(([key, kpi]) => `
                        <div class="kpi-card ${kpi.status}">
                            <div class="kpi-header">
                                <span class="kpi-nome">${this.getNomeKPI(key)}</span>
                                <span class="kpi-status">
                                    ${kpi.status === 'ok' ? '✅' : '⚠️'}
                                </span>
                            </div>
                            <div class="kpi-valor">
                                ${kpi.unidade === 'R$' ? 'R$ ' : ''}${kpi.valor.toFixed(1)}${kpi.unidade === '%' ? '%' : ''}${kpi.unidade === 'dias' ? ' dias' : ''}
                            </div>
                            <div class="kpi-meta">
                                Meta: ${kpi.unidade === 'R$' ? 'R$ ' : ''}${kpi.meta}${kpi.unidade === '%' ? '%' : ''}${kpi.unidade === 'dias' ? ' dias' : ''}
                            </div>
                            <div class="kpi-progresso">
                                <div class="progresso-barra">
                                    <div class="progresso-fill ${kpi.status}" 
                                         style="width: ${this.calcularProgresso(kpi)}%"></div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getNomeKPI(key) {
        const nomes = {
            tempo_processamento: 'Tempo Processamento',
            taxa_aprovacao: 'Taxa Aprovação',
            valor_glosa_medio: 'Valor Médio Glosa'
        };
        return nomes[key] || key;
    }

    calcularProgresso(kpi) {
        if (kpi.unidade === '%') {
            return Math.min((kpi.valor / kpi.meta) * 100, 100);
        } else if (kpi.unidade === 'dias') {
            return Math.max(100 - ((kpi.valor / kpi.meta) * 100), 0);
        } else { // R$
            return Math.max(100 - ((kpi.valor / kpi.meta) * 100), 0);
        }
    }
}

window.metas = new MetasManager();
