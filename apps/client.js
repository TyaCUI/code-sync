/*
curl -X POST http://localhost:3030/loadfile -d "filePath=hello_world.py"

curl -X POST http://localhost:3030/updateFile -H "Content-Type: application/json" -d '{"filePath":"hello_world.py","content":"suprise!!!"}'
*/
import fs from "fs"
import express from "express"
import os from "os"
import { WebSocketServer, WebSocket } from "ws";

import {next as Automerge} from "@automerge/automerge"
import { Repo } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

const expressObj = express()
expressObj.use(express.json())
expressObj.use(express.urlencoded({ extended: true }))

const port = 3030
const codeBasePath = "../example-code-client/"

const server =expressObj.listen(port, () => {
  console.log(`The code sync client is listening on port ${port}`)
})

const backupPath = ".code-sync-client-backup/"

var url = process.argv.slice(2);
// url = "ws://localhost:3000"
const repo = new Repo({
  network: [new BrowserWebSocketClientAdapter(url)],
  storage: new NodeFSStorageAdapter(backupPath),
})


var rootDocId = await fetch(`${url}/rootDocId`, {})
  .then(response => response.text())
var rootDocHandler = repo.find(rootDocId)
var docHandler = undefined

// const socket = new WebSocket(`${url}`);

// socket.on('error', console.error);

// socket.on('open', function open() {
//   socket.send('something');
// });

// socket.on('message', function message(data) {
//   console.log('received: %s', data);
// });

expressObj.get('/port', (req, res) => { res.end(`${port}`) })

expressObj.post('/loadfile', (req, res) => {
  var filePath = req.body['filePath']

  var fileDocId = rootDocHandler.docSync()[filePath]
  if ( fileDocId === undefined ) {
    docHandler = repo.create({"text": fs.readFileSync(filePath, 'utf8')})
    fileDocId = docHandler.documentId
    rootDocHandler.change((d) => (d[filePath] = fileDocId))
  } else {
    docHandler = repo.find(fileDocId)
    fs.writeFile(codeBasePath + filePath, docHandler.docSync().text, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log(`${filePath} was saved!`);
    })
  }

  docHandler.on("change", ({ doc }) => {
    fs.writeFile(codeBasePath + filePath, doc.text, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log(`${filePath} was saved!`);
    })
    // console.log("new text is ", doc.text);
    // console.log("whole doc is ", doc.docSync());
  });

  res.end(`${fileDocId}`) 
})

expressObj.get('/getdoc', (req, res) => {
  res.end(`${docHandler.docSync().text}`)
})

expressObj.post('/updateFile', (req, res) => {
  var filePath = req.body['filePath']
  var fileDocId = rootDocHandler.docSync()[filePath]
  var curDocHandler = repo.find(fileDocId)

  var content = req.body['content']

  curDocHandler.change((d) => Automerge.updateText(d, ["text"], content))

  var updatedContent = curDocHandler.docSync().text

  fs.writeFile(codeBasePath + filePath, updatedContent, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log(`${filePath} was saved!`);
  })

  res.end(`${updatedContent}`)
})
