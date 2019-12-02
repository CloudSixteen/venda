declare namespace Express {
    export interface Request {
        i18n?: {
            setLocale(): (locale: string) => void;
            getLocale(): string;
        };
    }
}
