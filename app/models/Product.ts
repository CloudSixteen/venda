import * as mongoose from "mongoose";

export interface IProduct extends mongoose.Document {
    name: string;
    price: number;
    productId: number;
}

export const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    productId: {
        type: Number,
        required: true
    }
});

const Product = mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
