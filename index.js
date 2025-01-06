const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 5050
const app = express()

app.use(cors())
app.use(express.json())


const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f0l8v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    const db = client.db('suggestify-db')
    const queryCollection = db.collection('query')


    // POST a query in db 
    app.post('/add-query', async(req, res)=>{
        const queryData = req.body
        const result = await queryCollection.insertOne(queryData)
        console.log(result)
        res.send(result)
    })


    // READ all query data from db
    app.get('/queries', async(req, res)=>{
        const result = await queryCollection.find().toArray()
        res.send(result)
    })


    // READ all posted query by specific user (their email)
    app.get('/queries/:email', async(req, res)=>{
      const email = req.params.email;
      const query = { 'queryer.email':email}
      const result = await queryCollection.find(query).toArray()
      res.send(result)
    })

    // READ all posted query by specific user (post id)
    app.get('/query/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await queryCollection.find(query).toArray()
      res.send(result)
    })


    // delete a query from db
    app.delete('/delete/:id', async (req, res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)}
        const result = await queryCollection.deleteOne(filter)
        res.send(result)      
    })




    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from Suggestify Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
