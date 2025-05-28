const path = require("path");
module.exports = {
    mode: "production",
    entry: './entry.ts',
    optimization: {
        minimize: false,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, "."),
        filename: "index.js",
        library: {
            name: 'MyFridaAgent', // 暴露的全局变量名
            type: 'this',   // 'this' 可能更合适
        },
    },
    watch: true
}
