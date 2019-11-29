import { Router, Request, Response } from "express";
import { Client, Message, TextChannel, Channel } from "discord.js";
import DiscordAuth from "discord-oauth2";
import Venda from "../Venda";
import User, { IUser } from "../models/User";
import { IVendaConfig, IVendaConfigProduct } from "../IVendaConfig";
import PayPal from "paypal-express-checkout";
import Transaction from "../models/Transaction";
import HttpRequest from "request-promise";
import { ICAXResponse } from "../ICAXResponse";

class MainController {
    private _router: Router;
    private _venda: Venda;
    private _auth: DiscordAuth;
    private _config: IVendaConfig;
    private _paypal: PayPal;
    private _discord: Client;

    public constructor(venda: Venda, config: IVendaConfig) {
        this._venda = venda;
        this._router = Router();
        this._auth = new DiscordAuth();
        this._config = config;
        this._paypal = PayPal.init(config.paypal.username, config.paypal.password, config.paypal.signature, config.paypal.return, config.paypal.cancel, false);
        this._discord = new Client();

        this._router.get("/", this.getRouteHome.bind(this));
        this._router.get("/logout", this.getRouteLogout.bind(this));
        this._router.get("/login", this.getRouteLogin.bind(this));
        this._router.get("/licenses", this.getRouteLicenses.bind(this));
        this._router.get("/order/:id", this.getRouteOrder.bind(this));
        this._router.get("/license/:id", this.getRouteLicense.bind(this));
        this._router.get("/discord/callback", this.getDiscordCallback.bind(this));
        this._router.get("/paypal/return", this.getPayPalReturn.bind(this));
        this._router.get("/paypal/cancel", this.getPayPalCancel.bind(this));

        this.startDiscordBot();
    }

    public get router(): Router {
        return this._router;
    }

    public isUserAdmin(user: IUser): boolean {
        return (user && this._config.admins.indexOf(user.discordId) >= 0);
    }

    public async validateSession(req: Request): Promise<IUser> {
        if (req.session.discordToken) {
            const discordUser = await this._auth.getUser(req.session.discordToken);

            if (discordUser) {
                return await User.findOne({
                    discordId: discordUser.id
                }).exec();
            }
        }
    }

    private startDiscordBot(): void {
        this._discord.on("ready", () => {

        });

        this._discord.on("message", async(message: Message) => {
            const discordId = message.author.id;
            const commandName = "!customer";

            if (message.content.substr(0, commandName.length) === commandName) {
                const paramString = message.content.substr(commandName.length).trim();
                const matches = paramString.match(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|```((.|\s)*?)```|\S+/g);
                let params: string[] = [];

                if (matches) {
                    params = matches.map(v => v.replace(/^"|"$|^'|'$|^```(\S*\n?)|```$/g, ""));
                }

                const user = await User.findOne({
                    discordId: discordId
                });

                if (user) {
                    const transactions = await Transaction.find({
                        user: user._id
                    });

                    if (transactions.length > 0) {
                        let roleChanged = false;
                        const member = message.guild.member(message.author);
                        const roles = member.roles.array();

                        for (let i = 0; i < transactions.length; i++) {
                            const transaction = transactions[i];
                            const productId = transaction.productId;
                            const product = this._config.products[productId];

                            if (product && product.roleId) {
                                const role = message.guild.roles.get(product.roleId);

                                if (role && !member.roles.has(role.id)) {
                                    message.channel.send("<@" + message.author.id + "> has claimed their " + role.name + " role!");
                                    roleChanged = true;
                                    roles.push(role);
                                }
                            }
                        }

                        if (roleChanged) {
                            await member.setRoles(roles);
                        } else {
                            message.channel.send("Sorry, <@" + message.author.id + ">, you don't qualify for any customer roles.");
                        }
                    } else {
                        message.channel.send("Sorry, <@" + message.author.id + ">, you haven't purchased any licenses.");
                    }
                } else {
                    message.channel.send("Sorry, <@" + message.author.id + ">, you haven't logged in to the store before.");
                }
            }
        });

        process.on("exit", () => {
            this._discord.destroy()
        });

        this._discord.login(this._config.discord.botToken);
    }

    private async getRouteLicense(req: Request, res: Response): Promise<void> {
        const user = await this.validateSession(req);

        if (!user) {
            res.redirect("/login");
            return;
        }

        const serviceId = req.params.id;

        const transaction = await Transaction.findOne({
            serviceId: serviceId
        });

        if (!transaction) {
            req.session.error = "Unable to find a valid license transaction!";
            res.redirect("/licenses");
            return;
        }

        const postData = {
            serviceID: serviceId,
            apiKey: this._config.cax.apiKey
        };

        const caxResponse = await HttpRequest({
            method: "POST",
            headers: {
                "Expect": "100-continue"
            },
            uri: this._config.cax.findUrl,
            form: postData,
            json: true,
            timeout: 20000
        });

        if (!caxResponse || caxResponse == "NO_SERIAL_FOUND") {
            req.session.error = "Unable to find a valid license key from the key server!";
            res.redirect("/licenses");
            return;
        }

        const product = this._config.products[transaction.productId];

        res.render("license", {
            isAdmin: this.isUserAdmin(user),
            license: caxResponse.serial,
            product: product,
            user: user
        });
    }

