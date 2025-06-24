
// Sistema de Validações
class ValidacaoManager {
    constructor() {
        this.regras = {
            numeroAIH: /^\d{11}$/,
            numeroAtendimento: /^[A-Za-z0-9]{1,20}$/,
            competencia: /^\d{2}\/\d{4}$/,
            valor: /^\d+(\.\d{1,2})?$/
        };
    }

    validarNumeroAIH(numero) {
        if (!numero) return { valido: false, erro: 'Número da AIH é obrigatório' };
        if (!this.regras.numeroAIH.test(numero)) {
            return { valido: false, erro: 'Número da AIH deve ter 11 dígitos' };
        }
        return { valido: true };
    }

    validarCompetencia(competencia) {
        if (!competencia) return { valido: false, erro: 'Competência é obrigatória' };
        if (!this.regras.competencia.test(competencia)) {
            return { valido: false, erro: 'Competência deve estar no formato MM/AAAA' };
        }
        
        const [mes, ano] = competencia.split('/').map(Number);
        if (mes < 1 || mes > 12) {
            return { valido: false, erro: 'Mês deve estar entre 01 e 12' };
        }
        if (ano < 2020 || ano > new Date().getFullYear() + 1) {
            return { valido: false, erro: 'Ano inválido' };
        }
        
        return { valido: true };
    }

    validarValor(valor) {
        if (!valor) return { valido: false, erro: 'Valor é obrigatório' };
        const numValor = parseFloat(valor);
        if (isNaN(numValor) || numValor <= 0) {
            return { valido: false, erro: 'Valor deve ser maior que zero' };
        }
        if (numValor > 999999.99) {
            return { valido: false, erro: 'Valor muito alto (máximo: R$ 999.999,99)' };
        }
        return { valido: true };
    }

    adicionarValidacaoTempo(elemento) {
        let timeout;
        elemento.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.validarCampo(elemento);
            }, 500);
        });
    }

    validarCampo(elemento) {
        const valor = elemento.value;
        const tipo = elemento.dataset.validacao;
        let resultado;

        switch(tipo) {
            case 'numero-aih':
                resultado = this.validarNumeroAIH(valor);
                break;
            case 'competencia':
                resultado = this.validarCompetencia(valor);
                break;
            case 'valor':
                resultado = this.validarValor(valor);
                break;
            default:
                return;
        }

        this.mostrarFeedback(elemento, resultado);
        return resultado.valido;
    }

    mostrarFeedback(elemento, resultado) {
        // Remover feedback anterior
        const feedbackAnterior = elemento.parentNode.querySelector('.feedback-validacao');
        if (feedbackAnterior) feedbackAnterior.remove();

        if (!resultado.valido) {
            const feedback = document.createElement('div');
            feedback.className = 'feedback-validacao';
            feedback.style.cssText = `
                color: #ef4444;
                font-size: 0.875rem;
                margin-top: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
            `;
            feedback.innerHTML = `❌ ${resultado.erro}`;
            elemento.parentNode.insertBefore(feedback, elemento.nextSibling);
            
            elemento.style.borderColor = '#ef4444';
        } else {
            elemento.style.borderColor = '#10b981';
        }
    }
}

window.validacao = new ValidacaoManager();
