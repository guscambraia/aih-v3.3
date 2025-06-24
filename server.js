const express = require('express');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const { initDB, run, get, all } = require('./database');
const { verificarToken, login, cadastrarUsuario } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar banco
initDB();

// Middleware para logs
const logAcao = async (usuarioId, acao) => {
    await run('INSERT INTO logs_acesso (usuario_id, acao) VALUES (?, ?)', [usuarioId, acao]);
};

// Rotas de autenticação
app.post('/api/login', async (req, res) => {
    try {
        const { nome, senha } = req.body;
        const result = await login(nome, senha);
        await logAcao(result.usuario.id, 'Login');
        res.json(result);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

app.post('/api/cadastrar', async (req, res) => {
    try {
        const { nome, senha } = req.body;
        await cadastrarUsuario(nome, senha);
        res.json({ success: true, message: 'Usuário criado' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Dashboard aprimorado com filtro por competência
app.get('/api/dashboard', verificarToken, async (req, res) => {
    try {
        // Pegar competência da query ou usar atual
        const competencia = req.query.competencia || getCompetenciaAtual();
        
        // 1. AIH em processamento na competência
        // (entrada_sus - saida_hospital) na competência específica
        const entradasSUS = await get(`
            SELECT COUNT(DISTINCT m.aih_id) as count 
            FROM movimentacoes m
            WHERE m.tipo = 'entrada_sus' 
            AND m.competencia = ?
        `, [competencia]);
        
        const saidasHospital = await get(`
            SELECT COUNT(DISTINCT m.aih_id) as count 
            FROM movimentacoes m
            WHERE m.tipo = 'saida_hospital' 
            AND m.competencia = ?
        `, [competencia]);
        
        const emProcessamentoCompetencia = (entradasSUS.count || 0) - (saidasHospital.count || 0);
        
        // 2. AIH finalizadas na competência (status 1 e 4)
        const finalizadasCompetencia = await get(`
            SELECT COUNT(*) as count 
            FROM aihs 
            WHERE status IN (1, 4) 
            AND competencia = ?
        `, [competencia]);
        
        // 3. AIH com pendências/glosas na competência (status 2 e 3)
        const comPendenciasCompetencia = await get(`
            SELECT COUNT(*) as count 
            FROM aihs 
            WHERE status IN (2, 3) 
            AND competencia = ?
        `, [competencia]);
        
        // 4. Total geral de entradas SUS vs saídas Hospital (desde o início)
        const totalEntradasSUS = await get(`
            SELECT COUNT(DISTINCT aih_id) as count 
            FROM movimentacoes 
            WHERE tipo = 'entrada_sus'
        `);
        
        const totalSaidasHospital = await get(`
            SELECT COUNT(DISTINCT aih_id) as count 
            FROM movimentacoes 
            WHERE tipo = 'saida_hospital'
        `);
        
        const totalEmProcessamento = (totalEntradasSUS.count || 0) - (totalSaidasHospital.count || 0);
        
        // 5. Total de AIHs finalizadas desde o início (status 1 e 4)
        const totalFinalizadasGeral = await get(`
            SELECT COUNT(*) as count 
            FROM aihs 
            WHERE status IN (1, 4)
        `);
        
        // 6. Total de AIHs cadastradas desde o início
        const totalAIHsGeral = await get(`
            SELECT COUNT(*) as count 
            FROM aihs
        `);
        
        // Dados adicionais para contexto
        const totalAIHsCompetencia = await get(`
            SELECT COUNT(*) as count 
            FROM aihs 
            WHERE competencia = ?
        `, [competencia]);
        
        // Lista de competências disponíveis
        const competenciasDisponiveis = await all(`
            SELECT DISTINCT competencia 
            FROM aihs 
            ORDER BY 
                CAST(SUBSTR(competencia, 4, 4) AS INTEGER) DESC,
                CAST(SUBSTR(competencia, 1, 2) AS INTEGER) DESC
        `);
        
        // Estatísticas de valores para a competência
        const valoresCompetencia = await get(`
            SELECT 
                SUM(valor_inicial) as valor_inicial_total,
                SUM(valor_atual) as valor_atual_total,
                AVG(valor_inicial - valor_atual) as media_glosa
            FROM aihs 
            WHERE competencia = ?
        `, [competencia]);
        
        res.json({
            competencia_selecionada: competencia,
            competencias_disponiveis: competenciasDisponiveis.map(c => c.competencia),
            
            // Métricas da competência
            em_processamento_competencia: emProcessamentoCompetencia,
            finalizadas_competencia: finalizadasCompetencia.count,
            com_pendencias_competencia: comPendenciasCompetencia.count,
            total_aihs_competencia: totalAIHsCompetencia.count,
            
            // Métricas gerais (desde o início)
            total_entradas_sus: totalEntradasSUS.count,
            total_saidas_hospital: totalSaidasHospital.count,
            total_em_processamento_geral: totalEmProcessamento,
            total_finalizadas_geral: totalFinalizadasGeral.count,
            total_aihs_geral: totalAIHsGeral.count,
            
            // Valores financeiros da competência
            valores_competencia: {
                inicial: valoresCompetencia.valor_inicial_total || 0,
                atual: valoresCompetencia.valor_atual_total || 0,
                media_glosa: valoresCompetencia.media_glosa || 0
            }
        });
    } catch (err) {
        console.error('Erro no dashboard:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper para obter competência atual
const getCompetenciaAtual = () => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${mes}/${ano}`;
};

// Buscar AIH
app.get('/api/aih/:numero', verificarToken, async (req, res) => {
    try {
        const aih = await get(
            'SELECT * FROM aihs WHERE numero_aih = ?',
            [req.params.numero]
        );
        
        if (!aih) {
            return res.status(404).json({ error: 'AIH não encontrada' });
        }
        
        const atendimentos = await all(
            'SELECT numero_atendimento FROM atendimentos WHERE aih_id = ?',
            [aih.id]
        );
        
        const movimentacoes = await all(
            'SELECT * FROM movimentacoes WHERE aih_id = ? ORDER BY data_movimentacao DESC',
            [aih.id]
        );
        
        const glosas = await all(
            'SELECT * FROM glosas WHERE aih_id = ? AND ativa = 1',
            [aih.id]
        );
        
        res.json({
            ...aih,
            atendimentos: atendimentos.map(a => a.numero_atendimento),
            movimentacoes,
            glosas
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cadastrar AIH
app.post('/api/aih', verificarToken, async (req, res) => {
    try {
        const { numero_aih, valor_inicial, competencia, atendimentos } = req.body;
        
        // Verificar se já existe
        const existe = await get('SELECT id FROM aihs WHERE numero_aih = ?', [numero_aih]);
        if (existe) {
            return res.status(400).json({ error: 'AIH já cadastrada' });
        }
        
        // Inserir AIH com status 3 (Ativa em discussão)
        const result = await run(
            `INSERT INTO aihs (numero_aih, valor_inicial, valor_atual, competencia, usuario_cadastro_id, status) 
             VALUES (?, ?, ?, ?, ?, 3)`,
            [numero_aih, valor_inicial, valor_inicial, competencia, req.usuario.id]
        );
        
        // Inserir atendimentos
        for (const atend of atendimentos) {
            await run(
                'INSERT INTO atendimentos (aih_id, numero_atendimento) VALUES (?, ?)',
                [result.id, atend]
            );
        }
        
        // Primeira movimentação (entrada SUS)
        await run(
            `INSERT INTO movimentacoes (aih_id, tipo, usuario_id, valor_conta, competencia, status_aih, observacoes) 
             VALUES (?, 'entrada_sus', ?, ?, ?, 3, ?)`,
            [result.id, req.usuario.id, valor_inicial, competencia, 'Entrada inicial no sistema']
        );
        
        await logAcao(req.usuario.id, `Cadastrou AIH ${numero_aih}`);
        res.json({ success: true, id: result.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Nova movimentação
app.post('/api/aih/:id/movimentacao', verificarToken, async (req, res) => {
    try {
        const aihId = req.params.id;
        const {
            tipo, status_aih, valor_conta, competencia,
            prof_medicina, prof_enfermagem, prof_fisioterapia, prof_bucomaxilo, observacoes
        } = req.body;
        
        // Inserir movimentação
        await run(
            `INSERT INTO movimentacoes 
             (aih_id, tipo, usuario_id, valor_conta, competencia, 
              prof_medicina, prof_enfermagem, prof_fisioterapia, prof_bucomaxilo, status_aih, observacoes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [aihId, tipo, req.usuario.id, valor_conta, competencia,
             prof_medicina, prof_enfermagem, prof_fisioterapia, prof_bucomaxilo, status_aih, observacoes]
        );
        
        // Atualizar AIH
        await run(
            'UPDATE aihs SET status = ?, valor_atual = ? WHERE id = ?',
            [status_aih, valor_conta, aihId]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Glosas
app.get('/api/aih/:id/glosas', verificarToken, async (req, res) => {
    try {
        const glosas = await all(
            'SELECT * FROM glosas WHERE aih_id = ? AND ativa = 1',
            [req.params.id]
        );
        res.json({ glosas });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/aih/:id/glosas', verificarToken, async (req, res) => {
    try {
        const { linha, tipo, profissional, quantidade } = req.body;
        const result = await run(
            'INSERT INTO glosas (aih_id, linha, tipo, profissional, quantidade) VALUES (?, ?, ?, ?, ?)',
            [req.params.id, linha, tipo, profissional, quantidade || 1]
        );
        res.json({ success: true, id: result.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/glosas/:id', verificarToken, async (req, res) => {
    try {
        await run('UPDATE glosas SET ativa = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tipos de Glosa
app.get('/api/tipos-glosa', verificarToken, async (req, res) => {
    try {
        const tipos = await all('SELECT * FROM tipos_glosa ORDER BY descricao');
        res.json({ tipos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tipos-glosa', verificarToken, async (req, res) => {
    try {
        const { descricao } = req.body;
        const result = await run('INSERT INTO tipos_glosa (descricao) VALUES (?)', [descricao]);
        res.json({ success: true, id: result.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tipos-glosa/:id', verificarToken, async (req, res) => {
    try {
        await run('DELETE FROM tipos_glosa WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pesquisa avançada
app.post('/api/pesquisar', verificarToken, async (req, res) => {
    try {
        const { filtros } = req.body;
        let sql = `SELECT a.*, COUNT(g.id) as total_glosas 
                   FROM aihs a 
                   LEFT JOIN glosas g ON a.id = g.aih_id AND g.ativa = 1 
                   WHERE 1=1`;
        const params = [];
        
        if (filtros.status?.length) {
            sql += ` AND a.status IN (${filtros.status.map(() => '?').join(',')})`;
            params.push(...filtros.status);
        }
        
        if (filtros.competencia) {
            sql += ' AND a.competencia = ?';
            params.push(filtros.competencia);
        }
        
        if (filtros.data_inicio) {
            sql += ' AND a.criado_em >= ?';
            params.push(filtros.data_inicio);
        }
        
        if (filtros.data_fim) {
            sql += ' AND a.criado_em <= ?';
            params.push(filtros.data_fim + ' 23:59:59');
        }
        
        if (filtros.valor_min) {
            sql += ' AND a.valor_atual >= ?';
            params.push(filtros.valor_min);
        }
        
        if (filtros.valor_max) {
            sql += ' AND a.valor_atual <= ?';
            params.push(filtros.valor_max);
        }
        
        if (filtros.numero_aih) {
            sql += ' AND a.numero_aih LIKE ?';
            params.push(`%${filtros.numero_aih}%`);
        }
        
        if (filtros.profissional) {
            sql += ` AND a.id IN (
                SELECT DISTINCT aih_id FROM movimentacoes 
                WHERE prof_medicina LIKE ? OR prof_enfermagem LIKE ? 
                OR prof_fisioterapia LIKE ? OR prof_bucomaxilo LIKE ?
            )`;
            const prof = `%${filtros.profissional}%`;
            params.push(prof, prof, prof, prof);
        }
        
        sql += ' GROUP BY a.id ORDER BY a.criado_em DESC';
        
        const resultados = await all(sql, params);
        res.json({ resultados });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Profissionais
app.get('/api/profissionais', verificarToken, async (req, res) => {
    try {
        const profissionais = await all('SELECT * FROM profissionais');
        res.json({ profissionais });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profissionais', verificarToken, async (req, res) => {
    try {
        const { nome, especialidade } = req.body;
        const result = await run(
            'INSERT INTO profissionais (nome, especialidade) VALUES (?, ?)',
            [nome, especialidade]
        );
        res.json({ success: true, id: result.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/profissionais/:id', verificarToken, async (req, res) => {
    try {
        await run('DELETE FROM profissionais WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Backup
app.get('/api/backup', verificarToken, (req, res) => {
    const dbPath = path.join(__dirname, 'db', 'aih.db');
    res.download(dbPath, `backup-aih-${new Date().toISOString().split('T')[0]}.db`);
});

// Export melhorado
app.get('/api/export/:formato', verificarToken, async (req, res) => {
    try {
        const aihs = await all(`
            SELECT a.*, COUNT(g.id) as total_glosas,
                   GROUP_CONCAT(DISTINCT at.numero_atendimento) as atendimentos
            FROM aihs a
            LEFT JOIN glosas g ON a.id = g.aih_id AND g.ativa = 1
            LEFT JOIN atendimentos at ON a.id = at.aih_id
            GROUP BY a.id
        `);
        
        if (req.params.formato === 'json') {
            res.json(aihs);
        } else if (req.params.formato === 'csv') {
            const csv = [
                'numero_aih,valor_inicial,valor_atual,status,competencia,total_glosas,atendimentos,criado_em',
                ...aihs.map(a => 
                    `${a.numero_aih},${a.valor_inicial},${a.valor_atual},${a.status},${a.competencia},${a.total_glosas},"${a.atendimentos || ''}",${a.criado_em}`
                )
            ].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=export-aih.csv');
            res.send(csv);
        } else if (req.params.formato === 'excel') {
            // Criar workbook Excel real (XLSX)
            const worksheet = XLSX.utils.json_to_sheet(aihs.map(a => ({
                'Número AIH': a.numero_aih,
                'Valor Inicial': a.valor_inicial,
                'Valor Atual': a.valor_atual,
                'Status': getStatusExcel(a.status),
                'Competência': a.competencia,
                'Total Glosas/Pendências': a.total_glosas,
                'Atendimentos': a.atendimentos || '',
                'Criado em': new Date(a.criado_em).toLocaleDateString('pt-BR')
            })));
            
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'AIHs');
            
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=export-aih.xlsx');
            res.send(buffer);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper para status no Excel
const getStatusExcel = (status) => {
    const statusMap = {
        1: 'Finalizada com aprovação direta',
        2: 'Ativa com aprovação indireta',
        3: 'Ativa em discussão',
        4: 'Finalizada após discussão'
    };
    return statusMap[status] || 'Desconhecido';
};

// Relatórios
app.get('/api/relatorios/:tipo', verificarToken, async (req, res) => {
    try {
        const tipo = req.params.tipo;
        let resultado = {};
        
        switch(tipo) {
            case 'acessos':
                resultado = await all(`
                    SELECT u.nome, COUNT(l.id) as total_acessos, 
                           MAX(l.data_hora) as ultimo_acesso
                    FROM logs_acesso l
                    JOIN usuarios u ON l.usuario_id = u.id
                    WHERE l.acao = 'Login'
                    GROUP BY u.id
                    ORDER BY total_acessos DESC
                `);
                break;
                
            case 'glosas-profissional':
                resultado = await all(`
                    SELECT profissional, COUNT(*) as total_glosas,
                           SUM(quantidade) as total_itens
                    FROM glosas
                    WHERE ativa = 1
                    GROUP BY profissional
                    ORDER BY total_glosas DESC
                `);
                break;
                
            case 'aihs-profissional':
                resultado = await all(`
                    SELECT 
                        COALESCE(prof_medicina, prof_enfermagem, prof_fisioterapia, prof_bucomaxilo) as profissional,
                        COUNT(DISTINCT aih_id) as total_aihs,
                        COUNT(*) as total_movimentacoes
                    FROM movimentacoes
                    WHERE prof_medicina IS NOT NULL 
                       OR prof_enfermagem IS NOT NULL 
                       OR prof_fisioterapia IS NOT NULL 
                       OR prof_bucomaxilo IS NOT NULL
                    GROUP BY profissional
                    ORDER BY total_aihs DESC
                `);
                break;
                
            case 'aprovacoes':
                resultado = await all(`
                    SELECT 
                        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as aprovacao_direta,
                        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as aprovacao_indireta,
                        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as em_discussao,
                        SUM(CASE WHEN status = 4 THEN 1 ELSE 0 END) as finalizada_pos_discussao,
                        COUNT(*) as total
                    FROM aihs
                `);
                break;
                
            case 'tipos-glosa':
                resultado = await all(`
                    SELECT tipo, COUNT(*) as total, SUM(quantidade) as quantidade_total
                    FROM glosas
                    WHERE ativa = 1
                    GROUP BY tipo
                    ORDER BY total DESC
                `);
                break;
                
            case 'analise-preditiva':
                const mediaTempo = await get(`
                    SELECT AVG(JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(criado_em)) as media_dias
                    FROM aihs WHERE status IN (1, 4)
                `);
                
                const tendenciaGlosas = await all(`
                    SELECT strftime('%Y-%m', criado_em) as mes, COUNT(*) as total
                    FROM glosas
                    WHERE ativa = 1
                    GROUP BY mes
                    ORDER BY mes DESC
                    LIMIT 6
                `);
                
                const valorMedioGlosa = await get(`
                    SELECT AVG(a.valor_inicial - a.valor_atual) as valor_medio
                    FROM aihs a
                    WHERE EXISTS (SELECT 1 FROM glosas g WHERE g.aih_id = a.id AND g.ativa = 1)
                `);
                
                resultado = {
                    tempo_medio_processamento: Math.round(mediaTempo.media_dias || 0),
                    tendencia_glosas: tendenciaGlosas,
                    valor_medio_glosa: valorMedioGlosa.valor_medio || 0,
                    previsao: "Com base nos dados, espera-se manter a média de processamento"
                };
                break;
        }
        
        res.json({ tipo, resultado });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exportar relatórios
app.get('/api/relatorios/:tipo/export', verificarToken, async (req, res) => {
    try {
        const tipo = req.params.tipo;
        let dados = [];
        let nomeArquivo = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}`;
        
        switch(tipo) {
            case 'acessos':
                dados = await all(`
                    SELECT u.nome as Usuario, COUNT(l.id) as 'Total Acessos', 
                           MAX(l.data_hora) as 'Ultimo Acesso'
                    FROM logs_acesso l
                    JOIN usuarios u ON l.usuario_id = u.id
                    WHERE l.acao = 'Login'
                    GROUP BY u.id
                    ORDER BY COUNT(l.id) DESC
                `);
                break;
                
            case 'glosas-profissional':
                dados = await all(`
                    SELECT profissional as Profissional, 
                           COUNT(*) as 'Total Glosas',
                           SUM(quantidade) as 'Quantidade Total'
                    FROM glosas
                    WHERE ativa = 1
                    GROUP BY profissional
                    ORDER BY COUNT(*) DESC
                `);
                break;
                
            case 'aihs-profissional':
                dados = await all(`
                    SELECT 
                        COALESCE(prof_medicina, prof_enfermagem, prof_fisioterapia, prof_bucomaxilo) as Profissional,
                        COUNT(DISTINCT aih_id) as 'Total AIHs',
                        COUNT(*) as 'Total Movimentacoes'
                    FROM movimentacoes
                    WHERE prof_medicina IS NOT NULL 
                       OR prof_enfermagem IS NOT NULL 
                       OR prof_fisioterapia IS NOT NULL 
                       OR prof_bucomaxilo IS NOT NULL
                    GROUP BY Profissional
                    ORDER BY COUNT(DISTINCT aih_id) DESC
                `);
                break;
                
            case 'aprovacoes':
                const aprovacoes = await get(`
                    SELECT 
                        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as aprovacao_direta,
                        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as aprovacao_indireta,
                        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as em_discussao,
                        SUM(CASE WHEN status = 4 THEN 1 ELSE 0 END) as finalizada_pos_discussao,
                        COUNT(*) as total
                    FROM aihs
                `);
                dados = [
                    { Tipo: 'Aprovação Direta', Quantidade: aprovacoes.aprovacao_direta, Percentual: ((aprovacoes.aprovacao_direta/aprovacoes.total)*100).toFixed(1) + '%' },
                    { Tipo: 'Aprovação Indireta', Quantidade: aprovacoes.aprovacao_indireta, Percentual: ((aprovacoes.aprovacao_indireta/aprovacoes.total)*100).toFixed(1) + '%' },
                    { Tipo: 'Em Discussão', Quantidade: aprovacoes.em_discussao, Percentual: ((aprovacoes.em_discussao/aprovacoes.total)*100).toFixed(1) + '%' },
                    { Tipo: 'Finalizada Pós-Discussão', Quantidade: aprovacoes.finalizada_pos_discussao, Percentual: ((aprovacoes.finalizada_pos_discussao/aprovacoes.total)*100).toFixed(1) + '%' }
                ];
                break;
                
            case 'tipos-glosa':
                dados = await all(`
                    SELECT tipo as 'Tipo de Glosa', 
                           COUNT(*) as 'Total Ocorrencias', 
                           SUM(quantidade) as 'Quantidade Total'
                    FROM glosas
                    WHERE ativa = 1
                    GROUP BY tipo
                    ORDER BY COUNT(*) DESC
                `);
                break;
        }
        
        if (dados.length === 0) {
            return res.status(404).json({ error: 'Nenhum dado encontrado' });
        }
        
        // Criar Excel real (XLSX)
        const worksheet = XLSX.utils.json_to_sheet(dados);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, tipo.charAt(0).toUpperCase() + tipo.slice(1));
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}.xlsx`);
        res.send(buffer);
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Servir SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});