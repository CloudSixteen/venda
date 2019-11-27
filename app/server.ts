import { Application } from "express";
import express from "express";
import Venda from "./Venda";
import mongoose from "mongoose";
import * as fs from "fs";

mongoose.connect("mongodb://localhost:27017/Venda", {
    useNewUrlParser: true
});

let config = <IVendaConfig>JSON.parse(fs.readFileSync("config.json").toString());
let app: Application = express();
let port = 3002;

let venda = new Venda(app, port, config);

if (venda) {
    venda.start();
}
