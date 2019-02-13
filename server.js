var express = require('express');
var app = express();

app.get('/', function (req, res) {
  res.send('Hola perro');
});

app.listen(8080, function () {
  console.log('Listos en el 8080');
});