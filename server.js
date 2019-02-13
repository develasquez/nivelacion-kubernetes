var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send({
        nodo: process.env.MY_NODE_NAME,
        pod: process.env.MY_POD_NAME
    });
});

app.get('/ready', function (req, res) {
    //Aca tenemos que esperar que todo este inicializado 
    //Para poder recibir el primer request
    res.sendStatus(200);
});
app.get('/health', function (req, res) {
    //Este endpoint da una señal mínima de vida 
    //Tambien puede indicar la salud completa del servicio.
    //Sigue con acceso a otros sub servicios? Se ve la BD? 
    res.sendStatus(200);
});

app.listen(8080, function () {
    console.log('Listos en el 8080');
});