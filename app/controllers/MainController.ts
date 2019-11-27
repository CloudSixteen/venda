import { Router, Request, Response } from "express";
import Discord from "discord-oauth2";
import Venda from "../Venda";
import User, { IUser } from "../models/User";

class MainController {
    private _router: Router;
    private _venda: Venda;
    private _oauth: Discord;
    private _config: IVendaConfig;

    public constructor(venda: Venda, config: IVendaConfig) {
        this._venda = venda;
        this._router = Router();
        this._oauth = new Discord();
        this._config = config;

        this._router.get("/", this.getRouteHome.bind(this));
        this._router.get("/logout", this.getRouteLogout.bind(this));
        this._router.get("/login", this.getRouteLogin.bind(this));
        this._router.get("/discord/callback", this.getDiscordCallback.bind(this));
    }

    public get router(): Router {
        return this._router;
    }

    public async validateSession(req: Request): Promise<IUser> {
        if (req.session.discordToken) {
            const discordUser = await this._oauth.getUser(req.session.discordToken);

            if (discordUser) {
                return await User.findOne({
                    discordId: discordUser.id
                }).exec();
            }
        }
    }

    private async getRouteHome(req: Request, res: Response): Promise<void> {
        const user = this.validateSession(req);
        res.render("home", {
            user: user
        });
    }

    private async getRouteLogout(req: Request, res: Response): Promise<void> {
        const user = await this.validateSession(req);

        if (!user) {
            res.redirect("/");
            return;
        }

        req.session.discordToken = undefined;

        res.redirect("/");
    }

    private async getRouteLogin(req: Request, res: Response): Promise<void> {
        const CLIENT_ID = this._config.discord.clientId;
        const REDIRECT = encodeURIComponent(this._config.discord.redirect);
        const SCOPE = encodeURIComponent(this._config.discord.scope.join(" "));

        res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=${SCOPE}&response_type=code&redirect_uri=${REDIRECT}`);
    }

    private async getDiscordCallback(req: Request, res: Response): Promise<void> {
        const CLIENT_SECRET = this._config.discord.clientSecret;
        const CLIENT_ID = this._config.discord.clientId;
        const REDIRECT = this._config.discord.redirect;
        const SCOPE = this._config.discord.scope.join(" ");

        const discordToken = await this._oauth.tokenRequest({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            code: req.query.code,
            scope: SCOPE,
            grantType: "authorization_code",
            redirectUri: REDIRECT
        })

        if (discordToken) {
            const discordUser = await this._oauth.getUser(discordToken.access_token);

            if (discordUser) {
                const user = await User.findOne({
                    discordId: discordUser.id
                });

                if (!user) {
                    let newUser = new User({
                        discordId: discordUser.id,
                        email: discordUser.email,
                        transactions: []
                    });
        
                    await newUser.save();
                }

                req.session.discordToken = discordToken.access_token;
            }
        }

        res.redirect("/");
    }
}

export default MainController;
