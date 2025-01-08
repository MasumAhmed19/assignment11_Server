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
    const recomCollection = db.collection('recommendation')


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

    // update query data
    app.put('/update-query/:id', async(req, res)=>{
      const id=req.params.id;
      const queryData = req.body;
      const update= {
        $set: queryData,
      }

      const filter = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const result = await queryCollection.updateOne(filter, update, options)
      console.log(result)
      res.send(result)
    })


    // post recommendation: CREATE
    app.post('/add-recommendation', async (req, res)=>{
      const data = req.body
      const result = await recomCollection.insertOne(data)


      // recommendationCount 1 inc krte hbe
      if(result.acknowledged){
        const filter = {_id: new ObjectId(data.querierID)}
        const update = {
          $inc:{recommendationCount: 1},
        }

        const updateRecomCount = await queryCollection.updateOne(filter, update)

        res.send(result)
      }else{
        res.status(500).send({ error: 'Failed to add recommendation' });

      }
    })

    // read all recommendation for each query id // prottek post er niche comment er jonne fetch krbo
    app.get('/all-recommendations/:id', async (req, res) => {

        const id = req.params.id;
        // Filter using the querierID as a string
        // const filter = { querierID: new ObjectId(id) }; kaj kore na eta
        const filter = { querierID: id };
        const result = await recomCollection.find(filter).toArray();
        res.send(result);
        console.log(result)
    });
    

    // read all recommendation filtering the  recommer.email for My Recommendation page
    app.get('/my-recoms/:email', async (req, res) => {
  
        const email = req.params.email;

        const filter = { 'recommer.email': email };
        const result = await recomCollection.find(filter).toArray();
        res.send(result);
      
    });


    // delete recommendations

    // get searched queries
    app.get('/all-queries', async(req, res)=>{
      const search = req.query.search
      const sort = req.query.sort
      let options = {};

      if (sort) options = { sort: { addedTime: sort === 'asc' ? 1 : -1 } }
      
      let query = {
        queryTitle: {
          $regex: search,
          $options: 'i',
        },
      }

      const result = await queryCollection.find(query, options).toArray();
      res.send(result)
    })



    // read all recommendation filtering the  recommer.email for "Recommendation for me" page
    app.get('/recommendations-for-me/:email', async (req, res)=>{
      const email = req.params.email;
      const filter = {'queryer.email': email}
      const result = await  recomCollection.find(filter).toArray()
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
