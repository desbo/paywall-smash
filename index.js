'use strict';

const http = require('http');
const express = require('express');
const app = module.exports.app = exports.app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

let scores = {};
let destroyed = [];
let active = false;

app.use(express.static('static'));
app.set('view engine', 'pug');

app.get('/', (req, res) => {
  res.render('index', { env: process.env.NODE_ENV });
});

app.get('/controls', (req, res) => {
  res.render('controls', { env: process.env.NODE_ENV });
});

const port = process.env.PORT || 3000;

server.listen(port, () => console.log('running on port'));

function score(name) {
  scores[name] = scores[name] ? scores[name] + 1 : 1;
}

function destroy(brick) {
  destroyed.push(brick);
}

io.on('connection', function (socket) {
  console.log('connection');

  socket.emit('init', {
    destroyed: destroyed,
    active: active,
    scores: scores
  });

  socket.on('start', () => io.emit('start'));

  socket.on('stop', () => {
    active = false;

    io.emit('stop', {
      scores: scores
    });
  });

  socket.on('reset', () => {
    scores = {};
    destroyed = [];
    active = true;

    io.emit('reset');
  });

  socket.on('smash', function (data) {
    score(data.player);
    destroy(data.brick);

    io.emit('smash', {
      brick: data.brick,
      player: data.player,
      destroyed: destroyed
    });
  });
});
