import * as mongoose from "mongoose";
import { IUser } from "./User";

export interface ITransaction extends mongoose.Document {
    user: IUser["_id"];
    serviceId: number;
    productId: string;
    invoiceId: number;
}

export const TransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    serviceId: {
        type: Number,
        required: true
    },

    productId: {
        type: String,
        required: true
    },

    invoiceId: {
        type: Number,
        required: true
    }
});

const Transaction = mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
