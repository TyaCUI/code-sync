/*
curl -X POST http://localhost:3030/loadfile -d "filePath=hello_world.py"

curl -X POST http://localhost:3030/updateFile -H "Content-Type: application/json" -d '{"filePath":"hello_world.py","content":"suprise!!!"}'
*/
import fs from "fs"
import express from "express"
import os from "os"
import { globSync } from "glob"  
import { WebSocketServer, WebSocket } from "ws";

import {next as Automerge} from "@automerge/automerge"
import { Repo } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

var url = process.argv[2]
var runPort = process.argv[3] // 3032
var rootPath = process.argv[4] // /

// Build express server
const expressObj = express()
expressObj.use(express.json())
expressObj.use(express.urlencoded({ extended: true }))

const server = expressObj.listen(runPort, () => {
  console.log(`The code sync client is listening on port ${runPort}`)
})

const backupPath = ".code-sync-client-backup/"

const repo = new Repo({
  network: [new BrowserWebSocketClientAdapter(`ws://${url}`)],
  storage: new NodeFSStorageAdapter(backupPath),
})

var rootDocId = await fetch(`http://${url}/rootDocId`, {}).then(response => response.text())

var directory =Object.fromEntries(globSync(`${rootPath}/**`, {nodir: true}).map(file => [`${file.replace(rootPath + "/", "")}`, null]))

var rootDocHandler = repo.find(rootDocId)
var loadDirectory = await rootDocHandler.doc()
// await rootDocHandler.whenReady()
repo.create(directory).change((d) => (d = loadDirectory))

rootDocHandler.on("change", ({ doc }) => {
  // console.log("doc")
  // console.log(doc)
  // console.log("directory")
  // console.log(directory)
  if (doc !== undefined){
    // create files
    for (let filePath of Object.keys(doc)) {
        var docId = doc[filePath]
        if (!(filePath in directory)) {
            // console.log(`${rootPath}/${filePath}`)
            fs.closeSync(fs.openSync(`${rootPath}/${filePath}`, 'w'))
        }else if (directory[filePath] != docId && directory[filePath] != null && docId != null) {
          var newDocHandler = repo.find(docId)
          newDocHandler.merge(directory[filePath])
          // repo.delete(directory[filePath])
        }
    }
    // delete files
    for (let filePath of Object.keys(directory)) {
        if (!(filePath in doc)) {
            // console.log(`${rootPath}/${filePath}`)
            fs.unlinkSync(`${rootPath}/${filePath}`)
            repo.delete(directory[filePath])
        }
    }
  }
  directory = doc
  // console.log(directory)
})

var docHandler = undefined

expressObj.get('/port', (req, res) => { res.end(`${port}`) })

expressObj.post('/createfile', (req, res) => { 
  const filePath = req.body['filePath']

  if ( !(`${filePath}` in rootDocHandler.docSync()) ) {
    rootDocHandler.change((d) => (d[`${filePath}`] = null))
  }

  // console.log(rootDocHandler.docSync())
  
  res.end(`${filePath} created!`) 
})

expressObj.post('/deletefile', (req, res) => { 
  const filePath = req.body['filePath']

  // console.log(filePath)

  if ( `${filePath}` in rootDocHandler.docSync() ) {
    rootDocHandler.change((d) => (delete d[`${filePath}`]))
  }

  // console.log(rootDocHandler.docSync())

  res.end(`${filePath} deleted!`) 
})

expressObj.post('/openfile', (req, res) => {
  const filePath = req.body['filePath']
  const rootPath = req.body['rootPath']

  var fileDocId = rootDocHandler.docSync()[`${filePath}`]

  var localDocHandler = repo.create({"text": fs.readFileSync(`${rootPath}/${filePath}`, 'utf8')})

  if ( fileDocId === undefined || fileDocId == null ) {
    docHandler = localDocHandler
    fileDocId = docHandler.documentId
    rootDocHandler.change((d) => (d[`${filePath}`] = fileDocId))
  } else {
    docHandler = repo.find(fileDocId)
    localDocHandler.merge(docHandler)
    // docHandler.merge(localDocHandler)
  }

  // console.log("openfile", rootDocHandler.docSync())
  docHandler.on("change", ({ doc }) => {
  //   console.log("change", doc)
    fs.writeFile(`${rootPath}/${filePath}`, doc.text, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log(`${filePath} was saved!`);
    })
  })

   // console.log(rootDocHandler.docSync())

  res.end(`${fileDocId} opened!`) 
})

expressObj.post('/closefile', (req, res) => {
  const filePath = req.body['filePath']
  // console.log(filePath)

  var fileDocId = rootDocHandler.docSync()[`${filePath}`]
  if ( fileDocId !== undefined && fileDocId != null ) {
    repo.delete(fileDocId)
    rootDocHandler.change((d) => (d[`${filePath}`] = null))
  }

  // console.log(rootDocHandler.docSync())
  res.end(`${fileDocId} closed!`) 
})

expressObj.get('/getdoc', (req, res) => {
  res.end(`${docHandler.docSync().text}`)
})

expressObj.post('/updateFile', (req, res) => {
  const filePath = req.body['filePath']
  const rootPath = req.body['rootPath']
  var fileDocId = rootDocHandler.docSync()[`${filePath}`]

  if ( fileDocId === undefined || fileDocId == null ){
    docHandler = repo.create({"text": fs.readFileSync(`${rootPath}/${filePath}`, 'utf8')})
    fileDocId = docHandler.documentId
    rootDocHandler.change((d) => (d[`${filePath}`] = fileDocId))
  } else {
    docHandler = repo.find(fileDocId)
  }

  docHandler.on("change", ({ doc }) => {
    // console.log("change", doc)
    fs.writeFile(`${rootPath}/${filePath}`, doc.text, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log(`${filePath} was saved!`);
    })
  })

  var content = req.body['content']

  docHandler.change((d) => Automerge.updateText(d, ["text"], content))

  var updatedContent = docHandler.docSync().text

  res.end(`${updatedContent} updated!`)
})

function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  server.close(() => {
      console.log('Closed out remaining connections');
      process.exit(0)
  })

  setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1)
  }, 10000)

  for (let filePath of Object.keys(directory)) {
    var docId = directory[filePath]
    if (docId !== undefined && docId != null) {
      repo.delete(docId)
    }
  }
  repo.delete(rootDocId)
}
