import { WebSocketServer } from 'ws';
// import { createServer } from 'http';
import express from "express"

const server = express()

const wss = new WebSocketServer({ noServer: true });

// const wss = new WebSocketServer({ port: 3030 });

wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log('received: %s', data);
  });

  ws.send('something');
});


// https://stackoverflow.com/questions/58054514/nextjs-express-error-during-websocket-handshake-unexpected-response-code-200
let srv = server.listen(3030);

srv.on('upgrade', function upgrade(request, socket, head) {
  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit('connection', ws, request);
  });
});

server.get('/ips', (req, res) => {
  console.log('received: %s', req);
  res.send("hello");
});

