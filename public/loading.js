
// Sistema de Loading
class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
    }

    show(target = document.body, message = 'Carregando...') {
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.style.cssText = `
            position: ${target === document.body ? 'fixed' : 'absolute'};
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;

        loader.innerHTML = `
            <div style="text-align: center; color: #6366f1;">
                <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; 
                           border-top: 4px solid #6366f1; border-radius: 50%; 
                           animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
                <p style="margin: 0; font-weight: 500;">${message}</p>
            </div>
        `;

        // Adicionar CSS de animação se não existir
        if (!document.getElementById('loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        target.style.position = target === document.body ? 'relative' : 'relative';
        target.appendChild(loader);
        this.activeLoaders.add(loader);

        return {
            hide: () => {
                loader.remove();
                this.activeLoaders.delete(loader);
            }
        };
    }

    hideAll() {
        this.activeLoaders.forEach(loader => loader.remove());
        this.activeLoaders.clear();
    }
}

window.loading = new LoadingManager();
