interface NetworkDetails {
    network: string;
    networkUrl: string;
    networkPassphrase: string;
    sorobanRpcUrl?: string;
}

export class FreighterService {
    private static instance: FreighterService;
    private _isConnected = false;
    private _publicKey = '';
    private _networkDetails: NetworkDetails | null = null;

    private constructor() {}

    static getInstance() {
        if (!FreighterService.instance) {
            FreighterService.instance = new FreighterService();
        }
        return FreighterService.instance;
    }

    private waitForFreighter(): Promise<boolean> {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10;
            const check = () => {
                const hasFreighter = !!(
                    (window as any).freighter || 
                    (window as any).freighterApi ||
                    (window.self !== window.top && (window.parent as any).freighter)
                );
                console.log('Estado de Freighter:', {
                    freighter: !!(window as any).freighter,
                    freighterApi: !!(window as any).freighterApi,
                    hasFreighter,
                    attempt: attempts + 1
                });
                if (hasFreighter && (window as any).freighterApi) {
                    resolve(true);
                    return;
                }
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 1000);
                } else {
                    resolve(false);
                }
            };
            check();
        });
    }

    async checkConnection(): Promise<boolean> {
        try {
            if (typeof window === 'undefined') {
                console.log('Window no disponible');
                return false;
            }

            const isAvailable = await this.waitForFreighter();
            if (!isAvailable) {
                console.log('Freighter no está disponible después de esperar');
                return false;
            }

            const freighterApi = (window as any).freighterApi;
            const isConnected = await freighterApi.isConnected();
            
            console.log('Estado de conexión:', {
                isAvailable,
                isConnected,
                hasPublicKey: !!this._publicKey
            });

            this._isConnected = isConnected;
            return isConnected;
        } catch (e) {
            console.error('Error al verificar la conexión:', e);
            return false;
        }
    }

    async connect(): Promise<{ success: boolean; message: string }> {
        try {
            const isAvailable = await this.waitForFreighter();
            if (!isAvailable) {
                return {
                    success: false,
                    message: 'Freighter no está disponible. Por favor instala la extensión y recarga la página.'
                };
            }

            const freighterApi = (window as any).freighterApi;
            
            const { isAllowed } = await freighterApi.isAllowed();
            if (!isAllowed) {
                const result = await freighterApi.requestAccess();
                if (!result) {
                    return {
                        success: false,
                        message: 'Permiso denegado'
                    };
                }
            }

            const networkDetails = await freighterApi.getNetworkDetails();
            this._networkDetails = networkDetails;

            if (networkDetails.network !== 'TESTNET') {
                return {
                    success: false,
                    message: 'Por favor cambia a la red TESTNET en Freighter'
                };
            }

            const { address } = await freighterApi.getAddress();
            this._publicKey = address;
            this._isConnected = true;

            const event = new CustomEvent('walletConnected', {
                detail: { publicKey: address, network: networkDetails.network }
            });
            window.dispatchEvent(event);

            return {
                success: true,
                message: 'Wallet conectada exitosamente'
            };
        } catch (error) {
            console.error('Error al conectar:', error);
            return {
                success: false,
                message: 'Error al conectar con Freighter'
            };
        }
    }

    async signTransaction(xdr: string): Promise<{ signed?: string; error?: string }> {
        try {
            if (!this._isConnected || !this._networkDetails) {
                return { error: 'Wallet no conectada' };
            }

            const freighterApi = (window as any).freighterApi;
            const result = await freighterApi.signTransaction(xdr, {
                networkPassphrase: this._networkDetails.networkPassphrase
            });

            return { signed: result.signedXDR };
        } catch (error) {
            console.error('Error al firmar:', error);
            return { 
                error: error instanceof Error ? error.message : 'Error al firmar la transacción'
            };
        }
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    get publicKey(): string {
        return this._publicKey;
    }

    get networkDetails(): NetworkDetails | null {
        return this._networkDetails;
    }
}

export const freighterService = FreighterService.getInstance();