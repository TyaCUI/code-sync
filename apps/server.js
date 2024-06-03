/*
curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"

curl -X POST http://localhost:3000/updateFile -H "Content-Type: application/json" -d '{"filePath":"hello_world.py","content":"import os\nos.sys.arg\nprint(\"Hello World!\")\n"}'
*/
import fs from "fs"
import express from "express"
import os from "os"
import { WebSocketServer } from "ws";

import {next as Automerge} from "@automerge/automerge"
import { Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

const expressObj = express()
expressObj.use(express.json())
expressObj.use(express.urlencoded({ extended: true }))

const port = 3000
// const codeBasePath = "../example-code-server/"

const server = expressObj.listen(port, () => {
  console.log(`The code sync server is listening on port ${port}...`)
})

const backupPath = ".code-sync-server-backup/"
// const path = "/Users/tianyicui/developement/CS244b/example-code-repo/"
const wss = new WebSocketServer({ noServer: true })
// const fileName = "/Users/tianyicui/developement/CS244b/example-code-repo/tcui.py"
const repo = new Repo({
  network: [new NodeWSServerAdapter(wss)],
  storage: new NodeFSStorageAdapter(backupPath),
  peerId: "server"
})
server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (socket) => {
    wss.emit("connection", socket, request)
  })
})

let rootDocHandler = repo.create({})
var rootDocId = rootDocHandler.documentId
console.log(`The root doc id is ${rootDocId}`)
var docHandler = undefined

expressObj.get('/port', (req, res) => { res.end(`${port}`) })

expressObj.get('/rootDocId', (req, res) => { res.end(`${rootDocId}`) })

expressObj.post('/loadfile', (req, res) => {
  const filePath = req.body['filePath']
  const rootPath = req.body['rootPath']

  var fileDocId = rootDocHandler.docSync()[`${filePath}`]
  if ( fileDocId === undefined ) {
    docHandler = repo.create({"text": fs.readFileSync(`${rootPath}/${filePath}`, 'utf8')})
    fileDocId = docHandler.documentId
    rootDocHandler.change((d) => (d[`${filePath}`] = fileDocId))
  } else {
    docHandler = repo.find(fileDocId)
  }

  docHandler.on("change", ({ doc }) => {
    fs.writeFile(`${rootPath}/${filePath}`, doc.text, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log(`${filePath} was saved!`);
    })
    
  });

  res.end(`${fileDocId}`) 
})

expressObj.get('/getdoc', (req, res) => {
  res.end(`${docHandler.docSync().text}`)
})

expressObj.post('/updateFile', (req, res) => {
  const filePath = req.body['filePath']
  const rootPath = req.body['rootPath']
  var fileDocId = rootDocHandler.docSync()[`${filePath}`]
  if ( fileDocId === undefined ){
    docHandler = repo.create({"text": fs.readFileSync(`${rootPath}/${filePath}`, 'utf8')})
    fileDocId = docHandler.documentId
    rootDocHandler.change((d) => (d[`${filePath}`] = fileDocId))
  } else {
    docHandler = repo.find(fileDocId)
  }

  // var curDocHandler = repo.find(`${fileDocId}`)

  const content = req.body['content']

  docHandler.change((d) => Automerge.updateText(d, ["text"], content))

  var updatedContent = docHandler.docSync().text

  // fs.writeFile(`${rootPath}/${filePath}`, updatedContent, function(err) {
  //   if(err) {
  //       return console.log(err);
  //   }
  //   console.log(`${filePath} was saved!`);
  // })

  res.end(`${updatedContent}`)
})