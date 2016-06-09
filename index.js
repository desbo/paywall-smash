const http = require('http');
const express = require('express');
const app = module.exports.app = exports.app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const url = 'http://www.bbc.co.uk/sport/live/cricket/36211361';

app.use(express.static('static'));
app.set('view engine', 'pug');

app.get('/', (req, res) => {
  res.render('index', { url: url });
});

server.listen(3000, () => console.log('running on 3000'));

io.on('connection', function (socket) {
  socket.on('smash', function (data) {
    console.log('emitting', data);
    io.emit('smash', { brick: data.brick });
  });
});
