var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send({
        nodo: process.env.MY_NODE_NAME,
        pod: process.env.MY_POD_NAME
    });
});

app.listen(8080, function () {
    console.log('Listos en el 8080');
});