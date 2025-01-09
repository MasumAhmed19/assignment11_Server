const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5050;
const app = express();
const cookieParser = require('cookie-parser');

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://suggestify-28d19.web.app",
    "https://suggestify-28d19.firebaseapp.com",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f0l8v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next)=>{
  const token = req.cookies?.token
  if(!token) return res.status(401).send({message: 'unauthorized access'})

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded)=>{
      if(err) {
        return res.status(401).send({message: 'unauthorized access'})
      }

      req.user = decoded

    })
  
  console.log(token)
  next();
}

async function run() {
  try {
    const db = client.db("suggestify-db");
    const queryCollection = db.collection("query");
    const recomCollection = db.collection("recommendation");

    // generate jwt
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "365d",
      });
      console.log(token);
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({success:true})
    });

    // logout jwt || clear cookie form browser
    app.get('/logout', async (req, res)=>{
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({success:true});
    })


    // POST a query in db
    app.post("/add-query", async (req, res) => {
      const queryData = req.body;
      const result = await queryCollection.insertOne(queryData);
      // console.log(result)
      res.send(result);
    });

    // READ all query data from db
    app.get("/queries", async (req, res) => {
      const result = await queryCollection.find().toArray();
      res.send(result);
    });

    // READ all posted query by specific user (their email)
    app.get("/queries/:email", verifyToken,  async (req, res) => {
      const decodedEmail = req.user.email;
      const email = req.params.email;

      if(decodedEmail !== email){
        return res.status(401).send({message:'unauthorized access'})
      }

      const query = { "queryer.email": email };
      const result = await queryCollection.find(query).toArray();
      res.send(result);
    });

    // READ all posted query by specific user (post id)
    app.get("/query/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await queryCollection.find(query).toArray();
      res.send(result);
    });

    // delete a query from db
    app.delete("/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await queryCollection.deleteOne(filter);
      res.send(result);
    });

    // update query data
    app.put("/update-query/:id", async (req, res) => {
      const id = req.params.id;
      const queryData = req.body;
      const update = {
        $set: queryData,
      };

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await queryCollection.updateOne(filter, update, options);
      // console.log(result)
      res.send(result);
    });

    // post recommendation: CREATE
    app.post("/add-recommendation", async (req, res) => {
      const data = req.body;
      const result = await recomCollection.insertOne(data);

      // recommendationCount 1 inc krte hbe
      if (result.acknowledged) {
        const filter = { _id: new ObjectId(data.querierID) };
        const update = {
          $inc: { recommendationCount: 1 },
        };

        const updateRecomCount = await queryCollection.updateOne(
          filter,
          update
        );

        res.send(result);
      } else {
        res.status(500).send({ error: "Failed to add recommendation" });
      }
    });

    // read all recommendation for each query id // prottek post er niche comment er jonne fetch krbo
    app.get("/all-recommendations/:id", async (req, res) => {
      const id = req.params.id;
      // Filter using the querierID as a string
      // const filter = { querierID: new ObjectId(id) }; kaj kore na eta
      const filter = { querierID: id };
      const result = await recomCollection.find(filter).toArray();
      res.send(result);
      // console.log(result)
    });

    // read all recommendation filtering the  recommer.email for My Recommendation page
    app.get("/my-recoms/:email", verifyToken, async (req, res) => {

      const decodedEmail = req.user.email;
      const email = req.params.email;

      if(decodedEmail !== email){
        return res.status(401).send({message:'unauthorized access'})
      }

      const filter = { "recommer.email": email };
      const result = await recomCollection.find(filter).toArray();
      res.send(result);
    });

    // READ recom query by specific _id
    app.get("/recom/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await recomCollection.find(query).toArray();
      res.send(result);
    });

    // delete recommendations
    // delete recommendations
    app.delete("/rec-delete/:id", async (req, res) => {
      const id = req.params.id;

      try {
        // ei is theke full recommer data nibo
        const recommendation = await recomCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!recommendation) {
          return res.status(404).send({ error: "Recommendation not found" });
        }

        // ei recommer id ta delete krbo
        const result = await recomCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 1) {
          // jodi delete hoy, decrement kro

          // recommendation theke querierId ta khujte hbe
          const filter = { _id: new ObjectId(recommendation.querierID) };
          const update = {
            $inc: { recommendationCount: -1 },
          };

          const updateRecomCount = await queryCollection.updateOne(
            filter,
            update
          );

          if (updateRecomCount.modifiedCount === 1) {
            res.send({
              success: true,
              message: "Recommendation deleted and count decremented",
            });
          } else {
            res.send({
              success: true,
              message: "Recommendation deleted but count not updated",
            });
          }
        } else {
          res.status(500).send({ error: "Failed to delete recommendation" });
        }
      } catch (error) {
        res.status(500).send({ error: "Server error", details: error.message });
      }
    });

    // get searched queries
    app.get("/all-queries", async (req, res) => {
      const search = req.query.search;
      const sort = req.query.sort;
      let options = {};

      if (sort) options = { sort: { addedTime: sort === "asc" ? 1 : -1 } };

      let query = {
        queryTitle: {
          $regex: search,
          $options: "i",
        },
      };

      const result = await queryCollection.find(query, options).toArray();
      res.send(result);
    });

    // read all recommendation filtering the  recommer.email for "Recommendation for me" page
    app.get("/recommendations-for-me/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { "queryer.email": email };
      const result = await recomCollection.find(filter).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    // console.log(
    //   'Pinged your deployment. You successfully connected to MongoDB!'
    // )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello from Suggestify Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
