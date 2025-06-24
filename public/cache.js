
// Sistema de Cache Simples
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.timeouts = new Map();
    }

    set(key, value, ttl = 300000) { // 5 minutos padrão
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });

        // Limpar cache expirado
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
        }

        const timeout = setTimeout(() => {
            this.delete(key);
        }, ttl);

        this.timeouts.set(key, timeout);
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > item.ttl) {
            this.delete(key);
            return null;
        }

        return item.value;
    }

    delete(key) {
        this.cache.delete(key);
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
        }
    }

    clear() {
        this.cache.clear();
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts.clear();
    }

    // Cache específico para profissionais
    getProfissionais() {
        return this.get('profissionais');
    }

    setProfissionais(data) {
        this.set('profissionais', data, 600000); // 10 minutos
    }
}

window.cache = new CacheManager();
