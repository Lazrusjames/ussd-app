// Implementation of the database connection using Mongoose
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');


//
const app = express();
app.use(bodyParser.json());

const PORT=8000;


//Establish a connection to the MongoDB database
const mongoURI = 'mongodb://localhost:27017/ussd-app'; // Replace with your MongoDB connection string

mongoose.connect(mongoURI);

// Handle connection events
const db = mongoose.connection;

// Log an error message if the connection fails
db.on('error', 
    (err)=>{
        console.log(err);
    }
);

// Log a message when the connection is successfully established
db.once('open', ()=>{
    console.log('Connected to the database');
} );



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//This section is for the Africa's Talking SMS API integration
app.get('/', (req, res) => {
    res.send('Welcome to the USSD app!');
}
);
