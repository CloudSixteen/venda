export interface IVendaConfigProduct {
    description: string;
    orderLimit?: number;
    image: string;
    title: string;
    price: number;
    cax: {
        slotLimit: number;
        id: number;
    };
}

export interface IVendaConfig {
    discord: {
        clientId: string;
        clientSecret: string;
        scope: string;
        redirect: string;
    };
    paypal: {
        username: string;
        password: string;
        signature: string;
        return: string;
        cancel: string;
    };
    products: { [key: string]: IVendaConfigProduct };
    admins: string[];
    cax: {
        findUrl: string;
        addUrl: string;
        apiKey: string;
    };
}
