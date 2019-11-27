import * as mongoose from "mongoose";
import { ITransaction } from "./Transaction";

export interface IUser extends mongoose.Document {
    email: string;
    discordId: string;
    transactions: ITransaction["_id"][];
}

export const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        requred: true
    },

    discordId: {
        type: String,
        unique: true,
        required: true
    },

    transactions: [{
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }]
});

const User = mongoose.model<IUser>("User", UserSchema);

export default User;