    private async getRouteOrder(req: Request, res: Response): Promise<void> {
        const user = await this.validateSession(req);

        if (!user) {
            res.redirect("/login");
            return;
        }

        const productId = req.params.id;
        const product = this._config.products[productId];

        if (!product) {
            req.session.error = "Unable to order a license that doesn't exist!";
            res.redirect("/");
            return;
        }

        if (product.price > 0) {
            this._paypal.pay(Date.now().toString(), product.price, product.title, "USD", false, [user.discordId, productId], function(err, url) {
                if (err) {
                    console.log(err);
                    return;
                }

                res.redirect(url);
            });
        } else {
            if (product.orderLimit !== undefined) {
                const existing = await Transaction.find({
                    user: user._id,
                    productId: productId
                });

                if (existing && existing.length >= product.orderLimit) {
                    req.session.error = "You have the maximum amount of licenses for " + product.title + "!";
                    res.redirect("/");
                    return;
                }
            }
            
            const caxResponse = await this.addNewTransaction(Date.now(), productId, user, product);

            if (caxResponse && caxResponse.success) {
                req.session.success = product.title + " license ordered successfully!";
                res.redirect("/licenses");
            } else {
                req.session.error = "Error ordering a license for " + product.title + "!";
                res.redirect("/");
            }
        }
    }

    private async getRouteHome(req: Request, res: Response): Promise<void> {
        const user = await this.validateSession(req);

        const success = req.session.success;
        const error = req.session.error;

        req.session.success = undefined;
        req.session.error = undefined;

        res.render("home", {
            success: success,
            error: error,
            isAdmin: this.isUserAdmin(user),
            products: this._config.products,
            user: user
        });
    }

    private async getRouteLicenses(req: Request, res: Response): Promise<void> {
        const user = await this.validateSession(req);

        if (!user) {
            res.redirect("/login");
            return;
        }

        const success = req.session.success;
        const error = req.session.error;

        req.session.success = undefined;
        req.session.error = undefined;

        const transactions = await Transaction.find({
            user: user._id
        });
       
        res.render("licenses", {
            success: success,
            error: error,
            isAdmin: this.isUserAdmin(user),
            transactions: transactions,
            products: this._config.products,
            user: user
        });
    }

    private async getRouteLogout(req: Request, res: Response): Promise<void> {
        const user = await this.validateSession(req);

        if (!user) {
            req.session.error = "Unable to log out, not currently logged in!";
            res.redirect("/");
            return;
        }

        req.session.discordToken = undefined;

        res.redirect("/");
    }

    private async getRouteLogin(req: Request, res: Response): Promise<void> {
        const CLIENT_ID = this._config.discord.clientId;
        const REDIRECT = encodeURIComponent(this._config.discord.redirect);
        const SCOPE = encodeURIComponent(this._config.discord.scope);

        res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=${SCOPE}&response_type=code&redirect_uri=${REDIRECT}`);
    }

    private async getPayPalReturn(req: Request, res: Response): Promise<void> {
        this._paypal.detail(req.query.token, req.query.PayerID, async(err, data, invoiceNumber, price, customData) => {
            if (data.success) {
                console.log("Success", customData);

                const user = await User.findOne({
                    discordId: customData[3]
                });

                const productId = customData[4];
                const product = this._config.products[productId];

                const caxResponse = await this.addNewTransaction(invoiceNumber, productId, user, product);

                if (caxResponse && caxResponse.success) {
                    req.session.success = product.title + " license ordered successfully!";
                    res.redirect("/licenses");
                } else {
                    req.session.error = "Error ordering a license for " + product.title + "!";
                    res.redirect("/");
                }

                console.log(caxResponse);
            }
        });
    }

    private async addNewTransaction(invoiceNumber: any, productId: any, user: IUser, product: IVendaConfigProduct): Promise<ICAXResponse> {
        let transaction = new Transaction({
            invoiceId: invoiceNumber,
            productId: productId,
            serviceId: invoiceNumber,
            user: user._id
        });

        transaction = await transaction.save();

        user.transactions.push(transaction._id);

        await user.save();

        const postData = {
            customerName: user.discordId,
            productID: product.cax.id,
            slotLimit: product.cax.slotLimit,
            serviceID: invoiceNumber,
            apiKey: this._config.cax.apiKey,
            email: user.email
        };

        const caxResponse = await HttpRequest({
            method: "POST",
            headers: {
                "Expect": "100-continue"
            },
            uri: this._config.cax.addUrl,
            form: postData,
            json: true,
            timeout: 20000
        });

        return caxResponse;
    }

    private async getPayPalCancel(req: Request, res: Response): Promise<void> {
        console.log("Cancel", req.query, req.body);
    }

    private async getDiscordCallback(req: Request, res: Response): Promise<void> {
        const CLIENT_SECRET = this._config.discord.clientSecret;
        const CLIENT_ID = this._config.discord.clientId;
        const REDIRECT = this._config.discord.redirect;
        const SCOPE = this._config.discord.scope;

        const discordToken = await this._auth.tokenRequest({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            code: req.query.code,
            scope: SCOPE,
            grantType: "authorization_code",
            redirectUri: REDIRECT
        })

        if (discordToken) {
            const discordUser = await this._auth.getUser(discordToken.access_token);

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
