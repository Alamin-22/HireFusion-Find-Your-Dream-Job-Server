const express = require('express')
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000;


// middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        'http://localhost:5174',
        'http://localhost:5173',
        "https://hirefusion.netlify.app",
    ],
    credentials: true
}));



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4hda1bm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middleware custom
const logger = async (req, res, next) => {
    console.log("called", req.hostname, req.originalUrl);
    next();
}
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log("Value of token in middleware:", token)
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        // error
        if (err) {
            console.log(err)
            return res.status(401).send({ message: " Unauthorized" })
        }

        // if token is valid than it would be decoded

        console.log("value in the token", decoded);
        req.user = decoded;
        next();
    })
}



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const JobsCollections = client.db("JobBoardDB").collection("jobsPost");
        const AppliedCollection = client.db("JobBoardDB").collection("AppliedCollection")


        // auth related api
        app.post("/api/v1/jwt", async (req, res) => {
            const user = req.body;
            console.log("user for token on auth Api", user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h",
            });
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none",

            })
                .send({ success: true })
        })

        app.post("/api/v1/logout", async (req, res) => {
            const user = req.body;
            console.log("Logout User:", user);
            res.clearCookie("token", {
                maxAge: 0,
                httpOnly: true,
                secure: true,
                sameSite: "none",
            })
                .send({ success: true });
        })


        // get jobs from api


        app.get("/api/v1/jobsdataCount", async (req, res) => {

            const count = await JobsCollections.estimatedDocumentCount();
            res.send({ count });

        })
        app.get("/api/v1/jobsdata", async (req, res) => {
            // console.log(req.query.email)
            let query = {};
            if (req.query?.Category) {
                query = { Category: req.query?.Category }
            }
            const cursor = JobsCollections.find(query);
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const result = await cursor
                .skip(page * size)
                .limit(size)
                .toArray();
            res.send(result);
        })
        // get api for specific profile posted job 
        app.get("/api/v1/jobsdata/myJobs", verifyToken, async (req, res) => {
            console.log(req.query.email)

            if (req.query.email !== req.user.email) {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            let query = {};
            if (req.query?.email) {
                query = { postedEmail: req.query?.email }
            }

            const cursor = JobsCollections.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })


        // get specific Id data
        app.get(`/api/v1/jobsdata/:id`, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await JobsCollections.findOne(query);
            res.send(result);
        })
        app.delete("/api/v1/jobsdata/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await JobsCollections.deleteOne(query);
            res.send(result);
        })

        app.put("/api/v1/jobsdata/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }
            const updatedJob = req.body;
            const Job = {
                $set: {
                    JobTitle: updatedJob.JobTitle,
                    Category: updatedJob.Category,
                    ApplicationStartDate: updatedJob.ApplicationStartDate,
                    ApplicationEndDate: updatedJob.ApplicationEndDate,
                    Salary: updatedJob.Salary,
                    AppliedCount: updatedJob.AppliedCount,
                    JobBanner: updatedJob.JobBanner,
                    LoggedInUser: updatedJob.LoggedInUser,
                    CompanyLogo: updatedJob.CompanyLogo,
                    CompanySlogan: updatedJob.CompanySlogan,
                    DetailDescription: updatedJob.DetailDescription,
                }
            }
            const result = await JobsCollections.updateOne(filter, Job, options);
            res.send(result);


        })
        app.patch("/api/v1/jobsdata/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }
            const { AppliedCount } = req.body;

            const Job = {
                $inc: {
                    AppliedCount: 1,
                }
            }
            const result = await JobsCollections.updateOne(filter, Job, options);
            res.send(result);


        })

        // job post

        app.post(`/api/v1/jobsdata`, async (req, res) => {
            const NewJob = req.body;
            // console.log(NewJob);
            const result = await JobsCollections.insertOne(NewJob);
            res.send(result);
        })



        // applied jobs related Api

        app.post("/api/v1/applied", async (req, res) => {
            const applied = req.body;
            // console.log(applied);
            const result = await AppliedCollection.insertOne(applied);
            res.send(result);
        })

        app.get("/api/v1/applied", verifyToken, logger, async (req, res) => {
            console.log("applied called email:", req.query.email);
            console.log("Valid user Information :", req.user);
            // console.log("token from applied api:", req.cookies.token);
            if (req.query.email !== req.user.email) {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const cursor = AppliedCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // get specific Id data
        app.get(`/api/v1/applied/:id`, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await AppliedCollection.findOne(query);
            res.send(result);
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);









app.get("/", (req, res) => {
    res.send("JobBoard server  is Running");
})

app.listen(port, () => {
    console.log(`JObBoard Server is Running on Port ${port}`)
})