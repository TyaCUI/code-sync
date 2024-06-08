/*
curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"

curl -X POST http://localhost:3000/updateFile -H "Content-Type: application/json" -d '{"filePath":"hello_world.py","content":"import os\nos.sys.arg\nprint(\"Hello World!\")\n"}'
*/
import fs from "fs"
import express from "express"
import os from "os"
import { globSync } from "glob"  
import { WebSocketServer } from "ws";

import {next as Automerge} from "@automerge/automerge"
import { Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

var port = process.argv[2] // 3000
var rootDocId = process.argv[3] // null
var rootPath = process.argv[4] // /

// Build express server
const expressObj = express()
expressObj.use(express.json())
expressObj.use(express.urlencoded({ extended: true }))

const server = expressObj.listen(port, () => {
  console.log(`The code sync server is listening on port ${port}...`)
})

// Build Websocket server
const backupPath = ".code-sync-server-backup/"
const wss = new WebSocketServer({ noServer: true })
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

var rootDocHandler = undefined
var directory =Object.fromEntries(globSync(`${rootPath}/**`, {nodir: true}).map(file => [`${file.replace(rootPath + "/", "")}`, null]))


if (rootDocId == "null"){
  rootDocHandler = repo.create(directory)
} else {
  rootDocHandler = repo.find(rootDocId)
  var loadDirectory = rootDocHandler.docSync()

  repo.create(directory).change((d) => (d = loadDirectory))
  rootDocHandler.change((d) => (d = directory))
  directory = loadDirectory
}

rootDocHandler.on("change", ({ doc }) => {
  // console.log(doc)
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
    directory = doc
    // console.log(directory)
  }
})

var rootDocId = rootDocHandler.documentId
console.log(`The root doc id is ${rootDocId}`)
var docHandler = undefined

expressObj.get('/port', (req, res) => { res.end(`${port}`) })

expressObj.get('/rootDocId', (req, res) => { res.end(`${rootDocId}`) })

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
  if ( fileDocId === undefined || fileDocId == null ) {
    docHandler = repo.create({"text": fs.readFileSync(`${rootPath}/${filePath}`, 'utf8')})
    fileDocId = docHandler.documentId
    rootDocHandler.change((d) => (d[`${filePath}`] = fileDocId))
  } else {
    docHandler = repo.find(fileDocId)
  }

  // console.log("openfile", rootDocHandler.docSync())

  docHandler.on("change", ({ doc }) => {
    // console.log("change", doc)

    fs.writeFile(`${rootPath}/${filePath}`, doc.text, function(err) {
      if(err) {
          return console.log(err)
      }
      console.log(`${filePath} was saved!`)
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

expressObj.post('/updatefile', (req, res) => {
  const filePath = req.body['filePath']
  const rootPath = req.body['rootPath']

  var fileDocId = rootDocHandler.docSync()[`${filePath}`]
  // console.log(fileDocId)
  if ( fileDocId === undefined || fileDocId == null){
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
      // console.log(`${filePath} was saved!`);
    })
  })

  // console.log("updateFile", docHandler.docSync())

  const content = req.body['content']

  docHandler.change((d) => Automerge.updateText(d, ["text"], content))

  // console.log("updateFile", docHandler.docSync())

  var updatedContent = docHandler.docSync()

  res.end(`${updatedContent['text']} updated!`)
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