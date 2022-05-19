const express = require('express')
const app = express()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, MongoRuntimeError } = require('mongodb');
const cors = require('cors');
const { get } = require('express/lib/response');
require('dotenv').config();
const port = process.env.PORT || 5000




app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i2dlq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function varifyJWT(req, res, next) {
    // console.log('abc');
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' })
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctore-portal').collection('services');
        const bookingCollection = client.db('doctore-portal').collection('bookings');
        const userCollection = client.db('doctore-portal').collection('users');


        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray()
            res.send(services);

        })

        app.get('/user', varifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', varifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };


                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);

                res.send(result)
            }

            else {
                res.status(403).send({ message: 'forbidden' })
            }
        })




        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true }

            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })

        // app.get('/available', async (req, res) => {
        //     const date = req.query.date;
        //     const services = await serviceCollection.find().toArray();

        //     const query = { date: date }
        //     const bookings = await bookingCollection.find(query).toArray();
        //     // res.send(services)

        //     services.forEach(service => {
        //         const serviceBookings = bookings.filter(book => book.treatment === service.name);
        //         const bookedSlots = serviceBookings.map(book => book.slot);
        //         const available = service.slots.filter(slot => !bookedSlots.includes(slot));
        //         service.slots = available;
        //     });
        // })

        app.get('/available', async (req, res) => {

            const date = req.query.date;
            const services = await serviceCollection.find().toArray();
            // res.send(services);
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            // res.send(bookings)
            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                const bookedSlots = serviceBookings.map(book => book.slot)
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                service.slots = available;
            })

            res.send(services)
        })


        app.get('/booking', varifyJWT, async (req, res) => {
            const patient = req.query.patient;

            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })


        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })
    }

    finally {

    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello For Doctor Uncle!')
})

app.listen(port, () => {
    console.log(`Doctor app listening on port ${port}`)
})