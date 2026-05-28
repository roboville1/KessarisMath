const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const { exec } = require("child_process")

const app = express()

app.use(cors())
app.options("/convert-docx", cors())
app.use(express.json({ limit: "20mb" }))

const tempDir = path.join(__dirname, "temp")

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir)
}

app.post("/convert-docx", (req, res) => {
  const latex = req.body.latex

  const texPath = path.join(tempDir, "input.tex")
  const docxPath = path.join(tempDir, "KessarisMath.docx")

  fs.writeFileSync(texPath, latex, "utf8")

  const command = `pandoc "${texPath}" -o "${docxPath}"`

  exec(command, (error) => {
    if (error) {
      console.error(error)
      return res.status(500).send("Pandoc conversion failed")
    }

    res.download(docxPath, "KessarisMath.docx")
  })
})

app.listen(3001, () => {
  console.log("Pandoc server running on port 3001")
})

app.listen(PORT, () => {
  console.log(`Pandoc server running on port ${PORT}`)
})