const http = require('http');
const express = require('express');
const app = module.exports.app = exports.app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const scores = {};

app.use(express.static('static'));
app.set('view engine', 'pug');

app.get('/', (req, res) => {
  res.render('index');
});

server.listen(3000, () => console.log('running on 3000'));

function score(name) {
  scores[name] = scores[name] ? scores[name] + 1 : 1;
}

io.on('connection', function (socket) {
  socket.on('smash', function (data) {
    score(data.player);

    io.emit('smash', {
      brick: data.brick,
      player: data.player
    });
  });
});