import * as mongoose from "mongoose";
import { IUser } from "./User";
import { IProduct } from "./Product";

export interface ITransaction extends mongoose.Document {
    user: IUser["_id"];
    product: IProduct["_id"];
}

export const TransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }
});

const Transaction = mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
