const fileContent = await fs.promises.readFile(filePath)
new Uint8Array(fileContent)





curl -X POST http://localhost:3000/updateFile -H "Content-Type: application/json" -d '{"filePath":"../example-code/hello_world.py","content":"import os hi hi hi"}'