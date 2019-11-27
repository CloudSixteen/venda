import MainController from "./controllers/MainController";
import { Application } from "express";
import * as requestIp from "request-ip";
import * as bodyParser from "body-parser";
import express from "express";
import session from "express-session";

require("http").globalAgent.maxSockets = Infinity;

class Venda {
    private _ip: string;
    private _app: Application;
    private _port: number;
    private _config: IVendaConfig;

    public get app(): Application {
        return this._app;
    }

    public start(): void {
        this._app.set("views", "views");
        this._app.set("view engine", "pug");

        this._app.use(express.static("public"));
        this._app.use(bodyParser.json());
        this._app.use(bodyParser.urlencoded({extended: true}));
        this._app.use(requestIp.mw());
        this._app.use(session({
            saveUninitialized: true,
            resave: false,
            secret: "3631019a2f00ab7ce68ae80f4fb6d89b"
        }));
        this._app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        let controller = new MainController(this, this._config);

        this._app.use("/", controller.router);

        this._app.listen(this._port, () => {
            console.log("Listening at http://localhost:" + this._port + "/");
        });
    }

    public constructor(app: Application, port: number, config: IVendaConfig) {
        this._app = app;
        this._port = port;
        this._config = config;
    }
}

export default Venda;
